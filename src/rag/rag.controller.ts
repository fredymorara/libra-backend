import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { RagService } from './rag.service';
import { SearchService } from '../search/search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly searchService: SearchService, // Inject the context retriever
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chatStream(
    @Req() req: { user: { userId: string } },
    @Body('messages') messages: { role: string; content: string }[],
    @Res() res: Response,
  ) {
    if (!messages || messages.length === 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Messages array is required' });
    }

    const latestMessage = messages.at(-1);
    const query = latestMessage?.content;

    if (!query) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Query string is required' });
    }

    // 1. Retrieve the exact child chunks and linked parents from Neon

    const searchResults = await this.searchService.hybridSearch(
      req.user.userId,
      query,
    );

    // 2. Format results into a highly structured prompt context block for Gemini
    let compiledContext = '';
    if (searchResults.length === 0) {
      compiledContext =
        'No direct library catalog matches were found for this query.';
    } else {
      compiledContext = searchResults
        .map(
          (
            result: {
              parentTitle?: string;
              parentAuthor?: string;
              parentIsbn?: string;
              content?: string;
            },
            index: number,
          ) => `
          Match [${index + 1}]:
          - Book Title: ${String(result.parentTitle)}
          - Author: ${String(result.parentAuthor)}
          - ISBN: ${String(result.parentIsbn)}
          - Relevant Section Text: "${String(result.content)}"
        `,
        )
        .join('\n\n');
    }

    // 3. Initiate the text stream from the Vercel AI SDK
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const streamResult = this.ragService.streamChat(query, compiledContext);

    // 4. Flush chunk tokens immediately out to the React frontend
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for await (const textChunk of streamResult.textStream) {
        res.write(textChunk as string);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      res.write('\\n\\n[Error: Connection to AI provider failed or was interrupted]');
    } finally {
      res.end();
    }
  }
}
