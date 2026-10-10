import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.localStorage = originalStorage;
  globalThis.window = originalWindow;
});

test('purges legacy extension storage without reading or rewriting its value', async () => {
  const values = new Map([
    ['platzi_session', JSON.stringify({
      state: { token: 'legacy-secret-token', cookie: 'sessionid=legacy-secret', user: { email: 'old@example.test' } },
      version: 0,
    })],
  ]);
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  globalThis.localStorage = {
    getItem: () => { throw new Error('legacy session must not be read'); },
    setItem: () => { throw new Error('legacy session must not be rewritten'); },
    removeItem: key => values.delete(key),
  };
  globalThis.window = { localStorage: globalThis.localStorage };

  const { useAuthStore } = await import(`../src/store/authStore.js?legacy-${Date.now()}`);
  const { isExtension } = await import('../src/utils/platziClient.js');
  assert.equal(isExtension(), true);
  assert.equal(useAuthStore.getState().cookie, null);
  assert.equal(values.has('platzi_session'), false);
});
