import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import { getConfig } from '../config';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database | null = null;

export function getDb() {
  if (!db) {
    const config = getConfig();
    const dbPath = config.dbPath;

    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrency
    sqlite.exec('PRAGMA journal_mode = WAL');
    sqlite.exec('PRAGMA foreign_keys = ON');

    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function closeDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export function runMigrations() {
  const database = getDb();

  // Create tables if they don't exist
  sqlite?.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_sync_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES connections(id),
      remote_id TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      content_hash TEXT NOT NULL,
      local_updated_at INTEGER,
      remote_updated_at INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL REFERENCES connections(id),
      workflow_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_connection ON workflows(connection_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_sync_status ON workflows(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_history_connection ON sync_history(connection_id);
  `);

  return database;
}

export { schema };
