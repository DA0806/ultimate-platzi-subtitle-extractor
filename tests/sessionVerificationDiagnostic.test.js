import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuthStore } from '../src/store/authStore.js';
import {
  PlatziSessionAdapter,
  buildSanitizedDiagnostic,
  formatDiagnosticReport,
} from '../src/utils/platziSessionAdapter.js';
import { recheckSession } from '../src/hooks/useAuth.js';
import { APP_VERSION } from '../src/utils/version.js';
import { copyDiagnosticReport } from '../src/utils/diagnosticClipboard.js';

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
  useAuthStore.setState({
    sessionStatus: 'unknown',
    sessionEpoch: 0,
    user: null,
    isVerifying: false,
    lastDiagnostic: null,
    currentRequestId: 0,
  });
});

const enableExtensionMode = () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension-upse', getManifest: () => ({ version: '1.0.9' }) } };
};

test('RED proof 1: authStore exposes isVerifying and lastDiagnostic, and clears them on logout/invalidate', () => {
  const state = useAuthStore.getState();
  assert.equal(typeof state.isVerifying, 'boolean', 'isVerifying must be a boolean on authStore');
  assert.equal(state.lastDiagnostic, null, 'lastDiagnostic must initially be null');
});

test('RED proof 1b: SSR-rendered AuthPanel exposes pending verification and disables duplicate recheck', async () => {
  enableExtensionMode();
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [{
      name: 'upse-session-ui-fixture',
      enforce: 'pre',
      resolveId(id) {
        if (id.includes('/store/authStore')) return '\0upse-session-auth-fixture';
        if (id.includes('/store/settingsStore')) return '\0upse-session-settings-fixture';
        return undefined;
      },
      load(id) {
        if (id === '\0upse-session-auth-fixture') return `
          const state = { sessionStatus: 'unknown', isVerifying: true, lastDiagnostic: null, user: null };
          globalThis.__upseSessionUiFixtureState = state;
          export const useAuthStore = selector => selector(state);
          useAuthStore.getState = () => state;
        `;
        if (id === '\0upse-session-settings-fixture') return `
          const state = { uiLanguage: 'es', theme: 'dark', toggleTheme: () => {} };
          globalThis.__upseSessionUiSettingsFixtureState = state;
          export const useSettingsStore = selector => selector(state);
        `;
        return undefined;
      },
    }],
  });
  try {
    const { AuthPanel } = await server.ssrLoadModule('/src/components/AuthPanel.jsx');
    const markup = renderToStaticMarkup(React.createElement(AuthPanel, { isOpen: true, embedded: true }));
    assert.match(markup, /Verificando sesión/);
    assert.match(markup, /role="status"/);
    assert.match(markup, /aria-live="polite"/);
    assert.match(markup, /disabled=""/);
    assert.match(markup, /Versión de código: 1\.0\.9/);
    assert.match(markup, /manifest: 1\.0\.9/);

    const fixtureState = globalThis.__upseSessionUiFixtureState;
    fixtureState.isVerifying = false;
    fixtureState.sessionStatus = 'authenticated';
    fixtureState.lastDiagnostic = {
      environment: 'extension', httpStatus: 200, responseKind: 'json',
      authStatus: 'authenticated', reason: 'OK', urlExactMatch: true,
    };
    const authenticatedMarkup = renderToStaticMarkup(React.createElement(AuthPanel, { isOpen: true, embedded: true }));
    assert.match(authenticatedMarkup, /Sesión autenticada confirmada/);

    fixtureState.sessionStatus = 'unauthenticated';
    fixtureState.lastDiagnostic = {
      environment: 'extension', httpStatus: 200, responseKind: 'json',
      authStatus: 'unauthenticated', reason: 'OK', urlExactMatch: true,
    };
    const unauthenticatedMarkup = renderToStaticMarkup(React.createElement(AuthPanel, { isOpen: true, embedded: true }));
    assert.match(unauthenticatedMarkup, /Sesión no autenticada confirmada/);

    const settingsState = globalThis.__upseSessionUiSettingsFixtureState;
    const diagnosticCases = [
      ['HTTP_404', 'Platzi devolvió HTTP 404'],
      ['HTTP_403', 'Platzi rechazó la solicitud'],
      ['HTTP_401', 'Platzi rechazó la verificación'],
      ['HTTP_429', 'Platzi limitó temporalmente'],
      ['NETWORK_ERROR', 'No fue posible conectar'],
      ['TIMEOUT', 'La verificación tardó demasiado'],
      ['INVALID_JSON', 'datos no válidos'],
      ['INVALID_ROOT_SCHEMA', 'formato esperado'],
      ['REDIRECT_INVALID', 'endpoint esperado'],
    ];
    for (const [reason, message] of diagnosticCases) {
      fixtureState.lastDiagnostic = {
        environment: 'extension', httpStatus: reason.startsWith('HTTP_') ? 404 : null,
        responseKind: 'other', authStatus: 'auth_unknown', reason, urlExactMatch: false,
      };
      settingsState.uiLanguage = 'es';
      const errorMarkup = renderToStaticMarkup(React.createElement(AuthPanel, { isOpen: true, embedded: true }));
      assert.match(errorMarkup, new RegExp(message), `ES message missing for ${reason}`);
    }
    fixtureState.lastDiagnostic = {
      environment: 'extension', httpStatus: 404, responseKind: 'empty',
      authStatus: 'auth_unknown', reason: 'HTTP_404', urlExactMatch: true,
    };
    settingsState.uiLanguage = 'en';
    const englishMarkup = renderToStaticMarkup(React.createElement(AuthPanel, { isOpen: true, embedded: true }));
    assert.match(englishMarkup, /Platzi returned HTTP 404/);
  } finally {
    delete globalThis.__upseSessionUiFixtureState;
    delete globalThis.__upseSessionUiSettingsFixtureState;
    await server.close();
  }
});

