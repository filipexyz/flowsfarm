// Config
export {
  getConfig,
  initConfig,
  isInitialized,
  findProjectRoot,
  getProjectRoot,
  setProjectRoot,
  type Config,
} from './config';

// Storage
export { getDb, closeDb, runMigrations, schema } from './storage/db';
export type {
  Connection,
  NewConnection,
  Workflow,
  NewWorkflow,
  SyncHistoryEntry,
  NewSyncHistoryEntry,
  SyncStatus,
} from './storage/schema';

// Types
export type {
  SyncResult,
  ConflictInfo,
  SyncError,
  PullResult,
  PushResult,
  SyncOptions,
  ConnectionConfig,
} from './types';

// Utils
export {
  logger,
  setLogLevel,
  hashContent,
  hashWorkflow,
  generateId,
  encrypt,
  decrypt,
} from './utils';
export type { LogLevel } from './utils';
