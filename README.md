# FlowsFarm

Local-first workflow synchronization for n8n. Download, edit, and sync workflows with bi-directional sync and conflict detection.

## Features

- **Local-first**: Workflows stored as JSON files you can edit, version control, and diff
- **Bi-directional sync**: Pull from n8n, push local changes back
- **Conflict detection**: Detects when both local and remote changed
- **Templates**: Save workflows as reusable templates
- **Multiple connections**: Manage workflows across multiple n8n instances

## Installation

```bash
# Install globally
npm install -g flowsfarm

# Or with bun
bun install -g flowsfarm
```

### Claude Code Plugin

Install the FlowsFarm skill for Claude Code:

```
/plugin marketplace add filipexyz/plugins
/plugin install flowsfarm@filipelabs
```

This teaches Claude how to use FlowsFarm to manage your n8n workflows.

### Development Setup

```bash
git clone https://github.com/filipexyz/flowsfarm.git
cd flowsfarm
bun install
bun run cli --help
```

## Quick Start

```bash
# Initialize project
flowsfarm init

# Connect to n8n instance
flowsfarm connect add -n prod -u https://n8n.example.com -k YOUR_API_KEY

# Pull all workflows
flowsfarm pull

# List workflows
flowsfarm list

# View a workflow
flowsfarm show "My Workflow"

# Edit workflows in .flowsfarm/workflows/...

# Push changes back
flowsfarm push
```

## CLI Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `flowsfarm init` | Initialize FlowsFarm in current directory |
| `flowsfarm connect add -n <name> -u <url> -k <key>` | Add n8n connection |
| `flowsfarm connect list` | List connections |
| `flowsfarm pull` | Download workflows from n8n |
| `flowsfarm push` | Upload local changes to n8n |
| `flowsfarm status` | Show sync status |
| `flowsfarm diff` | Show differences between local and remote |

### Workflow Commands

| Command | Description |
|---------|-------------|
| `flowsfarm list` | List all synced workflows |
| `flowsfarm list --json` | Output as JSON |
| `flowsfarm list --active` | Show only active workflows |
| `flowsfarm show <name-or-id>` | Show workflow details |
| `flowsfarm show <name> --json` | Output full workflow as JSON |
| `flowsfarm show <name> --nodes` | Show node parameters |
| `flowsfarm create <name>` | Create empty workflow |
| `flowsfarm create <name> -t <template>` | Create from template |

### Template Commands

| Command | Description |
|---------|-------------|
| `flowsfarm templates` | List all templates |
| `flowsfarm templates show <name>` | Show template details |
| `flowsfarm templates save <workflow>` | Save workflow as template |
| `flowsfarm templates save <workflow> -n <name>` | Save with custom name |
| `flowsfarm templates delete <name>` | Delete template |

## Project Structure

```
your-project/
├── .flowsfarm.json          # Project config
└── .flowsfarm/
    ├── flowsfarm.db         # SQLite database (metadata)
    ├── workflows/           # Synced workflow JSON files
    │   └── <connection-id>/
    │       └── <workflow-id>/
    │           └── workflow.json
    └── templates/           # Reusable templates
        └── *.json
```

## Templates

Templates are JSON files in `.flowsfarm/templates/`. Save any synced workflow as a template:

```bash
# Save a workflow as template
flowsfarm templates save "My Workflow" -n my-template

# Create new workflow from template
flowsfarm create "New Workflow" -t my-template
```

Template format:
```json
{
  "name": "Template Name",
  "description": "Optional description",
  "nodes": [...],
  "connections": {...}
}
```

## Sync Workflow

1. **Pull** downloads workflows and stores them locally
2. **Edit** JSON files directly or via n8n UI
3. **Push** uploads your changes

Conflict detection kicks in when both local and remote have changed since last sync. Use `--force` to overwrite.

## Requirements

- [Bun](https://bun.sh) runtime
- n8n instance with API access enabled

## License

MIT
