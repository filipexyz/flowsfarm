import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@flowsfarm/core': resolve(__dirname, './packages/core/src'),
      '@flowsfarm/n8n-sync': resolve(__dirname, './packages/n8n-sync/src'),
    },
  },
});