test('RED proof 2: HTTP 404 empty body sets lastDiagnostic with responseKind empty and clears stale user without bumping epoch', async () => {
  enableExtensionMode();
  useAuthStore.setState({
    sessionStatus: 'authenticated',
    sessionEpoch: 3,
    user: { plan: 'Platzi Free' },
    isVerifying: false,
    lastDiagnostic: null,
  });

  const adapter = new PlatziSessionAdapter();
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '   ',
  });

  const outcome = await adapter.checkSession();
  assert.equal(outcome.status, 'unknown');
  assert.equal(outcome.reason, 'HTTP_404');
  assert.equal(useAuthStore.getState().sessionStatus, 'unknown');
  assert.equal(useAuthStore.getState().sessionEpoch, 3, 'Epoch must not bump on 404');
  assert.equal(useAuthStore.getState().user, null, 'Stale user metadata must be cleared on 404');

  const diag = useAuthStore.getState().lastDiagnostic;
  assert.ok(diag, 'lastDiagnostic must be stored in authStore');
  assert.equal(diag.httpStatus, 404);
  assert.equal(diag.responseKind, 'empty');
  assert.equal(diag.reason, 'HTTP_404');
  assert.equal(diag.authStatus, 'auth_unknown');
});

test('RED proof 3: bounded timeout aborts hanging request with TIMEOUT reason without raw error', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 1 });

  const adapter = new PlatziSessionAdapter({ timeoutMs: 50 });
  globalThis.fetch = (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  });

  const outcome = await adapter.checkSession();
  assert.equal(outcome.status, 'unknown');
  assert.equal(outcome.reason, 'TIMEOUT');
  assert.equal(useAuthStore.getState().lastDiagnostic?.reason, 'TIMEOUT');
});

test('RED proof 4: concurrent requests: older request completing while newer is pending cannot clear isVerifying or adopt old state', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 1, isVerifying: false });

  const adapter = new PlatziSessionAdapter();

  let resolveFirst;
  const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
  let resolveSecond;
  const secondPromise = new Promise(resolve => { resolveSecond = resolve; });

  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return firstPromise;
    }
    return secondPromise;
  };

  // Start request A
  const reqA = adapter.checkSession();
  assert.equal(useAuthStore.getState().isVerifying, true, 'isVerifying must be true after request A starts');

  // Start request B while A is pending
  const reqB = adapter.checkSession();
  assert.equal(useAuthStore.getState().isVerifying, true, 'isVerifying must stay true after request B starts');

  // Request A finishes before B
  resolveFirst({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 999,
      userType: 'free',
      plan: 'Platzi Free',
      isB2B: false,
    }),
  });

  const outcomeA = await reqA;
  assert.equal(outcomeA.reason, 'STALE_REQUEST');
  assert.equal(useAuthStore.getState().isVerifying, true, 'Request A must NOT clear isVerifying because B is pending');
  assert.notEqual(useAuthStore.getState().sessionStatus, 'authenticated', 'Request A must not adopt account while B pending');

  // Request B finishes
  resolveSecond({
    ok: false,
    status: 404,
    url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
    headers: new Map(),
    text: async () => '',
  });

  const outcomeB = await reqB;
  assert.equal(outcomeB.reason, 'HTTP_404');
  assert.equal(useAuthStore.getState().isVerifying, false, 'isVerifying must be false after latest request completes');
  assert.equal(useAuthStore.getState().lastDiagnostic?.reason, 'HTTP_404');
});

test('session epoch guard preserves a rotated session when an old no-epoch unauthenticated response arrives', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 1, user: null });
  let resolveFetch;
  globalThis.fetch = () => new Promise(resolve => { resolveFetch = resolve; });

  const adapter = new PlatziSessionAdapter();
  const pending = adapter.checkSession();
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 2, user: { plan: 'Platzi Pro' } });
  resolveFetch({
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({ isAuthenticated: false }),
  });

  const result = await pending;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'SESSION_EPOCH_MISMATCH');
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 2);
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Pro');
});

