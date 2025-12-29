// Client
export { N8nClient, N8nApiError } from './client';

// Types
export type {
  N8nWorkflow,
  N8nNode,
  N8nConnection,
  N8nWorkflowSettings,
  N8nClientConfig,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsOptions,
} from './types';

// Connection management
export {
  testConnection,
  addConnection,
  listConnections,
  getConnection,
  removeConnection,
  updateConnection,
  getClient,
  type ConnectionInfo,
} from './connection';

// Sync engine
export { SyncEngine } from './sync/engine';
export { pullWorkflows, type PullOptions } from './sync/pull';
export { pushWorkflows, type PushOptions } from './sync/push';
export {
  diffWorkflow,
  diffAllWorkflows,
  type WorkflowDiff,
  type FieldChange,
} from './sync/diff';
