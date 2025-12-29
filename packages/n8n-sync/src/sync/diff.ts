import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
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
  filePath: string;
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

    // Compare nodes in detail
    const localNodesMap = new Map(localWorkflow.nodes.map((n) => [n.id || n.name, n]));
    const remoteNodesMap = new Map(remoteWorkflow.nodes.map((n) => [n.id || n.name, n]));

    // Find added/modified nodes (in local but different from remote)
    for (const [nodeId, localNode] of localNodesMap) {
      const remoteNode = remoteNodesMap.get(nodeId);
      if (!remoteNode) {
        changes.push({
          path: `node "${localNode.name}"`,
          type: 'added',
          localValue: localNode.type,
        });
      } else {
        // Compare node content
        const localJson = JSON.stringify(localNode);
        const remoteJson = JSON.stringify(remoteNode);
        if (localJson !== remoteJson) {
          // Find specific differences
          if (localNode.name !== remoteNode.name) {
            changes.push({
              path: `node "${remoteNode.name}".name`,
              type: 'modified',
              localValue: localNode.name,
              remoteValue: remoteNode.name,
            });
          }
          // Compare parameters in detail
          const localParams = localNode.parameters || {};
          const remoteParams = remoteNode.parameters || {};
          const allParamKeys = new Set([...Object.keys(localParams), ...Object.keys(remoteParams)]);

          for (const key of allParamKeys) {
            const localVal = JSON.stringify(localParams[key]);
            const remoteVal = JSON.stringify(remoteParams[key]);
            if (localVal !== remoteVal) {
              if (localParams[key] === undefined) {
                changes.push({
                  path: `node "${localNode.name}".${key}`,
                  type: 'removed',
                  remoteValue: remoteParams[key],
                });
              } else if (remoteParams[key] === undefined) {
                changes.push({
                  path: `node "${localNode.name}".${key}`,
                  type: 'added',
                  localValue: localParams[key],
                });
              } else {
                changes.push({
                  path: `node "${localNode.name}".${key}`,
                  type: 'modified',
                  localValue: localParams[key],
                  remoteValue: remoteParams[key],
                });
              }
            }
          }
          // Ignore position changes - just visual, doesn't affect logic
        }
      }
    }

    // Find removed nodes (in remote but not local)
    for (const [nodeId, remoteNode] of remoteNodesMap) {
      if (!localNodesMap.has(nodeId)) {
        changes.push({
          path: `node "${remoteNode.name}"`,
          type: 'removed',
          remoteValue: remoteNode.type,
        });
      }
    }

    // Compare connections
    const localConns = JSON.stringify(localWorkflow.connections);
    const remoteConns = JSON.stringify(remoteWorkflow.connections);
    if (localConns !== remoteConns) {
      changes.push({
        path: 'connections',
        type: 'modified',
        localValue: localWorkflow.connections,
        remoteValue: remoteWorkflow.connections,
      });
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
    filePath: relative(process.cwd(), workflowPath),
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
