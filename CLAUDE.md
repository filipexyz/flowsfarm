# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowsFarm is a local-first workflow synchronization tool for automation platforms, starting with n8n. It enables downloading, managing, and syncing workflows locally with bi-directional sync and conflict detection.

## Commands

```bash
# Development
bun run cli <command>          # Run CLI command (e.g., bun run cli init)
bun run dev                    # Run CLI in watch mode (for development)

# Testing & Quality
bun run test                   # Run tests in watch mode
bun run test:run               # Run tests once
bun run typecheck              # TypeScript type checking
bun run lint                   # ESLint

# Database
bun run db:generate            # Generate Drizzle migrations from schema
bun run db:migrate             # Apply migrations
bun run db:studio              # Open Drizzle Studio

# Build
bun run build                  # Build all packages
bun run clean                  # Clean dist folders
```

## Architecture

This is a **bun monorepo** with three packages:

```
packages/
├── cli/        # CLI entry point (Commander.js)
├── core/       # Shared: config, storage (bun:sqlite + Drizzle ORM), utils
└── n8n-sync/   # n8n API client and sync engine
```

### Package Dependencies
- `@flowsfarm/cli` depends on `core` and `n8n-sync`
- `@flowsfarm/n8n-sync` depends on `core`
- `@flowsfarm/core` is standalone

### Key Architectural Decisions
- **Database**: Uses `bun:sqlite` (built-in, no native deps) with Drizzle ORM
- **Local-first**: All data stored in `.flowsfarm/` directory with SQLite + JSON workflow files
- **Sync model**: Content hashing for change detection, conflict detection when both local and remote modified

### Data Flow
1. User runs CLI command → `packages/cli/src/commands/*.ts`
2. Commands use `SyncEngine` from `@flowsfarm/n8n-sync`
3. `SyncEngine` orchestrates `N8nClient` (API) and storage (`@flowsfarm/core`)
4. Storage: SQLite for metadata, JSON files for full workflow content

### Database Schema (3 tables)
- `connections` - n8n instance credentials (API keys encrypted)
- `workflows` - synced workflow metadata with sync status
- `sync_history` - audit trail of sync operations

## Dependency Rule

Always install dependencies via package manager without pinning versions:
```bash
bun add <package>      # Not bun add <package>@version
```

## CLI Commands (for testing)

```bash
flowsfarm init                              # Initialize project
flowsfarm connect add -n <name> -u <url> -k <key>  # Add n8n connection
flowsfarm pull                              # Download workflows
flowsfarm push                              # Upload changes
flowsfarm status                            # Show sync state
flowsfarm diff                              # Show differences
```
