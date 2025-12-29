import type { Command } from 'commander';
import { initCommand } from './init';
import { connectCommand } from './connect';
import { pullCommand } from './pull';
import { pushCommand } from './push';
import { statusCommand } from './status';
import { diffCommand } from './diff';
import { createCommand } from './create';
import { listCommand } from './list';
import { showCommand } from './show';
import { templatesCommand } from './templates';

export function registerCommands(program: Command): void {
  program.addCommand(initCommand());
  program.addCommand(connectCommand());
  program.addCommand(createCommand());
  program.addCommand(listCommand());
  program.addCommand(showCommand());
  program.addCommand(templatesCommand());
  program.addCommand(pullCommand());
  program.addCommand(pushCommand());
  program.addCommand(statusCommand());
  program.addCommand(diffCommand());
}
