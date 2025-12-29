export type {
  Connection,
  NewConnection,
  Workflow,
  NewWorkflow,
  SyncHistoryEntry,
  NewSyncHistoryEntry,
  SyncStatus,
} from '../storage/schema';

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: ConflictInfo[];
  errors: SyncError[];
}

export interface ConflictInfo {
  workflowId: string;
  workflowName: string;
  localHash: string;
  remoteHash: string;
  localUpdatedAt: Date;
  remoteUpdatedAt: Date;
}

export interface SyncError {
  workflowId?: string;
  message: string;
  code: string;
}

export interface PullResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: SyncError[];
}

export interface PushResult {
  total: number;
  created: number;
  updated: number;
  conflicts: ConflictInfo[];
  errors: SyncError[];
}

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  workflowIds?: string[];
}

export interface ConnectionConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}
