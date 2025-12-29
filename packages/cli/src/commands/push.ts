import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations } from '@flowsfarm/core';
import { SyncEngine, listConnections, getConnection } from '@flowsfarm/n8n-sync';

export function pushCommand(): Command {
  return new Command('push')
    .description('Upload local changes to n8n')
    .option('-c, --connection <name>', 'Connection name or ID')
    .option('-w, --workflow <id>', 'Specific workflow ID to push')
    .option('-f, --force', 'Overwrite remote changes (resolve conflicts)')
    .action(async (options) => {
      try {
        runMigrations();

        // Get connection(s) to push to
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

          console.log(chalk.bold(`\nPushing to ${connection.name}...`));

          const spinner = ora('Uploading workflows...').start();

          try {
            const engine = new SyncEngine(connection.id);
            const result = await engine.push({
              workflowIds: options.workflow ? [options.workflow] : undefined,
              force: options.force,
            });

            if (result.total === 0) {
              spinner.info(chalk.dim('No local changes to push'));
              continue;
            }

            spinner.succeed(chalk.green('Push complete'));

            // Show results
            console.log(chalk.dim(`  Total:     ${result.total}`));
            console.log(chalk.green(`  Created:   ${result.created}`));
            console.log(chalk.blue(`  Updated:   ${result.updated}`));

            if (result.conflicts.length > 0) {
              console.log(
                chalk.yellow(`  Conflicts: ${result.conflicts.length}`)
              );
              for (const conflict of result.conflicts) {
                console.log(chalk.yellow(`    - ${conflict.workflowName}`));
              }
              console.log(
                chalk.dim('\n  Use --force to overwrite remote changes')
              );
            }

            if (result.errors.length > 0) {
              console.log(chalk.red(`  Errors:    ${result.errors.length}`));
              for (const err of result.errors) {
                console.log(chalk.red(`    - ${err.message}`));
              }
            }
          } catch (error) {
            spinner.fail(chalk.red(`Failed to push to ${connection.name}`));
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
