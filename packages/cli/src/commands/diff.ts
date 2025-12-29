import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations } from '@flowsfarm/core';
import {
  diffWorkflow,
  diffAllWorkflows,
  listConnections,
  getConnection,
  type WorkflowDiff,
} from '@flowsfarm/n8n-sync';

export function diffCommand(): Command {
  return new Command('diff')
    .description('Show differences between local and remote workflows')
    .option('-c, --connection <name>', 'Connection name or ID')
    .option('-w, --workflow <id>', 'Specific workflow ID')
    .action(async (options) => {
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

          console.log(chalk.bold(`\n${connection.name}`));

          const spinner = ora('Fetching remote workflows...').start();

          try {
            let diffs: WorkflowDiff[];

            if (options.workflow) {
              const diff = await diffWorkflow(connection.id, options.workflow);
              diffs = diff ? [diff] : [];
            } else {
              diffs = await diffAllWorkflows(connection.id);
            }

            spinner.stop();

            if (diffs.length === 0) {
              console.log(chalk.dim('  No workflows found'));
              continue;
            }

            // Group by change status
            const changed = diffs.filter((d) => d.hasChanges);
            const unchanged = diffs.filter((d) => !d.hasChanges);

            if (changed.length === 0) {
              console.log(chalk.green('\n  Everything up-to-date'));
              console.log(chalk.dim(`  ${unchanged.length} workflows synced`));
              continue;
            }

            // Show diffs like git
            for (const diff of changed) {
              console.log(chalk.bold(`\ndiff ${diff.filePath}`));

              if (diff.changes.length > 0) {
                for (const change of diff.changes) {
                  console.log(chalk.cyan(`@@ ${change.path} @@`));
                  if (change.type === 'modified') {
                    const localLines = formatJson(change.localValue).split('\n');
                    const remoteLines = formatJson(change.remoteValue).split('\n');
                    for (const line of localLines) {
                      console.log(chalk.red(`-${line}`));
                    }
                    for (const line of remoteLines) {
                      console.log(chalk.green(`+${line}`));
                    }
                  } else if (change.type === 'added') {
                    const lines = formatJson(change.localValue).split('\n');
                    for (const line of lines) {
                      console.log(chalk.green(`+${line}`));
                    }
                  } else if (change.type === 'removed') {
                    const lines = formatJson(change.remoteValue).split('\n');
                    for (const line of lines) {
                      console.log(chalk.red(`-${line}`));
                    }
                  }
                }
              } else {
                console.log(chalk.dim('  (binary or content differs)'));
              }
            }

            // Summary
            console.log();
            console.log(chalk.yellow(`${changed.length} workflow(s) with differences`));
            if (unchanged.length > 0) {
              console.log(chalk.dim(`${unchanged.length} workflow(s) unchanged`));
            }
            console.log();
            console.log(chalk.dim('Use "flowsfarm pull" to get remote changes'));
            console.log(chalk.dim('Use "flowsfarm push" to upload local changes'));
          } catch (error) {
            spinner.fail(chalk.red('Failed to compare'));
            if (error instanceof Error) {
              console.error(chalk.red(error.message));
            }
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

function formatJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
