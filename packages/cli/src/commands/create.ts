import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runMigrations, loadTemplate, listTemplates } from '@flowsfarm/core';
import { createWorkflow, listConnections, getConnection } from '@flowsfarm/n8n-sync';

export function createCommand(): Command {
  return new Command('create')
    .description('Create a new workflow')
    .argument('<name>', 'Workflow name')
    .option('-c, --connection <name>', 'Connection name or ID')
    .option('-t, --template <template>', 'Template name')
    .option('--active', 'Activate the workflow after creation')
    .action(async (name, options) => {
      try {
        runMigrations();

        // Get connection
        const connections = options.connection
          ? [getConnection(options.connection)].filter(Boolean)
          : listConnections();

        if (connections.length === 0) {
          console.error(chalk.red('No connections found.'));
          console.log(`Run ${chalk.cyan('flowsfarm connect add')} to add one.`);
          process.exit(1);
        }

        const connection = connections[0];
        if (!connection) {
          console.error(chalk.red('Connection not found.'));
          process.exit(1);
        }

        // Get template if specified
        let nodes: unknown[] = [];
        let workflowConnections: Record<string, unknown> = {};

        if (options.template) {
          const template = loadTemplate(options.template);

          if (!template) {
            const available = listTemplates();
            console.error(chalk.red(`Template not found: ${options.template}`));
            if (available.length > 0) {
              console.log(`Available templates: ${available.join(', ')}`);
            } else {
              console.log(chalk.dim('No templates available. Use `flowsfarm templates save <workflow>` to create one.'));
            }
            process.exit(1);
          }

          nodes = template.nodes;
          workflowConnections = template.connections;
        }

        const spinner = ora(`Creating workflow "${name}"...`).start();

        const workflow = await createWorkflow(connection.id, {
          name,
          nodes,
          connections: workflowConnections,
          active: options.active ?? false,
        });

        spinner.succeed(chalk.green(`Workflow "${name}" created`));
        console.log(chalk.dim(`  ID: ${workflow.id}`));
        console.log(chalk.dim(`  Active: ${workflow.active}`));
        if (options.template) {
          console.log(chalk.dim(`  Template: ${options.template}`));
        }

        console.log(chalk.dim('\nRun `flowsfarm pull` to sync locally'));
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
