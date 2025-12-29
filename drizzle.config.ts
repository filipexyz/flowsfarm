import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './packages/core/src/storage/migrations',
  schema: './packages/core/src/storage/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.FLOWSFARM_DB_PATH || '.flowsfarm/flowsfarm.db',
  },
});
