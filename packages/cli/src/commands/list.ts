import { Command } from 'commander';
import chalk from 'chalk';
import { runMigrations, getDb, schema, eq } from '@flowsfarm/core';
import { getConnection } from '@flowsfarm/n8n-sync';

interface ListOptions {
  connection?: string;
  json?: boolean;
  active?: boolean;
}

export function listCommand(): Command {
  return new Command('list')
    .description('List all synced workflows')
    .option('-c, --connection <name>', 'Filter by connection name or ID')
    .option('--json', 'Output as JSON')
    .option('--active', 'Show only active workflows')
    .action(async (options: ListOptions) => {
      try {
        runMigrations();

        const db = getDb();
        let query = db
          .select({
            id: schema.workflows.id,
            remoteId: schema.workflows.remoteId,
            name: schema.workflows.name,
            active: schema.workflows.active,
            syncStatus: schema.workflows.syncStatus,
            connectionId: schema.workflows.connectionId,
            localUpdatedAt: schema.workflows.localUpdatedAt,
            remoteUpdatedAt: schema.workflows.remoteUpdatedAt,
          })
          .from(schema.workflows);

        // Filter by connection if specified
        let connectionInfo = null;
        if (options.connection) {
          connectionInfo = getConnection(options.connection);
          if (!connectionInfo) {
            console.error(chalk.red(`Connection not found: ${options.connection}`));
            process.exit(1);
          }
          query = query.where(eq(schema.workflows.connectionId, connectionInfo.id)) as typeof query;
        }

        let workflows = query.all();

        // Filter by active status
        if (options.active !== undefined) {
          workflows = workflows.filter((w) => w.active === options.active);
        }

        // JSON output
        if (options.json) {
          console.log(JSON.stringify(workflows, null, 2));
          return;
        }

        // Human-readable output
        if (workflows.length === 0) {
          console.log(chalk.yellow('No workflows found.'));
          console.log(chalk.dim('Run `flowsfarm pull` to sync workflows.'));
          return;
        }

        console.log(chalk.bold(`\nWorkflows (${workflows.length}):\n`));

        // Get connection names for display
        const connections = db.select().from(schema.connections).all();
        const connectionMap = new Map(connections.map((c) => [c.id, c.name]));

        for (const workflow of workflows) {
          const statusIcon = getStatusIcon(workflow.syncStatus);
          const activeIcon = workflow.active ? chalk.green('●') : chalk.dim('○');
          const connName = connectionMap.get(workflow.connectionId) || 'unknown';

          console.log(
            `  ${activeIcon} ${statusIcon} ${chalk.bold(workflow.name)}`
          );
          console.log(
            chalk.dim(`     ID: ${workflow.remoteId}  Connection: ${connName}`)
          );
          console.log();
        }

        // Legend
        console.log(chalk.dim('Legend:'));
        console.log(chalk.dim('  ● active  ○ inactive'));
        console.log(
          chalk.dim('  ✓ synced  ↑ local changes  ↓ remote changes  ⚡ conflict')
        );
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}

function getStatusIcon(status: string | null): string {
  switch (status) {
    case 'synced':
      return chalk.green('✓');
    case 'local_modified':
      return chalk.yellow('↑');
    case 'remote_modified':
      return chalk.blue('↓');
    case 'conflict':
      return chalk.red('⚡');
    case 'new_local':
      return chalk.cyan('+');
    case 'deleted_remote':
      return chalk.red('×');
    default:
      return chalk.dim('?');
  }
}
