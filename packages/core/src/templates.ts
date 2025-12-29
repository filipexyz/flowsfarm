import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { getProjectRoot } from './config';

export interface Template {
  name: string;
  description?: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
}

/**
 * Get the path to the templates directory.
 */
export function getTemplatesPath(): string {
  return join(getProjectRoot(), '.flowsfarm', 'templates');
}

/**
 * Ensure templates directory exists.
 */
export function ensureTemplatesDir(): void {
  const templatesPath = getTemplatesPath();
  if (!existsSync(templatesPath)) {
    mkdirSync(templatesPath, { recursive: true });
  }
}

/**
 * List all available templates.
 */
export function listTemplates(): string[] {
  const templatesPath = getTemplatesPath();

  if (!existsSync(templatesPath)) {
    return [];
  }

  return readdirSync(templatesPath)
    .filter((file) => file.endsWith('.json'))
    .map((file) => basename(file, '.json'));
}

/**
 * Load a template by name.
 */
export function loadTemplate(name: string): Template | null {
  const templatesPath = getTemplatesPath();
  const templatePath = join(templatesPath, `${name}.json`);

  if (!existsSync(templatePath)) {
    return null;
  }

  try {
    const content = readFileSync(templatePath, 'utf-8');
    return JSON.parse(content) as Template;
  } catch {
    return null;
  }
}

/**
 * Save a template.
 */
export function saveTemplate(name: string, template: Template): void {
  ensureTemplatesDir();
  const templatesPath = getTemplatesPath();
  const templatePath = join(templatesPath, `${name}.json`);
  writeFileSync(templatePath, JSON.stringify(template, null, 2));
}

/**
 * Delete a template.
 */
export function deleteTemplate(name: string): boolean {
  const templatesPath = getTemplatesPath();
  const templatePath = join(templatesPath, `${name}.json`);

  if (!existsSync(templatePath)) {
    return false;
  }

  unlinkSync(templatePath);
  return true;
}

/**
 * Check if a template exists.
 */
export function templateExists(name: string): boolean {
  const templatesPath = getTemplatesPath();
  const templatePath = join(templatesPath, `${name}.json`);
  return existsSync(templatePath);
}
