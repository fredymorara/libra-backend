import {
  Injectable,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/drizzle.provider';
import type { DrizzleDB } from '../database/drizzle.provider';
import { documents } from '../database/schema/documents';
import { documentChunks } from '../database/schema/chunks';
import { ingestionQueue } from '../database/schema/queue';
import { RagService } from '../rag/rag.service';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { Marc } from 'marcjs';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly ragService: RagService,
  ) {}

  // Basic semantic chunking: split by paragraphs
  private chunkText(text: string, minLength = 100): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const p of paragraphs) {
      if (currentChunk.length + p.length > 1000) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += p + '\n\n';
    }
    if (currentChunk.trim().length >= minLength || chunks.length === 0) {
      chunks.push(currentChunk.trim() || text.substring(0, 1000));
    }
    return chunks;
  }

  async ingestBookByIsbn(
    userId: string,
    isbn: string,
    customMetadata?: Record<string, any>,
  ) {
    if (!isbn || typeof isbn !== 'string') {
      throw new InternalServerErrorException('Invalid ISBN provided.');
    }

    try {
      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
      const url = apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

      // Fetch from Google Books API
      const response = await fetch(url);
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error('Book not found or API Quota Exceeded');
      }

      const book = data.items[0].volumeInfo;
      const title = book.title || 'Unknown Title';
      const author = book.authors ? book.authors.join(', ') : 'Unknown Author';
      const description =
        book.description || `${title} by ${author}. A comprehensive guide.`;

      // 2. Fetch OpenLibrary API for Table of Contents
      let toc = '';
      try {
        const olRes = await fetch(
          `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=details`,
        );
        const olData = await olRes.json();
        const olBook = olData[`ISBN:${isbn}`];
        if (olBook?.details?.table_of_contents) {
          toc = olBook.details.table_of_contents
            .map((t: any) => t.title || '')
            .filter(Boolean)
            .join('\n');
        }
      } catch (e) {
        console.error('OpenLibrary fetch failed', e);
      }

      // 3. Fetch Semantic Scholar Graph API for Academic Context
      let academicAbstract = '';
      let citationCount = 0;
      let fieldsOfStudy = '';
      try {
        const query = encodeURIComponent(`${title} ${author}`);
        const s2Res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${query}&limit=1&fields=abstract,citationCount,s2FieldsOfStudy`,
        );
        const s2Data = await s2Res.json();
        if (s2Data.data && s2Data.data.length > 0) {
          const paper = s2Data.data[0];
          academicAbstract = paper.abstract || '';
          citationCount = paper.citationCount || 0;
          fieldsOfStudy =
            paper.s2FieldsOfStudy?.map((f: any) => f.category).join(', ') || '';
        }
      } catch (e) {
        console.error('Semantic Scholar fetch failed', e);
      }

      // 4. Synthesize LLM Enrichment
      let customMetaString = '';
      if (customMetadata && Object.keys(customMetadata).length > 0) {
        customMetaString =
          '\nLibrary Custom Metadata:\n' +
          Object.entries(customMetadata)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
      }

      const rawCombinedData = `
        Title: ${title}
        Author: ${author}
        Google Books Description: ${description}
        OpenLibrary Table of Contents:
        ${toc || 'Not Available'}
        Semantic Scholar Abstract: ${academicAbstract || 'Not Available'}
        Semantic Scholar Citations: ${citationCount}
        Fields of Study: ${fieldsOfStudy}${customMetaString}
      `;
      const llmEnrichment =
        await this.ragService.synthesizeEnrichment(rawCombinedData);

      // 5. Insert Parent Document
      const [parentDoc] = await this.db
        .insert(documents)
        .values({
          title,
          author,
          isbn,
          userId,
          fullEnrichedText: `${title} by ${author}.\n\n${description}`,
          llmEnrichment,
          rawMetadata: {
            google: book,
            toc,
            s2: { academicAbstract, citationCount, fieldsOfStudy },
          },
        } as any)
        .onConflictDoNothing({ target: documents.isbn } as any)
        .returning();

      if (!parentDoc) {
        return {
          message: 'Book already ingested or failed to insert.',
          data: null,
        };
      }

      // 6. Semantic Chunking (Using the LLM Enriched Text instead of the raw description)
      const textChunks = this.chunkText(
        `Title: ${title}\nAuthor: ${author}\n\nEnriched Semantic Profile:\n${llmEnrichment}`,
      );
      const chunksToInsert: any[] = [];

      // 3. Generate Real Embeddings via Gemini
      for (const text of textChunks) {
        const embedding = await this.ragService.generateEmbedding(text);
        chunksToInsert.push({
          parentId: parentDoc.id,
          content: text,
          embedding,
        });
      }

      if (chunksToInsert.length > 0) {
        await this.db.insert(documentChunks).values(chunksToInsert as any);
      }

      return {
        message: 'Automated API enrichment and vectorization completed.',
        data: {
          parentId: parentDoc.id,
          title: parentDoc.title,
          chunksCreated: chunksToInsert.length,
        },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Enrichment ingestion failed: ${error.message}`,
      );
    }
  }

  async getDocuments(userId: string) {
    try {
      const docs = await this.db
        .select()
        .from(documents)
        .where(eq(documents.userId, userId));
      return docs;
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Failed to fetch catalog documents',
      );
    }
  }

  async getQueueStatus(userId: string) {
    try {
      const allJobs = await this.db
        .select({ status: ingestionQueue.status })
        .from(ingestionQueue)
        .where(eq(ingestionQueue.userId, userId));
      const statusCounts = {
        PENDING: 0,
        PROCESSING: 0,
        COMPLETED: 0,
        FAILED: 0,
      };
      for (const job of allJobs) {
        statusCounts[job.status]++;
      }
      return statusCounts;
    } catch (error: any) {
      throw new InternalServerErrorException('Failed to fetch queue status');
    }
  }

  async retryFailedJobs(userId: string) {
    try {
      await this.db
        .update(ingestionQueue)
        .set({ status: 'PENDING', errorMessage: null, updatedAt: new Date() })
        .where(
          sql`${ingestionQueue.userId} = ${userId} AND ${ingestionQueue.status} = 'FAILED'`,
        );
      return { message: 'Failed jobs have been re-queued for processing' };
    } catch (error: any) {
      throw new InternalServerErrorException('Failed to retry jobs');
    }
  }

  async deleteDocument(userId: string, id: string) {
    try {
      // documentChunks are deleted via ON DELETE CASCADE (or we delete them manually if not set up that way)
      // Actually we must delete chunks where parentId = id. We can verify the user owns the doc first.
      const doc = await this.db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      if (!doc || doc.length === 0 || doc[0].userId !== userId) {
        throw new InternalServerErrorException(
          'Document not found or unauthorized',
        );
      }
      await this.db
        .delete(documentChunks)
        .where(eq(documentChunks.parentId, id));
      await this.db.delete(documents).where(eq(documents.id, id));
      return { message: 'Document and its chunks deleted successfully' };
    } catch (error: any) {
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  async queueCsvForIngestion(userId: string, fileBuffer: Buffer) {
    const results: any[] = [];
    const stream = Readable.from(fileBuffer);

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const queueItems = results
            .filter((row) => row.isbn)
            .map((row) => {
              const { isbn, ...customMetadata } = row;
              return {
                isbn,
                userId,
                customMetadata,
                status: 'PENDING' as const,
              };
            });

          if (queueItems.length > 0) {
            await this.db.insert(ingestionQueue).values(queueItems);
          }

          resolve({
            message: `Successfully queued ${queueItems.length} books for ingestion.`,
          });
        })
        .on('error', (error) => {
          reject(new InternalServerErrorException('Failed to parse CSV file'));
        });
    });
  }

  async queueMarcForIngestion(userId: string, fileBuffer: Buffer) {
    const stream = Readable.from(fileBuffer);
    const parser = Marc.createStream('Iso2709', 'Parser');
    const queueItems: any[] = [];

    return new Promise((resolve, reject) => {
      stream
        .pipe(parser)
        .on('data', (record: any) => {
          let isbn = '';
          let title = '';
          let author = '';

          // Iterate through MARC fields
          for (const field of record.fields || []) {
            if (field[0] === '020') {
              const aIndex = field.indexOf('a');
              if (aIndex !== -1 && field.length > aIndex + 1) {
                // Keep only alphanumeric chars for ISBN
                isbn = field[aIndex + 1].replace(/[^0-9X]/gi, '');
              }
            } else if (field[0] === '245') {
              const aIndex = field.indexOf('a');
              if (aIndex !== -1 && field.length > aIndex + 1)
                title = field[aIndex + 1];
            } else if (field[0] === '100') {
              const aIndex = field.indexOf('a');
              if (aIndex !== -1 && field.length > aIndex + 1)
                author = field[aIndex + 1];
            }
          }

          if (isbn) {
            queueItems.push({
              isbn,
              userId,
              customMetadata: {
                marcTitle: title,
                marcAuthor: author,
              },
              status: 'PENDING' as const,
            });
          }
        })
        .on('end', async () => {
          if (queueItems.length > 0) {
            // Bulk inserts have limits, but Drizzle can handle thousands.
            // We'll chunk the insert to be safe if it's massive.
            const chunkSize = 1000;
            for (let i = 0; i < queueItems.length; i += chunkSize) {
              const chunk = queueItems.slice(i, i + chunkSize);
              await this.db.insert(ingestionQueue).values(chunk);
            }
          }
          resolve({
            message: `Successfully queued ${queueItems.length} books from MARC file.`,
          });
        })
        .on('error', (err) => {
          reject(
            new InternalServerErrorException(
              'Failed to parse MARC binary file',
            ),
          );
        });
    });
  }
}
