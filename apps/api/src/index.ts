import { healthPath } from '@thesiswatch/shared';
import type { HealthResponse } from '@thesiswatch/shared';
import { Hono } from 'hono';

const app = new Hono();

app.get(healthPath, (context) => context.json<HealthResponse>({ status: 'ok' }));

export default app;
