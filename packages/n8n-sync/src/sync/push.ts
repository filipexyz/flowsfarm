import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import {
  getDb,
  getConfig,
  hashWorkflow,
  schema,
  logger,
  type PushResult,
  type ConflictInfo,
  type SyncError,
} from '@flowsfarm/core';
import { N8nClient } from '../client';
import type { N8nWorkflow, UpdateWorkflowInput } from '../types';

export interface PushOptions {
  connectionId: string;
  workflowIds?: string[];
  force?: boolean;
}

/**
 * Check if a local workflow file has changed compared to stored hash.
 */
function hasLocalChanges(
  workflow: typeof schema.workflows.$inferSelect,
  workflowsDir: string
): boolean {
  const workflowPath = join(workflowsDir, workflow.remoteId, 'workflow.json');

  if (!existsSync(workflowPath)) {
    return false;
  }

  try {
    const content = readFileSync(workflowPath, 'utf-8');
    const data = JSON.parse(content) as Record<string, unknown>;
    const currentHash = hashWorkflow(data);
    return currentHash !== workflow.contentHash;
  } catch {
    return false;
  }
}

export async function pushWorkflows(
  client: N8nClient,
  options: PushOptions
): Promise<PushResult> {
  const db = getDb();
  const config = getConfig();

  const result: PushResult = {
    total: 0,
    created: 0,
    updated: 0,
    conflicts: [],
    errors: [],
  };

  try {
    const connectionWorkflowsDir = join(
      config.workflowsPath,
      options.connectionId
    );

    // Get all workflows for this connection
    let allWorkflows = db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.connectionId, options.connectionId))
      .all();

    // Filter by specific workflow IDs if provided
    if (options.workflowIds && options.workflowIds.length > 0) {
      allWorkflows = allWorkflows.filter((w) =>
        options.workflowIds!.includes(w.id) ||
        options.workflowIds!.includes(w.remoteId)
      );
    }

    // Find workflows that need to be pushed:
    // 1. syncStatus is 'local_modified' OR
    // 2. Local file hash differs from stored hash (detects direct file edits)
    const workflowsToSync = options.force
      ? allWorkflows
      : allWorkflows.filter((w) =>
          w.syncStatus === 'local_modified' ||
          w.syncStatus === 'new_local' ||
          hasLocalChanges(w, connectionWorkflowsDir)
        );

    result.total = workflowsToSync.length;
    logger.info(`Found ${workflowsToSync.length} workflows to push`);

    // Process each workflow
    for (const localWorkflow of workflowsToSync) {
      try {
        await processWorkflowPush(
          db,
          client,
          localWorkflow,
          connectionWorkflowsDir,
          options.force ?? false,
          result
        );
      } catch (error) {
        const syncError: SyncError = {
          workflowId: localWorkflow.id,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PUSH_ERROR',
        };
        result.errors.push(syncError);
        logger.error(
          `Error pushing workflow ${localWorkflow.name}:`,
          error
        );
      }
    }

    // Record sync in history
    db.insert(schema.syncHistory).values({
      connectionId: options.connectionId,
      action: 'push',
      details: JSON.stringify({
        total: result.total,
        created: result.created,
        updated: result.updated,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
      }),
      createdAt: new Date(),
    }).run();

    return result;
  } catch (error) {
    logger.error('Push failed:', error);
    throw error;
  }
}

async function processWorkflowPush(
  db: ReturnType<typeof getDb>,
  client: N8nClient,
  localWorkflow: typeof schema.workflows.$inferSelect,
  workflowsDir: string,
  force: boolean,
  result: PushResult
): Promise<void> {
  const workflowDir = join(workflowsDir, localWorkflow.remoteId);
  const workflowPath = join(workflowDir, 'workflow.json');

  if (!existsSync(workflowPath)) {
    throw new Error(`Workflow file not found: ${workflowPath}`);
  }

  // Read local workflow content
  const localContent = readFileSync(workflowPath, 'utf-8');
  const localWorkflowData = JSON.parse(localContent) as N8nWorkflow;

  // Check remote for conflicts (unless force)
  if (!force) {
    try {
      const remoteWorkflow = await client.getWorkflow(localWorkflow.remoteId);
      const remoteHash = hashWorkflow(
        remoteWorkflow as unknown as Record<string, unknown>
      );

      // Read local file hash for comparison
      const localFileContent = readFileSync(workflowPath, 'utf-8');
      const localFileData = JSON.parse(localFileContent) as Record<string, unknown>;
      const localFileHash = hashWorkflow(localFileData);

      // Conflict exists if:
      // 1. Remote hash differs from what we stored (remote was modified)
      // 2. AND local file hash differs from stored (local was modified)
      // If only local changed, no conflict - just push
      // If only remote changed, would be caught by pull
      const remoteChanged = remoteHash !== localWorkflow.contentHash;
      const localChanged = localFileHash !== localWorkflow.contentHash;

      if (remoteChanged && localChanged) {
        const conflict: ConflictInfo = {
          workflowId: localWorkflow.id,
          workflowName: localWorkflow.name,
          localHash: localFileHash,
          remoteHash,
          localUpdatedAt: localWorkflow.localUpdatedAt ?? new Date(),
          remoteUpdatedAt: new Date(remoteWorkflow.updatedAt),
        };
        result.conflicts.push(conflict);

        // Update status to conflict
        db.update(schema.workflows)
          .set({ syncStatus: 'conflict' })
          .where(eq(schema.workflows.id, localWorkflow.id))
          .run();

        logger.warn(`Conflict detected for workflow ${localWorkflow.name}`);
        return;
      }
    } catch (error) {
      // If workflow doesn't exist remotely, we'll create it
      logger.debug(
        `Remote workflow not found, will create: ${localWorkflow.name}`
      );
    }
  }

  // Prepare update payload (remove read-only fields)
  const updatePayload: UpdateWorkflowInput = {
    name: localWorkflowData.name,
    nodes: localWorkflowData.nodes,
    connections: localWorkflowData.connections,
    settings: localWorkflowData.settings,
    staticData: localWorkflowData.staticData,
  };

  // Push to remote
  const updatedWorkflow = await client.updateWorkflow(
    localWorkflow.remoteId,
    updatePayload
  );

  // Update local record
  const newHash = hashWorkflow(
    updatedWorkflow as unknown as Record<string, unknown>
  );

  db.update(schema.workflows)
    .set({
      contentHash: newHash,
      remoteUpdatedAt: new Date(updatedWorkflow.updatedAt),
      syncStatus: 'synced',
    })
    .where(eq(schema.workflows.id, localWorkflow.id))
    .run();

  result.updated++;
  logger.info(`Pushed workflow: ${localWorkflow.name}`);
}
