import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { initConfig, isInitialized, runMigrations, ensureTemplatesDir } from '@flowsfarm/core';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new FlowsFarm project in the current directory')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      const cwd = process.cwd();

      if (isInitialized(cwd) && !options.force) {
        console.error(
          chalk.red('FlowsFarm is already initialized in this directory.')
        );
        console.log('Use --force to reinitialize.');
        process.exit(1);
      }

      const spinner = ora('Initializing FlowsFarm project...').start();

      try {
        // Create config and directories
        initConfig(cwd);
        spinner.text = 'Running database migrations...';

        // Initialize database
        runMigrations();

        // Create templates directory
        ensureTemplatesDir();

        spinner.succeed(chalk.green('FlowsFarm project initialized'));

        console.log('\n' + chalk.dim('Created:'));
        console.log(chalk.dim('  .flowsfarm.json       - Project configuration'));
        console.log(chalk.dim('  .flowsfarm/           - Data directory'));
        console.log(chalk.dim('  .flowsfarm/templates/ - Workflow templates'));

        console.log('\n' + chalk.bold('Next steps:'));
        console.log(
          `  ${chalk.cyan('flowsfarm connect')} ${chalk.dim('-n <name> -u <url> -k <api-key>')} - Add an n8n instance`
        );
        console.log(
          `  ${chalk.cyan('flowsfarm pull')}    ${chalk.dim('                              ')} - Download workflows`
        );
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize project'));
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}
