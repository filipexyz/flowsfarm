import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  runMigrations,
  listTemplates,
  loadTemplate,
  saveTemplate,
  deleteTemplate,
  getProjectRoot,
  getDb,
  schema,
  eq,
  like,
  type Template,
} from '@flowsfarm/core';

export function templatesCommand(): Command {
  const cmd = new Command('templates')
    .description('Manage workflow templates')
    .action(() => {
      // Default action: list templates
      runMigrations();

      const templates = listTemplates();

      if (templates.length === 0) {
        console.log(chalk.yellow('No templates found.'));
        console.log(chalk.dim('Use `flowsfarm templates save <workflow>` to save a workflow as a template.'));
        return;
      }

      console.log(chalk.bold(`\nTemplates (${templates.length}):\n`));

      for (const name of templates) {
        const template = loadTemplate(name);
        if (template) {
          console.log(`  ${chalk.cyan(name)}`);
          if (template.description) {
            console.log(chalk.dim(`    ${template.description}`));
          }
          console.log(chalk.dim(`    Nodes: ${template.nodes.length}`));
          console.log();
        }
      }
    });

  // Show template details
  cmd
    .command('show <name>')
    .description('Show template details')
    .option('--json', 'Output as JSON')
    .action((name, options) => {
      runMigrations();

      const template = loadTemplate(name);

      if (!template) {
        console.error(chalk.red(`Template not found: ${name}`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(template, null, 2));
        return;
      }

      console.log(chalk.bold(`\n${template.name}`));
      if (template.description) {
        console.log(chalk.dim(template.description));
      }
      console.log();

      console.log(chalk.bold(`Nodes (${template.nodes.length}):`));
      for (const node of template.nodes as Array<{ name: string; type: string }>) {
        const typeShort = node.type.replace('n8n-nodes-base.', '').replace('n8n-nodes-', '');
        console.log(`  ${chalk.cyan(node.name)} ${chalk.dim(`(${typeShort})`)}`);
      }
    });

  // Save workflow as template
  cmd
    .command('save <workflow>')
    .description('Save a synced workflow as a template')
    .option('-n, --name <name>', 'Template name (defaults to workflow name)')
    .option('-d, --description <desc>', 'Template description')
    .action((workflowName, options) => {
      runMigrations();

      const db = getDb();
      const projectRoot = getProjectRoot();

      // Find workflow by name or ID
      let workflow = db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.remoteId, workflowName))
        .get();

      if (!workflow) {
        workflow = db
          .select()
          .from(schema.workflows)
          .where(eq(schema.workflows.name, workflowName))
          .get();
      }

      if (!workflow) {
        // Try partial match
        const matches = db
          .select()
          .from(schema.workflows)
          .where(like(schema.workflows.name, `%${workflowName}%`))
          .all();

        if (matches.length === 1) {
          workflow = matches[0];
        } else if (matches.length > 1) {
          console.error(chalk.yellow(`Multiple workflows match "${workflowName}":`));
          for (const w of matches) {
            console.log(`  - ${w.name} (${w.remoteId})`);
          }
          process.exit(1);
        }
      }

      if (!workflow) {
        console.error(chalk.red(`Workflow not found: ${workflowName}`));
        process.exit(1);
      }

      // Load workflow content
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

      // Create template
      const templateName = options.name || workflow.name.toLowerCase().replace(/\s+/g, '-');
      const template: Template = {
        name: workflow.name,
        description: options.description,
        nodes: content.nodes,
        connections: content.connections,
      };

      saveTemplate(templateName, template);

      console.log(chalk.green(`Template saved: ${templateName}`));
      console.log(chalk.dim(`  From workflow: ${workflow.name}`));
      console.log(chalk.dim(`  Nodes: ${template.nodes.length}`));
    });

  // Delete template
  cmd
    .command('delete <name>')
    .description('Delete a template')
    .action((name) => {
      runMigrations();

      if (!deleteTemplate(name)) {
        console.error(chalk.red(`Template not found: ${name}`));
        process.exit(1);
      }

      console.log(chalk.green(`Template deleted: ${name}`));
    });

  return cmd;
}
