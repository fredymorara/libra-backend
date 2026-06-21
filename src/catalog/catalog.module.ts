import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogWorker } from './catalog.worker';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogWorker],
})
export class CatalogModule {}
