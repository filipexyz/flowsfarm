#!/usr/bin/env bun
import { Command } from 'commander';
import { registerCommands } from './commands';

const program = new Command();

program
  .name('flowsfarm')
  .description('Local-first workflow synchronization for automation platforms')
  .version('0.1.0');

// Register all commands
registerCommands(program);

program.parse();
