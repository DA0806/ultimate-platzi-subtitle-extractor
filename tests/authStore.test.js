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

test('rewrites legacy extension storage without cookie or token values', async () => {
  const values = new Map([
    ['platzi_session', JSON.stringify({
      state: { token: 'legacy-secret-token', cookie: 'sessionid=legacy-secret', user: { email: 'old@example.test' } },
      version: 0,
    })],
  ]);
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  globalThis.window = { localStorage: globalThis.localStorage };

  const { useAuthStore } = await import(`../src/store/authStore.js?legacy-${Date.now()}`);
  await new Promise(resolve => setTimeout(resolve, 25));
  const { isExtension } = await import('../src/utils/platziClient.js');
  assert.equal(isExtension(), true);
  assert.equal(useAuthStore.getState().cookie, null);
  const persisted = JSON.parse(values.get('platzi_session'));

  assert.equal(persisted.state.cookie, null);
  assert.equal(persisted.state.token, null);
  assert.equal(persisted.state.user.email, 'old@example.test');
});
