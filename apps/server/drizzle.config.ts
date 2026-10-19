/**
 * drizzle-kit config (run via `pnpm --filter @after-hours/server db:generate`, which uses
 * `pnpm dlx` so drizzle-kit is not a workspace dependency). Generates SQL migrations into
 * `drizzle/`; `pnpm db:migrate` applies them to DATABASE_URL or the local PGlite store.
 */
export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
};
