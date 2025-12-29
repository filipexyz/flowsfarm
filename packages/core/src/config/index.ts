import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { z } from 'zod';

const ConfigSchema = z.object({
  version: z.string().default('1'),
  dbPath: z.string(),
  workflowsPath: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_FILE = '.flowsfarm.json';
const DEFAULT_DATA_DIR = '.flowsfarm';

let cachedConfig: Config | null = null;
let projectRoot: string | null = null;

export function findProjectRoot(startPath: string = process.cwd()): string | null {
  let current = startPath;

  while (current !== '/') {
    if (existsSync(join(current, CONFIG_FILE))) {
      return current;
    }
    current = dirname(current);
  }

  return null;
}

export function getProjectRoot(): string {
  if (projectRoot) return projectRoot;

  const found = findProjectRoot();
  if (!found) {
    throw new Error(
      'Not a FlowsFarm project. Run "flowsfarm init" to initialize.'
    );
  }

  projectRoot = found;
  return projectRoot;
}

export function setProjectRoot(path: string) {
  projectRoot = path;
  cachedConfig = null;
}

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const root = getProjectRoot();
  const configPath = join(root, CONFIG_FILE);

  if (!existsSync(configPath)) {
    throw new Error(
      'Configuration file not found. Run "flowsfarm init" to initialize.'
    );
  }

  const raw = readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);

  cachedConfig = ConfigSchema.parse({
    ...parsed,
    dbPath: join(root, parsed.dbPath || `${DEFAULT_DATA_DIR}/flowsfarm.db`),
    workflowsPath: join(root, parsed.workflowsPath || `${DEFAULT_DATA_DIR}/workflows`),
  });

  return cachedConfig;
}

export function initConfig(root: string = process.cwd()): Config {
  const configPath = join(root, CONFIG_FILE);
  const dataDir = join(root, DEFAULT_DATA_DIR);

  // Create data directory
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create workflows directory
  const workflowsDir = join(dataDir, 'workflows');
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }

  const config = {
    version: '1',
    dbPath: `${DEFAULT_DATA_DIR}/flowsfarm.db`,
    workflowsPath: `${DEFAULT_DATA_DIR}/workflows`,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Set and return the config
  projectRoot = root;
  cachedConfig = ConfigSchema.parse({
    ...config,
    dbPath: join(root, config.dbPath),
    workflowsPath: join(root, config.workflowsPath),
  });

  return cachedConfig;
}

export function isInitialized(path: string = process.cwd()): boolean {
  return existsSync(join(path, CONFIG_FILE));
}
