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

          const spinner = ora('Comparing with remote...').start();

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
              console.log(chalk.green('  ✓ All workflows in sync'));
              console.log(chalk.dim(`    ${unchanged.length} workflows unchanged`));
              continue;
            }

            console.log(
              chalk.yellow(`\n  ${changed.length} workflows with differences:\n`)
            );

            for (const diff of changed) {
              console.log(`  ${chalk.cyan(diff.workflowName)}`);
              console.log(chalk.dim(`    Remote ID: ${diff.remoteId}`));
              console.log(chalk.dim(`    Local:  ${diff.localHash.slice(0, 8)}...`));
              console.log(
                chalk.dim(
                  `    Remote: ${diff.remoteHash?.slice(0, 8) || 'N/A'}...`
                )
              );

              if (diff.changes.length > 0) {
                console.log(chalk.dim('    Changes:'));
                for (const change of diff.changes) {
                  const icon =
                    change.type === 'added'
                      ? chalk.green('+')
                      : change.type === 'removed'
                        ? chalk.red('-')
                        : chalk.yellow('~');

                  console.log(`      ${icon} ${change.path}`);

                  if (change.localValue !== undefined) {
                    console.log(
                      chalk.dim(
                        `        local:  ${formatValue(change.localValue)}`
                      )
                    );
                  }
                  if (change.remoteValue !== undefined) {
                    console.log(
                      chalk.dim(
                        `        remote: ${formatValue(change.remoteValue)}`
                      )
                    );
                  }
                }
              }

              console.log();
            }

            if (unchanged.length > 0) {
              console.log(
                chalk.dim(`  ${unchanged.length} workflows unchanged`)
              );
            }
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

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 50 ? value.slice(0, 47) + '...' : value;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 50 ? str.slice(0, 47) + '...' : str;
  }
  return String(value);
}
