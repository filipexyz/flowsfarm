import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// n8n instance connections
export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
});

// Synced workflows
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id),
  remoteId: text('remote_id').notNull(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).default(false),
  contentHash: text('content_hash').notNull(),
  localUpdatedAt: integer('local_updated_at', { mode: 'timestamp' }),
  remoteUpdatedAt: integer('remote_updated_at', { mode: 'timestamp' }),
  syncStatus: text('sync_status', {
    enum: [
      'synced',
      'local_modified',
      'remote_modified',
      'conflict',
      'new_local',
      'deleted_remote',
    ],
  })
    .notNull()
    .default('synced'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Sync history for audit trail
export const syncHistory = sqliteTable('sync_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id),
  workflowId: text('workflow_id'),
  action: text('action', { enum: ['pull', 'push', 'conflict_resolved'] }).notNull(),
  details: text('details'), // JSON with before/after hashes
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Export inferred types
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type SyncHistoryEntry = typeof syncHistory.$inferSelect;
export type NewSyncHistoryEntry = typeof syncHistory.$inferInsert;
export type SyncStatus = Workflow['syncStatus'];
