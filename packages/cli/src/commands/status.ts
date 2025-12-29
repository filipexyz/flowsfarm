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

          const hasChanges =
            status.localModified.length > 0 ||
            status.conflict.length > 0 ||
            status.newLocal.length > 0 ||
            status.deletedRemote.length > 0;

          if (!hasChanges) {
            console.log(chalk.green(`\n  Nothing to push, working tree clean`));
            console.log(chalk.dim(`  ${status.total} workflows synced`));
          } else {
            // Show changes like git status
            if (status.localModified.length > 0) {
              console.log(chalk.yellow(`\n  Changes to be pushed:`));
              for (const wf of status.localModified) {
                console.log(chalk.yellow(`        modified:   ${wf.name}`));
                console.log(chalk.dim(`                    ${wf.path}`));
              }
            }

            if (status.newLocal.length > 0) {
              console.log(chalk.green(`\n  New workflows:`));
              for (const wf of status.newLocal) {
                console.log(chalk.green(`        new:        ${wf.name}`));
                console.log(chalk.dim(`                    ${wf.path}`));
              }
            }

            if (status.deletedRemote.length > 0) {
              console.log(chalk.red(`\n  Deleted remotely:`));
              for (const wf of status.deletedRemote) {
                console.log(chalk.red(`        deleted:    ${wf.name}`));
                console.log(chalk.dim(`                    ${wf.path}`));
              }
            }

            if (status.conflict.length > 0) {
              console.log(chalk.red(`\n  Conflicts (both modified):`));
              for (const wf of status.conflict) {
                console.log(chalk.red(`        conflict:   ${wf.name}`));
                console.log(chalk.dim(`                    ${wf.path}`));
              }
            }

            // Summary
            console.log();
            if (status.localModified.length > 0 || status.newLocal.length > 0) {
              console.log(chalk.dim(`  Use "flowsfarm push" to upload changes`));
            }
            if (status.conflict.length > 0) {
              console.log(chalk.dim(`  Use "flowsfarm diff" to see conflict details`));
            }
          }

          // Last sync info
          if (connection.lastSyncAt) {
            console.log(
              chalk.dim(`\n  Last sync: ${connection.lastSyncAt.toLocaleString()}`)
            );
          }
        }

        console.log();
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
