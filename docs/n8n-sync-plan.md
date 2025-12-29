# n8n Sync Feature - Implementation Plan

## Overview

A local-first synchronization system that downloads and manages n8n workflows locally, enabling offline access, version control, and bi-directional sync with n8n instances.

## Goals

1. **Local-first**: All workflow data stored locally, works offline
2. **Bi-directional sync**: Pull from n8n, push changes back
3. **Conflict detection**: Identify when local and remote diverge
4. **Multi-instance**: Support multiple n8n accounts/instances

---

## n8n REST API Reference

### Authentication
- Header: `X-N8N-API-KEY: <api-key>`
- API keys generated from n8n Settings

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workflows` | List all workflows |
| GET | `/api/v1/workflows/{id}` | Get single workflow |
| POST | `/rest/workflows` | Create workflow |
| PATCH | `/rest/workflows/{id}` | Update workflow |
| DELETE | `/workflows/{id}` | Delete workflow |

### Workflow Object Structure
```typescript
interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, NodeConnection>;
  settings: WorkflowSettings;
  staticData: unknown | null;
  tags: string[];
  createdAt: string;  // ISO timestamp
  updatedAt: string;  // ISO timestamp
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FlowsFarm CLI/UI                       │
├─────────────────────────────────────────────────────────────┤
│                      Sync Engine                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Pull Service│  │ Push Service│  │ Conflict Resolver   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    n8n API Client                           │
├──────────────────────┬──────────────────────────────────────┤
│   Local Storage      │         Remote n8n Instance(s)       │
│  ┌────────────────┐  │                                      │
│  │ SQLite DB      │  │   ┌─────────┐  ┌─────────┐           │
│  │ Workflow Files │  │   │ n8n #1  │  │ n8n #2  │  ...      │
│  │ Sync Metadata  │  │   └─────────┘  └─────────┘           │
│  └────────────────┘  │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Project Structure

```
flowsfarm/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config/
│   │   └── index.ts             # Configuration management
│   ├── n8n/
│   │   ├── client.ts            # n8n API client
│   │   ├── types.ts             # n8n type definitions
│   │   └── auth.ts              # Authentication handling
│   ├── sync/
│   │   ├── engine.ts            # Main sync orchestrator
│   │   ├── pull.ts              # Pull workflows from n8n
│   │   ├── push.ts              # Push workflows to n8n
│   │   ├── diff.ts              # Workflow diffing
│   │   └── conflict.ts          # Conflict detection/resolution
│   ├── storage/
│   │   ├── db.ts                # SQLite database layer
│   │   ├── files.ts             # File system operations
│   │   └── schema.ts            # Database schema
│   ├── cli/
│   │   ├── index.ts             # CLI entry point
│   │   └── commands/
│   │       ├── init.ts          # flowsfarm init
│   │       ├── connect.ts       # flowsfarm connect <n8n-url>
│   │       ├── pull.ts          # flowsfarm pull
│   │       ├── push.ts          # flowsfarm push
│   │       ├── status.ts        # flowsfarm status
│   │       └── diff.ts          # flowsfarm diff
│   └── utils/
│       ├── logger.ts
│       └── hash.ts              # Content hashing for change detection
├── data/                        # Local data directory (gitignored)
│   ├── flowsfarm.db             # SQLite database
│   └── workflows/               # Workflow JSON files
├── package.json
├── tsconfig.json
└── .flowsfarm.json              # Project config (connections, settings)
```

---

## Data Models

### Local Database Schema (SQLite)

```sql
-- n8n instance connections
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_sync_at DATETIME
);

-- Synced workflows
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  content_hash TEXT NOT NULL,
  local_updated_at DATETIME,
  remote_updated_at DATETIME,
  sync_status TEXT CHECK(sync_status IN ('synced', 'local_modified', 'remote_modified', 'conflict', 'new_local', 'deleted_remote')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES connections(id)
);

-- Sync history for audit trail
CREATE TABLE sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id TEXT NOT NULL,
  workflow_id TEXT,
  action TEXT NOT NULL,  -- 'pull', 'push', 'conflict_resolved'
  details TEXT,          -- JSON with before/after hashes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Local Workflow File Structure

```
data/workflows/{connection-id}/{workflow-id}/
├── workflow.json       # Full workflow definition
├── meta.json           # Sync metadata
└── .history/           # Optional: local version history
    ├── v1.json
    └── v2.json
```

---

## Core Components

### 1. n8n API Client (`src/n8n/client.ts`)

```typescript
interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
}

class N8nClient {
  constructor(config: N8nClientConfig);

