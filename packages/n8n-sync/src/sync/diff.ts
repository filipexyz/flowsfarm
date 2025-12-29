import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import {
  getDb,
  getConfig,
  hashWorkflow,
  schema,
  decrypt,
} from '@flowsfarm/core';
import { N8nClient } from '../client';
import type { N8nWorkflow } from '../types';

export interface WorkflowDiff {
  workflowId: string;
  workflowName: string;
  remoteId: string;
  hasChanges: boolean;
  localHash: string;
  remoteHash: string | null;
  changes: FieldChange[];
}

export interface FieldChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  localValue?: unknown;
  remoteValue?: unknown;
}

/**
 * Compare local workflow with remote version.
 */
export async function diffWorkflow(
  connectionId: string,
  workflowId: string
): Promise<WorkflowDiff | null> {
  const db = getDb();
  const config = getConfig();

  // Get local workflow record
  const localRecord = db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.id, workflowId))
    .get();

  if (!localRecord) {
    return null;
  }

  // Get connection for API access
  const connection = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, connectionId))
    .get();

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  // Read local workflow file
  const workflowPath = join(
    config.workflowsPath,
    connectionId,
    localRecord.remoteId,
    'workflow.json'
  );

  if (!existsSync(workflowPath)) {
    throw new Error(`Local workflow file not found: ${workflowPath}`);
  }

  const localContent = readFileSync(workflowPath, 'utf-8');
  const localWorkflow = JSON.parse(localContent) as N8nWorkflow;
  const localHash = hashWorkflow(localWorkflow as unknown as Record<string, unknown>);

  // Fetch remote workflow
  const client = new N8nClient({
    baseUrl: connection.baseUrl,
    apiKey: decrypt(connection.apiKeyEncrypted),
  });

  let remoteWorkflow: N8nWorkflow | null = null;
  let remoteHash: string | null = null;

  try {
    remoteWorkflow = await client.getWorkflow(localRecord.remoteId);
    remoteHash = hashWorkflow(remoteWorkflow as unknown as Record<string, unknown>);
  } catch {
    // Remote workflow might not exist
  }

  // Calculate changes
  const changes: FieldChange[] = [];

  if (remoteWorkflow) {
    // Compare key fields
    if (localWorkflow.name !== remoteWorkflow.name) {
      changes.push({
        path: 'name',
        type: 'modified',
        localValue: localWorkflow.name,
        remoteValue: remoteWorkflow.name,
      });
    }

    if (localWorkflow.active !== remoteWorkflow.active) {
      changes.push({
        path: 'active',
        type: 'modified',
        localValue: localWorkflow.active,
        remoteValue: remoteWorkflow.active,
      });
    }

    // Compare nodes (simplified - just count)
    if (localWorkflow.nodes.length !== remoteWorkflow.nodes.length) {
      changes.push({
        path: 'nodes',
        type: 'modified',
        localValue: `${localWorkflow.nodes.length} nodes`,
        remoteValue: `${remoteWorkflow.nodes.length} nodes`,
      });
    } else {
      // Check for node-level changes
      const localNodeIds = new Set(localWorkflow.nodes.map((n) => n.id || n.name));
      const remoteNodeIds = new Set(remoteWorkflow.nodes.map((n) => n.id || n.name));

      for (const nodeId of localNodeIds) {
        if (!remoteNodeIds.has(nodeId)) {
          changes.push({
            path: `nodes.${nodeId}`,
            type: 'added',
            localValue: nodeId,
          });
        }
      }

      for (const nodeId of remoteNodeIds) {
        if (!localNodeIds.has(nodeId)) {
          changes.push({
            path: `nodes.${nodeId}`,
            type: 'removed',
            remoteValue: nodeId,
          });
        }
      }
    }

    // Compare settings
    const localSettings = JSON.stringify(localWorkflow.settings);
    const remoteSettings = JSON.stringify(remoteWorkflow.settings);
    if (localSettings !== remoteSettings) {
      changes.push({
        path: 'settings',
        type: 'modified',
        localValue: localWorkflow.settings,
        remoteValue: remoteWorkflow.settings,
      });
    }
  }

  return {
    workflowId: localRecord.id,
    workflowName: localRecord.name,
    remoteId: localRecord.remoteId,
    hasChanges: localHash !== remoteHash,
    localHash,
    remoteHash,
    changes,
  };
}

/**
 * Get diff summary for all workflows in a connection.
 */
export async function diffAllWorkflows(
  connectionId: string
): Promise<WorkflowDiff[]> {
  const db = getDb();

  const workflows = db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.connectionId, connectionId))
    .all();

  const diffs: WorkflowDiff[] = [];

  for (const workflow of workflows) {
    const diff = await diffWorkflow(connectionId, workflow.id);
    if (diff) {
      diffs.push(diff);
    }
  }

  return diffs;
}
