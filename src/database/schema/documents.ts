import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  author: text('author'),
  isbn: text('isbn').unique(),
  rawMetadata: jsonb('raw_metadata').default({}).notNull(), // Stores MARC 505 logs, TOC arrays, etc.
  fullEnrichedText: text('full_enriched_text'),
  llmEnrichment: text('llm_enrichment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
