export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLevel: LogLevel = 'info';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[currentLevel];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};
