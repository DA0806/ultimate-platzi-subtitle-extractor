import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithRetry } from '../src/utils/requestWithRetry.js';

test('requestWithRetry retries 429 with Retry-After and runs the gate on every attempt', async () => {
  let attempts = 0;
  let gates = 0;
  const result = await requestWithRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('rate limited');
        error.status = 429;
        error.retryAfter = 0;
        throw error;
      }
      return 'ok';
    },
    async () => { gates += 1; },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.equal(gates, 2);
});

test('requestWithRetry does not retry 401/403 authorization failures', async () => {
  let attempts = 0;
  await assert.rejects(
    requestWithRetry(async () => {
      attempts += 1;
      const error = new Error('unauthorized');
      error.status = 401;
      throw error;
    }, async () => {}),
    error => error.status === 401,
  );
  assert.equal(attempts, 1);
});