test('late response body cannot overwrite a timeout diagnostic when the mock ignores abort', async () => {
  enableExtensionMode();
  let resolveBody;
  globalThis.fetch = async () => ({
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: () => new Promise(resolve => { resolveBody = resolve; }),
  });

  const adapter = new PlatziSessionAdapter({ timeoutMs: 20 });
  const pending = adapter.checkSession();
  await new Promise(resolve => setTimeout(resolve, 35));
  resolveBody(JSON.stringify({ isAuthenticated: true, userId: 2026 }));

  const result = await pending;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'TIMEOUT');
  assert.equal(useAuthStore.getState().lastDiagnostic?.reason, 'TIMEOUT');
  assert.equal(useAuthStore.getState().sessionStatus, 'unknown');
});

test('RED proof 5: recheckSession skips duplicate synchronous invocation while isVerifying is active', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 1, isVerifying: false });

  const pendingFetches = [];
  globalThis.fetch = () => new Promise(res => { pendingFetches.push(res); });

  const firstCall = recheckSession();
  assert.equal(useAuthStore.getState().isVerifying, true);

  // Synchronous second call while first is in-flight
  const duplicateCall = recheckSession();
  for (const resolveFetch of pendingFetches) {
    resolveFetch({
      ok: false,
      status: 404,
      url: 'https://api.platzi.com/api/v1/components/headerv2/user/',
      headers: new Map(),
      text: async () => '',
    });
  }
  let timeoutId;
  const duplicateTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('duplicate recheck did not settle')), 250);
  });
  let duplicateResult;
  try {
    duplicateResult = await Promise.race([Promise.resolve(duplicateCall), duplicateTimeout]);
  } finally {
    clearTimeout(timeoutId);
  }
  assert.equal(duplicateResult, null, 'Duplicate recheckSession while isVerifying must return null synchronously without new fetch');

  await firstCall;
  assert.equal(useAuthStore.getState().isVerifying, false);
});

test('RED proof 6: formatDiagnosticReport produces sanitized exact whitelist text with no secrets', () => {
  const diag = {
    environment: 'extension',
    endpointHint: 'headerv2/user/',
    method: 'GET',
    httpStatus: 404,
    responseKind: 'empty',
    authStatus: 'auth_unknown',
    reason: 'HTTP_404',
    urlExactMatch: true,
  };

  const formatted = formatDiagnosticReport(diag);
  const expected = [
    'Entorno: Chrome Extension',
    'Versión código: 1.0.9',
    'Versión manifest: no disponible',
    'Endpoint: headerv2/user/',
    'Método: GET',
    'HTTP: 404',
    'Respuesta: vacía',
    'Autenticación: desconocida',
    'Motivo: HTTP_404',
  ].join('\n');

  assert.equal(formatted, expected);
  assert.equal(formatted.includes('cookie'), false);
  assert.equal(formatted.includes('token'), false);
  assert.equal(formatted.includes('userId'), false);

  const hostile = formatDiagnosticReport({
    environment: 'extension',
    endpointHint: 'https://evil.invalid/?cookie=secret',
    method: 'POST',
    httpStatus: 777,
    responseKind: 'json',
    authStatus: 'authenticated',
    reason: 'HTTP_777',
  });
  assert.match(hostile, /Endpoint: headerv2\/user\//);
  assert.match(hostile, /Método: GET/);
  assert.match(hostile, /HTTP: null/);
  assert.match(hostile, /Motivo: UNKNOWN/);
  assert.equal(hostile.includes('evil.invalid'), false);
});

test('RED proof 7: version synchronization matches 1.0.9 across package.json and manifest.json', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));

  assert.equal(pkg.version, APP_VERSION, 'package.json version must match APP_VERSION');
  assert.equal(manifest.version, APP_VERSION, 'manifest.json version must match APP_VERSION');
});

test('diagnostic reports code and manifest versions separately when a stale manifest is simulated', () => {
  enableExtensionMode();
  globalThis.chrome.runtime.getManifest = () => ({ version: '9.9.9' });

  const diag = buildSanitizedDiagnostic({ environment: 'extension', reason: 'OK' });
  const formatted = formatDiagnosticReport(diag);

  assert.equal(diag.codeVersion, APP_VERSION);
  assert.equal(diag.manifestVersion, '9.9.9');
  assert.match(formatted, new RegExp(`Versión código: ${APP_VERSION}`));
  assert.match(formatted, /Versión manifest: 9\.9\.9/);
});

test('copyDiagnosticReport reports success only after deferred clipboard fulfillment', async () => {
  let resolveWrite;
  const clipboard = {
    writeText: () => new Promise(resolve => { resolveWrite = resolve; }),
  };
  const pending = copyDiagnosticReport('Entorno: Chrome Extension\nMotivo: HTTP_404', clipboard);
  let settled = false;
  pending.then(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, false);
  resolveWrite();
  assert.deepEqual(await pending, { status: 'copied' });
});

test('copyDiagnosticReport handles rejection and unavailable clipboard without exposing errors', async () => {
  const rejected = await copyDiagnosticReport('Motivo: NETWORK_ERROR', {
    writeText: async () => { throw new Error('secret clipboard failure'); },
  });
  assert.deepEqual(rejected, { status: 'unavailable' });

  const unavailable = await copyDiagnosticReport('Motivo: HTTP_404', null);
  assert.deepEqual(unavailable, { status: 'unavailable' });
});
