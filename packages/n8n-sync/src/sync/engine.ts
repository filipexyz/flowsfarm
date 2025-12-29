import { eq } from 'drizzle-orm';
import {
  getDb,
  schema,
  decrypt,
  logger,
  type SyncResult,
  type ConflictInfo,
  type SyncOptions,
} from '@flowsfarm/core';
import { N8nClient } from '../client';
import { pullWorkflows, type PullOptions } from './pull';
import { pushWorkflows, type PushOptions } from './push';

export class SyncEngine {
  private connectionId: string;
  private client: N8nClient;

  constructor(connectionId: string) {
    this.connectionId = connectionId;

    // Load connection and create client
    const db = getDb();
    const connection = db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, connectionId))
      .get();

    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const apiKey = decrypt(connection.apiKeyEncrypted);

    this.client = new N8nClient({
      baseUrl: connection.baseUrl,
      apiKey,
    });
  }

  /**
   * Full sync: pull then push.
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    logger.info('Starting sync...');

    // Pull first
    const pullOptions: PullOptions = {
      connectionId: this.connectionId,
      workflowIds: options.workflowIds,
      force: options.force,
    };
    const pullResult = await pullWorkflows(this.client, pullOptions);

    // Then push local changes
    const pushOptions: PushOptions = {
      connectionId: this.connectionId,
      workflowIds: options.workflowIds,
      force: options.force,
    };
    const pushResult = await pushWorkflows(this.client, pushOptions);

    // Combine results
    const result: SyncResult = {
      pulled: pullResult.created + pullResult.updated,
      pushed: pushResult.created + pushResult.updated,
      conflicts: pushResult.conflicts,
      errors: [...pullResult.errors, ...pushResult.errors],
    };

    logger.info(
      `Sync complete: ${result.pulled} pulled, ${result.pushed} pushed, ${result.conflicts.length} conflicts`
    );

    return result;
  }

  /**
   * Pull workflows from remote.
   */
  async pull(options: Omit<PullOptions, 'connectionId'> = {}) {
    return pullWorkflows(this.client, {
      ...options,
      connectionId: this.connectionId,
    });
  }

  /**
   * Push local changes to remote.
   */
  async push(options: Omit<PushOptions, 'connectionId'> = {}) {
    return pushWorkflows(this.client, {
      ...options,
      connectionId: this.connectionId,
    });
  }

  /**
   * Get current sync status.
   */
  getStatus() {
    const db = getDb();

    const workflows = db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.connectionId, this.connectionId))
      .all();

    const statusCounts = {
      total: workflows.length,
      synced: 0,
      localModified: 0,
      remoteModified: 0,
      conflict: 0,
      newLocal: 0,
      deletedRemote: 0,
    };

    for (const workflow of workflows) {
      switch (workflow.syncStatus) {
        case 'synced':
          statusCounts.synced++;
          break;
        case 'local_modified':
          statusCounts.localModified++;
          break;
        case 'remote_modified':
          statusCounts.remoteModified++;
          break;
        case 'conflict':
          statusCounts.conflict++;
          break;
        case 'new_local':
          statusCounts.newLocal++;
          break;
        case 'deleted_remote':
          statusCounts.deletedRemote++;
          break;
      }
    }

    return {
      connectionId: this.connectionId,
      ...statusCounts,
    };
  }

  /**
   * Get list of conflicts.
   */
  getConflicts(): ConflictInfo[] {
    const db = getDb();

    const conflictedWorkflows = db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.syncStatus, 'conflict'))
      .all();

    return conflictedWorkflows.map((w) => ({
      workflowId: w.id,
      workflowName: w.name,
      localHash: w.contentHash,
      remoteHash: '', // Would need to fetch from remote
      localUpdatedAt: w.localUpdatedAt ?? new Date(),
      remoteUpdatedAt: w.remoteUpdatedAt ?? new Date(),
    }));
  }

  /**
   * Resolve a conflict by keeping local or remote version.
   */
  async resolveConflict(
    workflowId: string,
    resolution: 'keep-local' | 'keep-remote'
  ): Promise<void> {
    const db = getDb();

    const workflow = db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.id, workflowId))
      .get();

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.syncStatus !== 'conflict') {
      throw new Error(`Workflow is not in conflict state`);
    }

    if (resolution === 'keep-local') {
      // Push local version, overwriting remote
      await pushWorkflows(this.client, {
        connectionId: this.connectionId,
        workflowIds: [workflowId],
        force: true,
      });
    } else {
      // Pull remote version, overwriting local
      await pullWorkflows(this.client, {
        connectionId: this.connectionId,
        workflowIds: [workflow.remoteId],
        force: true,
      });
    }

    // Record resolution
    db.insert(schema.syncHistory).values({
      connectionId: this.connectionId,
      workflowId,
      action: 'conflict_resolved',
      details: JSON.stringify({ resolution }),
      createdAt: new Date(),
    }).run();

    logger.info(`Conflict resolved for ${workflow.name}: ${resolution}`);
  }
}
