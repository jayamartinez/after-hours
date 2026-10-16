import type { HealthResponse } from '@after-hours/contracts';
import { Hono } from 'hono';

export const healthRoutes = new Hono().get('/health', (c) =>
  c.json({ status: 'ok', service: 'after-hours-server' } satisfies HealthResponse),
);
