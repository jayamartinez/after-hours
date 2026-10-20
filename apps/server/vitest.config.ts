import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Route suites each start an in-memory PGlite and apply every migration in `beforeAll`;
    // run side by side on a busy machine that can pass the 10 s default.
    hookTimeout: 30_000,
  },
});
