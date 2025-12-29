import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runMigrations, getDb, schema, getProjectRoot, eq, like } from '@flowsfarm/core';

interface ShowOptions {
  json?: boolean;
  nodes?: boolean;
}

export function showCommand(): Command {
  return new Command('show')
    .description('Show workflow details')
    .argument('<name-or-id>', 'Workflow name or ID (supports partial match)')
    .option('--json', 'Output full workflow as JSON')
    .option('--nodes', 'Show node details')
    .action(async (nameOrId: string, options: ShowOptions) => {
      try {
        runMigrations();

        const db = getDb();
        const projectRoot = getProjectRoot();

        // Find workflow by ID or name (partial match supported)
        let workflow = db
          .select()
          .from(schema.workflows)
          .where(eq(schema.workflows.remoteId, nameOrId))
          .get();

        if (!workflow) {
          // Try exact name match
          workflow = db
            .select()
            .from(schema.workflows)
            .where(eq(schema.workflows.name, nameOrId))
            .get();
        }

        if (!workflow) {
          // Try partial name match (case-insensitive)
          const workflows = db
            .select()
            .from(schema.workflows)
            .where(like(schema.workflows.name, `%${nameOrId}%`))
            .all();

          if (workflows.length === 1) {
            workflow = workflows[0];
          } else if (workflows.length > 1) {
            console.error(chalk.yellow(`Multiple workflows match "${nameOrId}":`));
            for (const w of workflows) {
              console.log(`  - ${w.name} (${w.remoteId})`);
            }
            console.log(chalk.dim('\nBe more specific or use the full ID.'));
            process.exit(1);
          }
        }

        if (!workflow) {
          console.error(chalk.red(`Workflow not found: ${nameOrId}`));
          process.exit(1);
        }

        // Load workflow content from file
        const workflowPath = join(
          projectRoot,
          '.flowsfarm',
          'workflows',
          workflow.connectionId,
          workflow.remoteId,
          'workflow.json'
        );

        if (!existsSync(workflowPath)) {
          console.error(chalk.red('Workflow file not found. Run `flowsfarm pull` first.'));
          process.exit(1);
        }

        const content = JSON.parse(readFileSync(workflowPath, 'utf-8'));

        // JSON output
        if (options.json) {
          console.log(JSON.stringify(content, null, 2));
          return;
        }

        // Human-readable output
        console.log(chalk.bold(`\n${content.name}`));
        console.log(chalk.dim(`ID: ${workflow.remoteId}`));
        console.log(chalk.dim(`Active: ${workflow.active ? 'yes' : 'no'}`));
        console.log(chalk.dim(`Status: ${workflow.syncStatus}`));
        console.log();

        // Show nodes
        const nodes = content.nodes || [];
        console.log(chalk.bold(`Nodes (${nodes.length}):`));

        for (const node of nodes) {
          const typeShort = node.type.replace('n8n-nodes-base.', '').replace('n8n-nodes-', '');
          console.log(`  ${chalk.cyan(node.name)} ${chalk.dim(`(${typeShort})`)}`);

          if (options.nodes && node.parameters) {
            const params = Object.entries(node.parameters)
              .filter(([_, v]) => v !== undefined && v !== null && v !== '')
              .slice(0, 5); // Limit to first 5 params

            for (const [key, value] of params) {
              const displayValue = typeof value === 'object'
                ? JSON.stringify(value).substring(0, 50) + '...'
                : String(value).substring(0, 50);
              console.log(chalk.dim(`    ${key}: ${displayValue}`));
            }
          }
        }

        // Show connections summary
        const connections = content.connections || {};
        const connectionCount = Object.keys(connections).length;
        console.log();
        console.log(chalk.dim(`Connections: ${connectionCount} nodes connected`));

      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
