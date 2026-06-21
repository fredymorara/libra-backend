import {
  Injectable,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { DRIZZLE_PROVIDER } from '../database/drizzle.provider';
import type { DrizzleDB } from '../database/drizzle.provider';
import { documentChunks } from '../database/schema/chunks';
import { documents } from '../database/schema/documents';
import { RagService } from '../rag/rag.service';

@Injectable()
export class SearchService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly ragService: RagService,
  ) {}

  async hybridSearch(userId: string, originalQuery: string, finalLimit = 5) {
    try {
      // Phase A: Query Transformation
      const queries = await this.ragService.transformQuery(originalQuery);

      const denseResultsMap = new Map<string, any>();
      const sparseResultsMap = new Map<string, any>();

      // Phase B: Hybrid Search
      for (const query of queries) {
        // 1. Dense Search (pgvector)
        const queryVector = await this.ragService.generateEmbedding(query);
        const vectorString = `[${queryVector.join(',')}]`;

        const denseChunks = await this.db
          .select({
            chunkId: documentChunks.id,
            content: documentChunks.content,
            parentId: documentChunks.parentId,
            distance: sql<number>`${documentChunks.embedding} <=> ${vectorString}::vector`,
            parentTitle: documents.title,
            parentAuthor: documents.author,
            parentIsbn: documents.isbn,
          })
          .from(documentChunks)
          .innerJoin(
            documents,
            sql`${documentChunks.parentId} = ${documents.id} AND ${documents.userId} = ${userId}`,
          )
          .orderBy(sql`${documentChunks.embedding} <=> ${vectorString}::vector`)
          .limit(10)
          .execute();

        denseChunks.forEach((chunk, index) => {
          if (!denseResultsMap.has(chunk.chunkId)) {
            denseResultsMap.set(chunk.chunkId, { ...chunk, rank: index + 1 });
          }
        });

        // 2. Sparse Search (tsvector full-text search)
        const sparseChunks = await this.db
          .select({
            chunkId: documentChunks.id,
            content: documentChunks.content,
            parentId: documentChunks.parentId,
            rankMatch: sql<number>`ts_rank(${documentChunks.searchVector}, plainto_tsquery('english', ${query}))`,
            parentTitle: documents.title,
            parentAuthor: documents.author,
            parentIsbn: documents.isbn,
          })
          .from(documentChunks)
          .innerJoin(
            documents,
            sql`${documentChunks.parentId} = ${documents.id} AND ${documents.userId} = ${userId}`,
          )
          .where(
            sql`${documentChunks.searchVector} @@ plainto_tsquery('english', ${query})`,
          )
          .orderBy(
            sql`ts_rank(${documentChunks.searchVector}, plainto_tsquery('english', ${query})) DESC`,
          )
          .limit(10)
          .execute();

        sparseChunks.forEach((chunk, index) => {
          if (!sparseResultsMap.has(chunk.chunkId)) {
            sparseResultsMap.set(chunk.chunkId, { ...chunk, rank: index + 1 });
          }
        });
      }

      // Phase C: Reciprocal Rank Fusion (RRF)
      const rrfConstant = 60;
      const combinedResultsMap = new Map<string, any>();

      // Fuse Dense
      for (const [chunkId, data] of denseResultsMap.entries()) {
        const rrfScore = 1 / (rrfConstant + data.rank);
        combinedResultsMap.set(chunkId, { ...data, rrfScore });
      }

      // Fuse Sparse
      for (const [chunkId, data] of sparseResultsMap.entries()) {
        if (combinedResultsMap.has(chunkId)) {
          const existing = combinedResultsMap.get(chunkId);
          existing.rrfScore += 1 / (rrfConstant + data.rank);
        } else {
          const rrfScore = 1 / (rrfConstant + data.rank);
          combinedResultsMap.set(chunkId, { ...data, rrfScore });
        }
      }

      // Sort by RRF score descending
      const fusedResults = Array.from(combinedResultsMap.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .slice(0, 15); // Top 15 to send to Cross-Encoder

      if (fusedResults.length === 0) return [];

      // Phase D: Cross-Encoder Re-ranking
      const rerankedChunks = await this.ragService.rerankChunks(
        originalQuery,
        fusedResults,
      );

      return rerankedChunks.slice(0, finalLimit);
    } catch (error: any) {
      console.error(error);
      throw new InternalServerErrorException(
        `Agentic Hybrid Search failed: ${error.message}`,
      );
    }
  }
}
