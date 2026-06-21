import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DRIZZLE_PROVIDER } from '../database/drizzle.provider';
import type { DrizzleDB } from '../database/drizzle.provider';
import { ingestionQueue } from '../database/schema/queue';
import { eq, asc } from 'drizzle-orm';
import { CatalogService } from './catalog.service';

@Injectable()
export class CatalogWorker {
  private readonly logger = new Logger(CatalogWorker.name);
  private isProcessing = false;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly catalogService: CatalogService,
  ) {}

  // Run every 5 seconds. This guarantees max 12 requests per minute,
  // keeping us safely under the 15 RPM free tier limit.
  @Cron('*/5 * * * * *')
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Find the oldest PENDING job
      const [job] = await this.db
        .select()
        .from(ingestionQueue)
        .where(eq(ingestionQueue.status, 'PENDING'))
        .orderBy(asc(ingestionQueue.createdAt))
        .limit(1);

      if (!job) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(`Processing queue job ${job.id} for ISBN ${job.isbn}`);

      // 2. Mark as PROCESSING
      await this.db
        .update(ingestionQueue)
        .set({ status: 'PROCESSING', updatedAt: new Date() })
        .where(eq(ingestionQueue.id, job.id));

      // 3. Process via existing pipeline
      try {
        await this.catalogService.ingestBookByIsbn(
          job.userId,
          job.isbn,
          job.customMetadata as any,
        );

        // 4. Mark as COMPLETED
        await this.db
          .update(ingestionQueue)
          .set({ status: 'COMPLETED', updatedAt: new Date() })
          .where(eq(ingestionQueue.id, job.id));

        this.logger.log(`Successfully completed queue job ${job.id}`);
      } catch (err: any) {
        // 5. Mark as FAILED
        this.logger.error(`Failed to process job ${job.id}`, err.stack);
        await this.db
          .update(ingestionQueue)
          .set({
            status: 'FAILED',
            errorMessage: err.message || 'Unknown error',
            updatedAt: new Date(),
          })
          .where(eq(ingestionQueue.id, job.id));
      }
    } catch (error) {
      this.logger.error('Worker loop failed', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
