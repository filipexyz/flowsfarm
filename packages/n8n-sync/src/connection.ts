import { eq } from 'drizzle-orm';
import {
  getDb,
  schema,
  encrypt,
  decrypt,
  generateId,
  type ConnectionConfig,
} from '@flowsfarm/core';
import { N8nClient } from './client';

export interface ConnectionInfo {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: Date;
  lastSyncAt: Date | null;
}

/**
 * Test connection to an n8n instance.
 */
export async function testConnection(config: {
  baseUrl: string;
  apiKey: string;
}): Promise<boolean> {
  const client = new N8nClient(config);
  return client.testConnection();
}

/**
 * Add a new n8n connection.
 */
export async function addConnection(
  config: ConnectionConfig
): Promise<ConnectionInfo> {
  const db = getDb();

  // Test connection first
  const isValid = await testConnection({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  });

  if (!isValid) {
    throw new Error('Connection test failed. Check URL and API key.');
  }

  // Check for duplicate names
  const existing = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.name, config.name))
    .get();

  if (existing) {
    throw new Error(`Connection with name "${config.name}" already exists`);
  }

  // Create connection
  const id = generateId();
  const encryptedKey = encrypt(config.apiKey);

  db.insert(schema.connections).values({
    id,
    name: config.name,
    baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
    apiKeyEncrypted: encryptedKey,
    createdAt: new Date(),
  }).run();

  return {
    id,
    name: config.name,
    baseUrl: config.baseUrl,
    createdAt: new Date(),
    lastSyncAt: null,
  };
}

/**
 * Get all connections.
 */
export function listConnections(): ConnectionInfo[] {
  const db = getDb();

  const connections = db.select().from(schema.connections).all();

  return connections.map((c) => ({
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl,
    createdAt: c.createdAt,
    lastSyncAt: c.lastSyncAt,
  }));
}

/**
 * Get a connection by ID or name.
 */
export function getConnection(idOrName: string): ConnectionInfo | null {
  const db = getDb();

  // Try by ID first
  let connection = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, idOrName))
    .get();

  // Then by name
  if (!connection) {
    connection = db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.name, idOrName))
      .get();
  }

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    name: connection.name,
    baseUrl: connection.baseUrl,
    createdAt: connection.createdAt,
    lastSyncAt: connection.lastSyncAt,
  };
}

/**
 * Remove a connection.
 */
export function removeConnection(idOrName: string): boolean {
  const db = getDb();

  const connection = getConnection(idOrName);
  if (!connection) {
    return false;
  }

  // Delete associated workflows first
  db.delete(schema.workflows)
    .where(eq(schema.workflows.connectionId, connection.id))
    .run();

  // Delete sync history
  db.delete(schema.syncHistory)
    .where(eq(schema.syncHistory.connectionId, connection.id))
    .run();

  // Delete connection
  db.delete(schema.connections)
    .where(eq(schema.connections.id, connection.id))
    .run();

  return true;
}

/**
 * Update connection settings.
 */
export async function updateConnection(
  idOrName: string,
  updates: Partial<Pick<ConnectionConfig, 'name' | 'baseUrl' | 'apiKey'>>
): Promise<ConnectionInfo | null> {
  const db = getDb();

  const connection = getConnection(idOrName);
  if (!connection) {
    return null;
  }

  const updateData: Partial<typeof schema.connections.$inferInsert> = {};

  if (updates.name) {
    updateData.name = updates.name;
  }

  if (updates.baseUrl) {
    updateData.baseUrl = updates.baseUrl.replace(/\/$/, '');
  }

  if (updates.apiKey) {
    // Test new API key
    const testResult = await testConnection({
      baseUrl: updates.baseUrl || connection.baseUrl,
      apiKey: updates.apiKey,
    });

    if (!testResult) {
      throw new Error('New API key failed validation');
    }

    updateData.apiKeyEncrypted = encrypt(updates.apiKey);
  }

  if (Object.keys(updateData).length > 0) {
    db.update(schema.connections)
      .set(updateData)
      .where(eq(schema.connections.id, connection.id))
      .run();
  }

  return getConnection(connection.id);
}

/**
 * Get the n8n client for a connection.
 */
export function getClient(idOrName: string): N8nClient {
  const db = getDb();

  // Try by ID first
  let connection = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, idOrName))
    .get();

  // Then by name
  if (!connection) {
    connection = db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.name, idOrName))
      .get();
  }

  if (!connection) {
    throw new Error(`Connection not found: ${idOrName}`);
  }

  return new N8nClient({
    baseUrl: connection.baseUrl,
    apiKey: decrypt(connection.apiKeyEncrypted),
  });
}