  // Workflow operations
  listWorkflows(options?: { active?: boolean }): Promise<N8nWorkflow[]>;
  getWorkflow(id: string): Promise<N8nWorkflow>;
  createWorkflow(workflow: CreateWorkflowInput): Promise<N8nWorkflow>;
  updateWorkflow(id: string, workflow: UpdateWorkflowInput): Promise<N8nWorkflow>;
  deleteWorkflow(id: string): Promise<void>;

  // Health check
  testConnection(): Promise<boolean>;
}
```

### 2. Sync Engine (`src/sync/engine.ts`)

```typescript
interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: ConflictInfo[];
  errors: SyncError[];
}

class SyncEngine {
  constructor(storage: Storage, client: N8nClient);

  // Full sync
  sync(options?: SyncOptions): Promise<SyncResult>;

  // Individual operations
  pull(options?: PullOptions): Promise<PullResult>;
  push(options?: PushOptions): Promise<PushResult>;

  // Status
  getStatus(): Promise<SyncStatus>;
  getConflicts(): Promise<ConflictInfo[]>;
}
```

### 3. Conflict Detection

Conflicts detected when:
- Local `content_hash` differs from stored hash AND
- Remote `updatedAt` is newer than `last_sync_at`

Resolution strategies:
- `keep-local`: Overwrite remote with local
- `keep-remote`: Overwrite local with remote
- `manual`: Save both versions, user decides

---

## CLI Commands

### `flowsfarm init`
Initialize a new FlowsFarm project in current directory.

```bash
flowsfarm init
# Creates .flowsfarm.json and data/ directory
```

### `flowsfarm connect`
Add an n8n instance connection.

```bash
flowsfarm connect --name "production" --url "https://n8n.example.com" --api-key "xxx"
# Stores encrypted API key, tests connection
```

### `flowsfarm pull`
Download workflows from n8n.

```bash
flowsfarm pull                    # Pull all from all connections
flowsfarm pull --connection prod  # Pull from specific connection
flowsfarm pull --workflow abc123  # Pull specific workflow
```

### `flowsfarm push`
Upload local changes to n8n.

```bash
flowsfarm push                    # Push all modified
flowsfarm push --workflow abc123  # Push specific workflow
flowsfarm push --force            # Overwrite remote conflicts
```

### `flowsfarm status`
Show sync status.

```bash
flowsfarm status
# Output:
# Connection: production (https://n8n.example.com)
#   ✓ 15 workflows synced
#   ⚡ 2 local modifications
#   ⚠ 1 conflict
```

### `flowsfarm diff`
Show differences between local and remote.

```bash
flowsfarm diff                    # Show all diffs
flowsfarm diff --workflow abc123  # Show specific workflow diff
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (TypeScript, ESLint, Vitest)
- [ ] n8n API client with full CRUD operations
- [ ] SQLite storage layer with better-sqlite3
- [ ] Configuration management
- [ ] Basic CLI skeleton with Commander.js

### Phase 2: Pull Sync
- [ ] `flowsfarm init` command
- [ ] `flowsfarm connect` command with API key encryption
- [ ] `flowsfarm pull` - download all workflows
- [ ] Local file storage for workflows
- [ ] Content hashing for change detection
- [ ] `flowsfarm status` - basic status display

### Phase 3: Push Sync
- [ ] Track local modifications
- [ ] `flowsfarm push` - upload changes
- [ ] Conflict detection algorithm
- [ ] `flowsfarm diff` - show changes

### Phase 4: Conflict Resolution
- [ ] Conflict resolution strategies
- [ ] Interactive conflict resolution CLI
- [ ] Sync history/audit trail

### Phase 5: Polish
- [ ] Multi-connection support
- [ ] Watch mode for auto-sync
- [ ] Better error handling and retry logic
- [ ] Progress indicators for large syncs

---

## Dependencies

> **Rule**: Always install dependencies via package manager without pinning versions. Let the package manager resolve latest compatible versions.

**Runtime**:
- `commander` - CLI framework
- `better-sqlite3` - SQLite database
- `chalk` - Terminal styling
- `ora` - Spinners/progress
- `conf` - Config file management
- `zod` - Schema validation

**Dev**:
- `typescript`
- `vitest` - Testing
- `@types/better-sqlite3`
- `@types/node`
- `tsx` - TypeScript execution
- `eslint`

---

## Security Considerations

1. **API Key Storage**: Encrypt API keys at rest using system keychain or AES-256
2. **Local Files**: Workflow files may contain sensitive data - warn users about gitignore
3. **HTTPS Only**: Enforce HTTPS for all n8n connections
4. **Credential Handling**: Never sync n8n credentials, only workflow definitions

---

## Future Enhancements

- Real-time sync with webhooks (if n8n supports)
- Git integration for workflow versioning
- Team collaboration features
- Execution history sync
- Credential management (separate secure store)
- Support for Zapier, Make.com connectors
