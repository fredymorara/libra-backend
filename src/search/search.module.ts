import { Module } from '@nestjs/common';
import { SearchService } from './search.service';

@Module({
  providers: [SearchService],
  exports: [SearchService], // Export so RagController can utilize it
})
export class SearchModule {}
