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
# Clone and install
git clone https://github.com/filipelabs/flowsfarm.git
cd flowsfarm
bun install

# Run CLI
bun run cli --help
```

## Quick Start

```bash
# Initialize project
bun run cli init

# Connect to n8n instance
bun run cli connect add -n prod -u https://n8n.example.com -k YOUR_API_KEY

# Pull all workflows
bun run cli pull

# List workflows
bun run cli list

# View a workflow
bun run cli show "My Workflow"

# Edit workflows in .flowsfarm/workflows/...

# Push changes back
bun run cli push
```

## CLI Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize FlowsFarm in current directory |
| `connect add -n <name> -u <url> -k <key>` | Add n8n connection |
| `connect list` | List connections |
| `pull` | Download workflows from n8n |
| `push` | Upload local changes to n8n |
| `status` | Show sync status |
| `diff` | Show differences between local and remote |

### Workflow Commands

| Command | Description |
|---------|-------------|
| `list` | List all synced workflows |
| `list --json` | Output as JSON |
| `list --active` | Show only active workflows |
| `show <name-or-id>` | Show workflow details |
| `show <name> --json` | Output full workflow as JSON |
| `show <name> --nodes` | Show node parameters |
| `create <name>` | Create empty workflow |
| `create <name> -t <template>` | Create from template |

### Template Commands

| Command | Description |
|---------|-------------|
| `templates` | List all templates |
| `templates show <name>` | Show template details |
| `templates save <workflow>` | Save workflow as template |
| `templates save <workflow> -n <name>` | Save with custom name |
| `templates delete <name>` | Delete template |

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
bun run cli templates save "My Workflow" -n my-template

# Create new workflow from template
bun run cli create "New Workflow" -t my-template
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
