import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations } from '@flowsfarm/core';
import {
  SyncEngine,
  listConnections,
  getConnection,
  diffAllWorkflows,
} from '@flowsfarm/n8n-sync';
import { showDiff } from '../utils/diff-display';

export function pullCommand(): Command {
  return new Command('pull')
    .description('Download workflows from n8n')
    .option('-c, --connection <name>', 'Connection name or ID')
    .option('-w, --workflow <id>', 'Specific workflow ID to pull')
    .option('-f, --force', 'Overwrite local changes')
    .action(async (options) => {
      try {
        runMigrations();

        // Get connection(s) to pull from
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

          console.log(chalk.bold(`\n${connection.name}`));

          const spinner = ora('Fetching remote workflows...').start();

          try {
            // First show diff of what will change
            const diffs = await diffAllWorkflows(connection.id);
            const changed = diffs.filter((d) => d.hasChanges);

            spinner.stop();

            // Show incoming changes
            if (changed.length > 0) {
              console.log(chalk.cyan(`\nIncoming changes:`));
              for (const diff of changed) {
                showDiff(diff);
              }
              console.log();
            }

            // Now pull
            const pullSpinner = ora('Pulling changes...').start();
            const engine = new SyncEngine(connection.id);
            const result = await engine.pull({
              workflowIds: options.workflow ? [options.workflow] : undefined,
              force: options.force,
            });

            pullSpinner.succeed(chalk.green('Pull complete'));

            // Show results
            if (result.created > 0) console.log(chalk.green(`  Created:   ${result.created}`));
            if (result.updated > 0) console.log(chalk.blue(`  Updated:   ${result.updated}`));
            if (result.unchanged > 0) console.log(chalk.dim(`  Unchanged: ${result.unchanged}`));

            if (result.errors.length > 0) {
              console.log(chalk.red(`  Errors:    ${result.errors.length}`));
              for (const err of result.errors) {
                console.log(chalk.red(`    - ${err.message}`));
              }
            }
          } catch (error) {
            spinner.fail(chalk.red(`Failed to pull from ${connection.name}`));
            if (error instanceof Error) {
              console.error(chalk.red(error.message));
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
