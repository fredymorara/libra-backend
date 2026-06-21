import { Module, Global } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { SearchModule } from '../search/search.module'; // Import SearchModule

@Global()
@Module({
  imports: [SearchModule], // Make the search services available inside this module
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
