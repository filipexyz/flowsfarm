import type { Command } from 'commander';
import { initCommand } from './init';
import { connectCommand } from './connect';
import { pullCommand } from './pull';
import { pushCommand } from './push';
import { statusCommand } from './status';
import { diffCommand } from './diff';

export function registerCommands(program: Command): void {
  program.addCommand(initCommand());
  program.addCommand(connectCommand());
  program.addCommand(pullCommand());
  program.addCommand(pushCommand());
  program.addCommand(statusCommand());
  program.addCommand(diffCommand());
}
