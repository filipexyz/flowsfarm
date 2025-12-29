import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash of the given content.
 * Used for detecting changes in workflow content.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively sort object keys for consistent JSON serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
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

  // Sort keys recursively for consistent serialization
  const sorted = sortObjectKeys(normalized);
  const json = JSON.stringify(sorted);
  return hashContent(json);
}

/**
 * Generate a unique ID for new resources.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
