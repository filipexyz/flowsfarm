import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import {
  getDb,
  getConfig,
  hashWorkflow,
  generateId,
  schema,
  logger,
  type PullResult,
  type SyncError,
} from '@flowsfarm/core';
import { N8nClient } from '../client';
import type { N8nWorkflow } from '../types';

export interface PullOptions {
  connectionId: string;
  workflowIds?: string[];
  force?: boolean;
}

export async function pullWorkflows(
  client: N8nClient,
  options: PullOptions
): Promise<PullResult> {
  const db = getDb();
  const config = getConfig();

  const result: PullResult = {
    total: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  try {
    // Fetch workflows from n8n
    logger.info('Fetching workflows from n8n...');
    let remoteWorkflows: N8nWorkflow[];

    if (options.workflowIds && options.workflowIds.length > 0) {
      // Fetch specific workflows
      remoteWorkflows = await Promise.all(
        options.workflowIds.map((id) => client.getWorkflow(id))
      );
    } else {
      // Fetch all workflows
      remoteWorkflows = await client.listAllWorkflows();
    }

    result.total = remoteWorkflows.length;
    logger.info(`Found ${remoteWorkflows.length} workflows`);

    // Ensure workflows directory exists
    const connectionWorkflowsDir = join(
      config.workflowsPath,
      options.connectionId
    );
    if (!existsSync(connectionWorkflowsDir)) {
      mkdirSync(connectionWorkflowsDir, { recursive: true });
    }

    // Process each workflow
    for (const remoteWorkflow of remoteWorkflows) {
      try {
        await processWorkflow(
          db,
          remoteWorkflow,
          options.connectionId,
          connectionWorkflowsDir,
          options.force ?? false,
          result
        );
      } catch (error) {
        const syncError: SyncError = {
          workflowId: remoteWorkflow.id,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PULL_ERROR',
        };
        result.errors.push(syncError);
        logger.error(`Error processing workflow ${remoteWorkflow.id}:`, error);
      }
    }

    // Record sync in history
    db.insert(schema.syncHistory).values({
      connectionId: options.connectionId,
      action: 'pull',
      details: JSON.stringify({
        total: result.total,
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
        errors: result.errors.length,
      }),
      createdAt: new Date(),
    }).run();

    // Update connection's lastSyncAt
    db.update(schema.connections)
      .set({ lastSyncAt: new Date() })
      .where(eq(schema.connections.id, options.connectionId))
      .run();

    return result;
  } catch (error) {
    logger.error('Pull failed:', error);
    throw error;
  }
}

async function processWorkflow(
  db: ReturnType<typeof getDb>,
  remoteWorkflow: N8nWorkflow,
  connectionId: string,
  workflowsDir: string,
  force: boolean,
  result: PullResult
): Promise<void> {
  const remoteHash = hashWorkflow(remoteWorkflow as unknown as Record<string, unknown>);
  const workflowDir = join(workflowsDir, remoteWorkflow.id);

  // Check if workflow exists locally
  const existing = db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.remoteId, remoteWorkflow.id))
    .get();

  if (existing) {
    // Check if content has changed
    if (existing.contentHash === remoteHash && !force) {
      result.unchanged++;
      logger.debug(`Workflow ${remoteWorkflow.name} unchanged`);
      return;
    }

    // Check for conflicts (local changes vs remote changes)
    if (
      existing.syncStatus === 'local_modified' &&
      existing.contentHash !== remoteHash &&
      !force
    ) {
      // Update status to conflict
      db.update(schema.workflows)
        .set({
          syncStatus: 'conflict',
          remoteUpdatedAt: new Date(remoteWorkflow.updatedAt),
        })
        .where(eq(schema.workflows.id, existing.id))
        .run();

      // Save remote version separately for conflict resolution
      const conflictDir = join(workflowDir, '.conflict');
      if (!existsSync(conflictDir)) {
        mkdirSync(conflictDir, { recursive: true });
      }
      writeFileSync(
        join(conflictDir, 'remote.json'),
        JSON.stringify(remoteWorkflow, null, 2)
      );

      logger.warn(`Conflict detected for workflow ${remoteWorkflow.name}`);
      return;
    }

    // Update existing workflow
    db.update(schema.workflows)
      .set({
        name: remoteWorkflow.name,
        active: remoteWorkflow.active,
        contentHash: remoteHash,
        remoteUpdatedAt: new Date(remoteWorkflow.updatedAt),
        localUpdatedAt: new Date(),
        syncStatus: 'synced',
      })
      .where(eq(schema.workflows.id, existing.id))
      .run();

    result.updated++;
    logger.info(`Updated workflow: ${remoteWorkflow.name}`);
  } else {
    // Create new workflow record
    const workflowId = generateId();

    db.insert(schema.workflows).values({
      id: workflowId,
      connectionId,
      remoteId: remoteWorkflow.id,
      name: remoteWorkflow.name,
      active: remoteWorkflow.active,
      contentHash: remoteHash,
      remoteUpdatedAt: new Date(remoteWorkflow.updatedAt),
      localUpdatedAt: new Date(),
      syncStatus: 'synced',
      createdAt: new Date(),
    }).run();

    result.created++;
    logger.info(`Created workflow: ${remoteWorkflow.name}`);
  }

  // Save workflow JSON to file
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }

  writeFileSync(
    join(workflowDir, 'workflow.json'),
    JSON.stringify(remoteWorkflow, null, 2)
  );

  // Save metadata
  writeFileSync(
    join(workflowDir, 'meta.json'),
    JSON.stringify(
      {
        remoteId: remoteWorkflow.id,
        name: remoteWorkflow.name,
        active: remoteWorkflow.active,
        pulledAt: new Date().toISOString(),
        remoteUpdatedAt: remoteWorkflow.updatedAt,
      },
      null,
      2
    )
  );
}
