import chalk from 'chalk';
import type { WorkflowDiff } from '@flowsfarm/n8n-sync';

export function showDiff(diff: WorkflowDiff): void {
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
    console.log(chalk.dim('  (content changed)'));
  }
}

export function formatJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
