import { Module, Global } from '@nestjs/common';
import { DrizzleProvider, DRIZZLE_PROVIDER } from './drizzle.provider';

@Global()
@Module({
  providers: [DrizzleProvider],
  exports: [DRIZZLE_PROVIDER],
})
export class DatabaseModule {}
