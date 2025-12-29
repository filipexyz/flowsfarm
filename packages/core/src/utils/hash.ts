import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash of the given content.
 * Used for detecting changes in workflow content.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Hash a workflow object for change detection.
 * Normalizes the object to ensure consistent hashing.
 */
export function hashWorkflow(workflow: Record<string, unknown>): string {
  // Remove fields that change on every API call but don't represent actual changes
  const normalized = {
    ...workflow,
    updatedAt: undefined,
    createdAt: undefined,
    id: undefined,
  };

  const json = JSON.stringify(normalized, Object.keys(normalized).sort());
  return hashContent(json);
}

/**
 * Generate a unique ID for new resources.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
