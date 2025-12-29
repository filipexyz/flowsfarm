import { Command } from 'commander';
import chalk from 'chalk';
import { runMigrations } from '@flowsfarm/core';
import { SyncEngine, listConnections, getConnection } from '@flowsfarm/n8n-sync';

export function statusCommand(): Command {
  return new Command('status')
    .description('Show sync status')
    .option('-c, --connection <name>', 'Connection name or ID')
    .action((options) => {
      try {
        runMigrations();

        // Get connection(s)
        const connections = options.connection
          ? [getConnection(options.connection)].filter(Boolean)
          : listConnections();

        if (connections.length === 0) {
          console.error(chalk.red('No connections found.'));
          console.log(`Run ${chalk.cyan('flowsfarm connect add')} to add one.`);
          process.exit(1);
        }

        for (const connection of connections) {
          if (!connection) continue;

          const engine = new SyncEngine(connection.id);
          const status = engine.getStatus();

          console.log(
            chalk.bold(`\n${connection.name}`) +
              chalk.dim(` (${connection.baseUrl})`)
          );

          if (status.total === 0) {
            console.log(chalk.dim('  No workflows synced yet'));
            console.log(`  Run ${chalk.cyan('flowsfarm pull')} to download workflows`);
            continue;
          }

          // Status indicators
          const synced = status.synced > 0;
          const hasChanges =
            status.localModified > 0 ||
            status.remoteModified > 0 ||
            status.newLocal > 0;
          const hasConflicts = status.conflict > 0;

          if (synced && !hasChanges && !hasConflicts) {
            console.log(chalk.green(`  ✓ ${status.total} workflows synced`));
          } else {
            console.log(chalk.dim(`  Total: ${status.total} workflows`));
          }

          if (status.synced > 0 && (hasChanges || hasConflicts)) {
            console.log(chalk.green(`  ✓ ${status.synced} synced`));
          }

          if (status.localModified > 0) {
            console.log(
              chalk.yellow(`  ⚡ ${status.localModified} local modifications`)
            );
          }

          if (status.remoteModified > 0) {
            console.log(
              chalk.blue(`  ↓ ${status.remoteModified} remote modifications`)
            );
          }

          if (status.newLocal > 0) {
            console.log(chalk.cyan(`  + ${status.newLocal} new local`));
          }

          if (status.deletedRemote > 0) {
            console.log(
              chalk.red(`  - ${status.deletedRemote} deleted remotely`)
            );
          }

          if (status.conflict > 0) {
            console.log(chalk.red(`  ⚠ ${status.conflict} conflicts`));
            console.log(
              chalk.dim('    Use flowsfarm diff to see details')
            );
          }

          // Last sync info
          if (connection.lastSyncAt) {
            console.log(
              chalk.dim(`\n  Last sync: ${connection.lastSyncAt.toLocaleString()}`)
            );
          }
        }

        console.log(); // Empty line at end
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
