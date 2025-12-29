import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations } from '@flowsfarm/core';
import { addConnection, listConnections, removeConnection } from '@flowsfarm/n8n-sync';

export function connectCommand(): Command {
  const cmd = new Command('connect').description('Manage n8n instance connections');

  // Add subcommand
  cmd
    .command('add')
    .description('Add a new n8n instance connection')
    .requiredOption('-n, --name <name>', 'Connection name (e.g., "production")')
    .requiredOption('-u, --url <url>', 'n8n base URL (e.g., "https://n8n.example.com")')
    .requiredOption('-k, --api-key <key>', 'n8n API key')
    .action(async (options) => {
      const spinner = ora('Testing connection...').start();

      try {
        // Ensure database is initialized
        runMigrations();

        const connection = await addConnection({
          name: options.name,
          baseUrl: options.url,
          apiKey: options.apiKey,
        });

        spinner.succeed(
          chalk.green(`Connection "${connection.name}" added successfully`)
        );
        console.log(chalk.dim(`  URL: ${connection.baseUrl}`));
        console.log(chalk.dim(`  ID:  ${connection.id}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to add connection'));
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });

  // List subcommand
  cmd
    .command('list')
    .description('List all connections')
    .action(() => {
      try {
        runMigrations();
        const connections = listConnections();

        if (connections.length === 0) {
          console.log(chalk.yellow('No connections configured.'));
          console.log(
            `Run ${chalk.cyan('flowsfarm connect add')} to add one.`
          );
          return;
        }

        console.log(chalk.bold('Connections:\n'));

        for (const conn of connections) {
          console.log(`  ${chalk.cyan(conn.name)}`);
          console.log(chalk.dim(`    URL:  ${conn.baseUrl}`));
          console.log(chalk.dim(`    ID:   ${conn.id}`));
          if (conn.lastSyncAt) {
            console.log(
              chalk.dim(`    Last sync: ${conn.lastSyncAt.toLocaleString()}`)
            );
          }
          console.log();
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });

  // Remove subcommand
  cmd
    .command('remove <name>')
    .description('Remove a connection')
    .option('-f, --force', 'Skip confirmation')
    .action((name, options) => {
      try {
        runMigrations();

        if (!options.force) {
          console.log(
            chalk.yellow(
              `This will remove connection "${name}" and all associated workflow data.`
            )
          );
          console.log('Use --force to confirm.');
          process.exit(1);
        }

        const removed = removeConnection(name);

        if (removed) {
          console.log(chalk.green(`Connection "${name}" removed.`));
        } else {
          console.error(chalk.red(`Connection "${name}" not found.`));
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });

  // Default action (shorthand for add)
  cmd
    .option('-n, --name <name>', 'Connection name')
    .option('-u, --url <url>', 'n8n base URL')
    .option('-k, --api-key <key>', 'n8n API key')
    .action(async (options) => {
      // If all options provided, treat as add
      if (options.name && options.url && options.apiKey) {
        const spinner = ora('Testing connection...').start();

        try {
          runMigrations();

          const connection = await addConnection({
            name: options.name,
            baseUrl: options.url,
            apiKey: options.apiKey,
          });

          spinner.succeed(
            chalk.green(`Connection "${connection.name}" added successfully`)
          );
        } catch (error) {
          spinner.fail(chalk.red('Failed to add connection'));
          if (error instanceof Error) {
            console.error(chalk.red(error.message));
          }
          process.exit(1);
        }
      } else {
        // Show help
        cmd.help();
      }
    });

  return cmd;
}
