import {
  pgTable,
  uuid,
  text,
  customType,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { documents } from './documents';

// Type-safe mapping for pgvector arrays inside Drizzle ORM
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(3072)'; // Fixed dimensions matching Gemini gemini-embedding-2 models
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return value
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(Number);
    }
    return value as number[];
  },
});

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }), // Cascades deletions automatically
    content: text('content').notNull(),
    embedding: vector('embedding').notNull(),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('english', content)`,
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('search_vector_idx').using('gin', table.searchVector)],
);

// Explicit table relations declaration
export const chunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.parentId],
    references: [documents.id],
  }),
}));
