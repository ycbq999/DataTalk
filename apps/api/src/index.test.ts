import assert from 'node:assert/strict';
import { test } from 'node:test';
import { healthPath } from '@thesiswatch/shared';
import app from './index.ts';

test('health check responds with JSON', async () => {
  const response = await app.request(healthPath);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
