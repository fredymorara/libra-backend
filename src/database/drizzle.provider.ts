import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as usersSchema from './schema/users';
import * as documentsSchema from './schema/documents';
import * as chunksSchema from './schema/chunks';

// Combined database schema for global type inference
export const appSchema = {
  ...usersSchema,
  ...documentsSchema,
  ...chunksSchema,
};

export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

export const DrizzleProvider: Provider = {
  provide: DRIZZLE_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing');
    }

    // Serverless HTTP connection client tailored for Neon
    const sql = neon(connectionString);
    return drizzle(sql, { schema: appSchema });
  },
};

export type DrizzleDB = ReturnType<typeof drizzle<typeof appSchema>>;
