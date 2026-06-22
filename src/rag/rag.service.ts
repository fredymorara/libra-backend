import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, streamText, generateObject } from 'ai';
import { z } from 'zod';

@Injectable()
export class RagService {
  private readonly googleClient: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>(
      'GOOGLE_GENERATIVE_AI_API_KEY',
    );
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GOOGLE_GENERATIVE_AI_API_KEY is missing',
      );
    }

    this.googleClient = createGoogleGenerativeAI({ apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: this.googleClient.textEmbeddingModel('gemini-embedding-2'),
        value: text,
      });
      return embedding;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(
        `Embedding generation failed: ${msg}`,
      );
    }
  }

  async synthesizeEnrichment(rawMetadata: string): Promise<string> {
    try {
      const { object } = await generateObject({
        model: this.googleClient('gemini-2.5-flash'),
        schema: z.object({
          enrichedProfile: z
            .string()
            .describe(
              'A deeply semantic, highly structured enrichment profile of the book/paper including core themes, academic context, and expanded concepts. Output in clean Markdown.',
            ),
        }),
        prompt: `You are an expert academic librarian and semantic data structurer. 
Analyze the following raw data collected from Google Books, OpenLibrary, and Semantic Scholar.
Synthesize it into a unified, rich profile representing your full semantic understanding of the text.
If any section (like TOC or abstract) is missing, infer the broader academic context.

Raw Data:
${rawMetadata}`,
      });
      return object.enrichedProfile;
    } catch {
      console.error('LLM synthesis failed');
      // Fallback to the raw metadata if LLM fails
      return rawMetadata;
    }
  }

  // Phase A: Query Transformation
  async transformQuery(query: string): Promise<string[]> {
    try {
      const { object } = await generateObject({
        model: this.googleClient('gemini-2.5-flash'),
        schema: z.object({
          queries: z
            .array(z.string())
            .describe('List of expanded search facets/queries'),
        }),
        prompt: `You are an expert librarian. A user has asked: "${query}". Generate 3 distinct expanded search queries to capture different facets of this topic for a semantic search engine.`,
      });
      return [query, ...object.queries]; // Include the original query
    } catch {
      return [query]; // Fallback if LLM fails
    }
  }

  // Phase D: Cross-Encoder Re-ranking
  async rerankChunks(query: string, chunks: any[]): Promise<any[]> {
    if (chunks.length === 0) return chunks;

    try {
      const prompt = `
        Evaluate the relevance of the following library catalog chunks to the user's query: "${query}".
        Return the IDs of the top 5 most relevant chunks, ordered from most relevant to least.
        
        Chunks:
        ${chunks.map((c: any, i: number) => `ID: ${i} | Text: ${String(c.content)}`).join('\n\n')}
      `;

      const { object } = await generateObject({
        model: this.googleClient('gemini-2.5-flash'),
        schema: z.object({
          top_ids: z.array(z.number()),
        }),
        prompt,
      });

      const reranked = object.top_ids
        .map((id) => chunks[id])
        .filter((c) => c !== undefined);
      return reranked.length > 0 ? reranked : chunks.slice(0, 5);
    } catch {
      return chunks.slice(0, 5); // Fallback
    }
  }

  streamChat(userQuery: string, retrievedContext: string): any {
    try {
      const systemPrompt = `
        You are an advanced Smart Library Assistant helping researchers discover books and papers via content understanding.
        
        Using the highly relevant library catalog context provided below, synthesize a helpful, comprehensive response.
        If specific chapters or page guidelines are present in the context, explicitly call them out to guide the user (e.g., "See Chapter 3 for...").
        
        If the context does not contain enough information to answer the query accurately, state that the resource is not explicitly in the catalog, but offer a conceptual overview.

        Context:
        ${retrievedContext}
      `;

      const result = streamText({
        model: this.googleClient('gemini-2.5-flash'),
        system: systemPrompt,
        prompt: userQuery,
      });

      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(
        `LLM generation streaming failed: ${msg}`,
      );
    }
  }
}
