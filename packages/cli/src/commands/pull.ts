import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations } from '@flowsfarm/core';
import { SyncEngine, listConnections, getConnection } from '@flowsfarm/n8n-sync';

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

          console.log(chalk.bold(`\nPulling from ${connection.name}...`));

          const spinner = ora('Fetching workflows...').start();

          try {
            const engine = new SyncEngine(connection.id);
            const result = await engine.pull({
              workflowIds: options.workflow ? [options.workflow] : undefined,
              force: options.force,
            });

            spinner.succeed(chalk.green('Pull complete'));

            // Show results
            console.log(chalk.dim(`  Total:     ${result.total}`));
            console.log(chalk.green(`  Created:   ${result.created}`));
            console.log(chalk.blue(`  Updated:   ${result.updated}`));
            console.log(chalk.dim(`  Unchanged: ${result.unchanged}`));

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
