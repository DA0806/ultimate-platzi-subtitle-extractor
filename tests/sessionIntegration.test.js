import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';
import {
  PlatziSessionAdapter,
  platziSessionAdapter,
  checkResourceDiagnostics,
} from '../src/utils/platziSessionAdapter.js';
import {
  resolvePublicClassIdentity,
} from '../src/utils/platziAccess.js';
import {
  AuthorizationService,
  defaultAuthorizationService,
  getSessionValidityDeadline,
} from '../src/utils/authorizationService.js';
import { useAuthStore } from '../src/store/authStore.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';
import { parsePlatziUrl } from '../src/utils/courseParser.js';
import { recheckSession } from '../src/hooks/useAuth.js';

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;
const originalDOMParser = globalThis.DOMParser;

const setupMockDOMParser = () => {
  globalThis.DOMParser = class MockDOMParser {
    parseFromString(html) {
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
      const canonicalHref = canonicalMatch ? canonicalMatch[1] : '';

      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const titleText = titleMatch ? titleMatch[1].trim() : '';

      const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
      const scripts = scriptMatches.map(m => ({ textContent: m[1] }));

      return {
        title: titleText,
        querySelector(selector) {
          if (selector === 'link[rel="canonical"]') {
            return canonicalHref ? { href: canonicalHref } : null;
          }
          if (selector === 'h1') {
            return h1Text ? { textContent: h1Text } : null;
          }
          return null;
        },
        querySelectorAll(selector) {
          if (selector === 'script') {
            return scripts;
          }
          return [];
        },
      };
    }
  };
};

const resetAdapter = (adapter = platziSessionAdapter) => {
  adapter.lastVerifiedAccountId = null;
  adapter.requestIdCounter = 0;
  adapter.latestCompletedRequestId = 0;
};

beforeEach(() => {
  resetAdapter();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 0, user: null });
  useSubtitleStore.setState({ videos: [], extractedCount: 0 });
});

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
  globalThis.DOMParser = originalDOMParser;
  resetAdapter();
});

const enableExtensionMode = () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension-id' } };
};

// -------------------------------------------------------------
// 1. Session Adapter Schema & Isolation Tests
// -------------------------------------------------------------

test('PlatziSessionAdapter: non-extension environment returns unknown with EXTENSION_ONLY_AUTH', async () => {
  globalThis.location = { protocol: 'https:' };
  globalThis.chrome = undefined;

  const adapter = new PlatziSessionAdapter();
  const result = await adapter.checkSession();

  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'EXTENSION_ONLY_AUTH');
  assert.equal(result.authenticated, false);
});

test('PlatziSessionAdapter: uses strict fetch options (credentials: include, redirect: error, cache: no-store, Accept: JSON)', async () => {
  enableExtensionMode();

  let capturedOptions;
  globalThis.fetch = async (_url, options) => {
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ isAuthenticated: true, userId: 101 }),
    };
  };

  const adapter = new PlatziSessionAdapter();
  await adapter.checkSession();

  assert.equal(capturedOptions.method, 'GET');
  assert.equal(capturedOptions.credentials, 'include');
  assert.equal(capturedOptions.redirect, 'error');
  assert.equal(capturedOptions.cache, 'no-store');
  assert.equal(capturedOptions.headers['Accept'], 'application/json');
});

test('PlatziSessionAdapter: HTTP 403 returns unknown without invalidating existing session', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 5 });

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '{"detail":"forbidden"}',
  });

  const adapter = new PlatziSessionAdapter();
  const result = await adapter.checkSession();

  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'HTTP_403');
  // Must preserve last identity and epoch!
  assert.equal(useAuthStore.getState().sessionStatus, 'unknown');
  assert.equal(useAuthStore.getState().sessionEpoch, 5);
});

test('PlatziSessionAdapter: network error or missing Content-Type returns unknown with sanitized reason', async () => {
  enableExtensionMode();

  // 1. Missing Content-Type
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map(), // no content-type
    text: async () => JSON.stringify({ isAuthenticated: true, userId: 1 }),
  });

  const adapter = new PlatziSessionAdapter();
  const resMissingMime = await adapter.checkSession();
  assert.equal(resMissingMime.status, 'unknown');
  assert.equal(resMissingMime.reason, 'NON_JSON_CONTENT_TYPE');

  // 2. HTML Content-Type
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => '<html>Cloudflare Challenge</html>',
  });

  const resHtml = await adapter.checkSession();
  assert.equal(resHtml.status, 'unknown');
  assert.equal(resHtml.reason, 'NON_JSON_CONTENT_TYPE');
});

test('PlatziSessionAdapter: redirected response to non-endpoint origin or with query/hash returns unknown', async () => {
  enableExtensionMode();

  const adapter = new PlatziSessionAdapter();

  // Non-endpoint origin/path
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://platzi.com/login/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({ isAuthenticated: false }),
  });

  const resOrigin = await adapter.checkSession();
  assert.equal(resOrigin.status, 'unknown');
  assert.equal(resOrigin.reason, 'REDIRECT_INVALID');

  // Exact endpoint origin but with query string
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/?redirect=1',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({ isAuthenticated: false }),
  });

  const resQuery = await adapter.checkSession();
  assert.equal(resQuery.status, 'unknown');
  assert.equal(resQuery.reason, 'REDIRECT_INVALID');

  // Subpath under header/v2/user/
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/nested/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({ isAuthenticated: false }),
  });

  const resSubpath = await adapter.checkSession();
  assert.equal(resSubpath.status, 'unknown');
  assert.equal(resSubpath.reason, 'REDIRECT_INVALID');
});

test('PlatziSessionAdapter: rejects nested schema (heuristics/guesses) and requires exact root schema', async () => {
  enableExtensionMode();

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      data: {
        isAuthenticated: true,
        user: { id: 12345 },
      },
    }),
  });

  const adapter = new PlatziSessionAdapter();
  const result = await adapter.checkSession();

  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'INVALID_ROOT_SCHEMA');
});

test('PlatziSessionAdapter: invalid userId (string, 0, negative, NaN) returns unknown', async () => {
  enableExtensionMode();

  const invalidPayloads = [
    { isAuthenticated: true, userId: '12345' },
    { isAuthenticated: true, userId: 0 },
    { isAuthenticated: true, userId: -99 },
    { isAuthenticated: true, userId: Number.NaN },
    { isAuthenticated: true, userId: 1.5 },
  ];

  const adapter = new PlatziSessionAdapter();
  for (const payload of invalidPayloads) {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify(payload),
    });

    const result = await adapter.checkSession();
    assert.equal(result.status, 'unknown', `Payload ${JSON.stringify(payload)} should be rejected`);
    assert.equal(result.reason, 'INVALID_USER_ID');
  }
});

test('PlatziSessionAdapter: isAuthenticated: false HTTP 200 confirms unauthenticated state and purges user metadata', async () => {
  enableExtensionMode();
  useAuthStore.setState({
    sessionStatus: 'authenticated',
    sessionEpoch: 2,
    user: { plan: 'Platzi Free', userType: 'free' },
  });

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: false,
    }),
  });

  const adapter = new PlatziSessionAdapter();
  const result = await adapter.checkSession();

  assert.equal(result.status, 'unauthenticated');
  assert.equal(result.authenticated, false);
  assert.equal(result.sessionExpiresAt, null);
  assert.ok(result.observedAt > 0);
  assert.ok(result.validUntil > result.observedAt);
  // Store user metadata must be purged
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().sessionStatus, 'unauthenticated');
});

test('PlatziSessionAdapter: valid verified session extracts strictly root fields, sanitizes PII, sets short TTL', async () => {
  enableExtensionMode();

  let fetchCredentials;
  globalThis.fetch = async (url, options) => {
    fetchCredentials = options?.credentials;
    return {
      ok: true,
      status: 200,
      url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({
        isAuthenticated: true,
        userId: 98765,
        userType: 'pay_annual',
        plan: 'Platzi Empresarial',
        isB2B: true,
        name: 'Secret User',
        email: 'secret@example.com',
        licenseEndDate: '2028-12-31',
        paymentInfo: { card: '4111' },
      }),
    };
  };

  const adapter = new PlatziSessionAdapter();
  const before = Date.now();
  const result = await adapter.checkSession();
  const after = Date.now();

  assert.equal(fetchCredentials, 'include', 'Must use native fetch with credentials: include');
  assert.equal(result.status, 'verified');
  assert.equal(result.authenticated, true);
  assert.equal(result.accountId, '98765');
  assert.equal(result.accountType, 'pay_annual');
  assert.equal(result.plan, 'Platzi Empresarial');
  assert.equal(result.isB2B, true);
  assert.equal(result.sessionExpiresAt, null);
  assert.equal('expiresAt' in result, false, 'Do NOT set expiresAt to fake HTTP expiry');
  assert.equal('name' in result, false, 'No PII name');
  assert.equal('email' in result, false, 'No PII email');
  assert.equal('licenseEndDate' in result, false, 'No license date');
  assert.equal('paymentInfo' in result, false, 'No payment info');

  assert.ok(result.observedAt >= before && result.observedAt <= after);
  assert.equal(result.validUntil, result.observedAt + 30_000);
});

test('PlatziSessionAdapter: account switch (A -> B) invalidates previous authorizations and rotates epoch', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 1 });

  const adapter = new PlatziSessionAdapter();

  // First session observation: user 1001
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 1001,
      userType: 'free',
      plan: 'Platzi Free',
      isB2B: false,
    }),
  });

  const resA = await adapter.checkSession();
  assert.equal(resA.accountId, '1001');
  assert.equal(resA.sessionEpoch, 1);
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Free');

  // Second session observation: user 2002 (switch accounts!)
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 2002,
      userType: 'pay_annual',
      plan: 'Platzi Empresarial',
      isB2B: true,
    }),
  });

  const resB = await adapter.checkSession();
  assert.equal(resB.accountId, '2002');
  assert.equal(resB.sessionEpoch, 2, 'Epoch must be incremented upon account rotation');
  assert.equal(useAuthStore.getState().sessionEpoch, 2);
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Empresarial');
  assert.equal(useAuthStore.getState().lastDiagnostic?.reason, 'ACCOUNT_CHANGED');
});

test('PlatziSessionAdapter: stale in-flight check cannot overwrite state after logout or epoch rotation', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 10 });

  let resolveFetch;
  const delayedFetch = new Promise(resolve => { resolveFetch = resolve; });
  globalThis.fetch = async () => delayedFetch;

  const adapter = new PlatziSessionAdapter();
  const checkPromise = adapter.checkSession();

  // User logs out while check is in flight!
  useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().sessionStatus, 'unauthenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 11);

  // In-flight fetch completes with authenticated response from old account
  resolveFetch({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 999,
      userType: 'free',
    }),
  });

  const staleResult = await checkPromise;
  assert.equal(staleResult.status, 'unknown');
  assert.equal(staleResult.reason, 'SESSION_EPOCH_MISMATCH');
  // State remains unauthenticated with new epoch!
  assert.equal(useAuthStore.getState().sessionStatus, 'unauthenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 11);
});

// -------------------------------------------------------------
// Concurrency & Observation Ordering Tests (Finding 1)
// -------------------------------------------------------------

test('PlatziSessionAdapter ordering: concurrent requests: older delayed request finishing after newer request cannot overwrite state', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 0 });

  let resolveOlder;
  let resolveNewer;
  const olderPromise = new Promise(resolve => { resolveOlder = resolve; });
  const newerPromise = new Promise(resolve => { resolveNewer = resolve; });

  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) return olderPromise;
    return newerPromise;
  };

  const adapter = new PlatziSessionAdapter();

  // 1. Start older request (req 1)
  const req1 = adapter.checkSession();

  // 2. Start newer request (req 2)
  const req2 = adapter.checkSession();

  // 3. Newer request finishes FIRST with verified account 8888
  resolveNewer({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 8888,
      plan: 'Platzi Pro',
      userType: 'pro',
    }),
  });

  const res2 = await req2;
  assert.equal(res2.status, 'verified');
  assert.equal(res2.accountId, '8888');
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Pro');

  // 4. Older request finishes LATER with an error or unauthenticated response
  resolveOlder({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: false,
    }),
  });

  const res1 = await req1;
  assert.equal(res1.status, 'unknown');
  assert.equal(res1.reason, 'STALE_REQUEST');

  // CRITICAL: UI state and store MUST remain authenticated with account 8888!
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Pro');
  assert.equal(adapter.lastVerifiedAccountId, '8888');
});

test('recheckSession: skips a duplicate while the first verification is pending', async () => {
  enableExtensionMode();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 0 });

  let resolveOlder;
  const olderPromise = new Promise(resolve => { resolveOlder = resolve; });

  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return olderPromise;
  };

  // Call 1 begins
  const check1 = recheckSession();
  // Call 2 is rejected synchronously while call 1 is still verifying.
  const check2 = recheckSession();
  assert.equal(check2, null);
  assert.equal(callCount, 1);

  resolveOlder({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify({
      isAuthenticated: true,
      userId: 7777,
      plan: 'Platzi Expert',
    }),
  });

  await check1;
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().user?.plan, 'Platzi Expert');
});

// -------------------------------------------------------------
// Observational Freshness & getSessionValidityDeadline Tests (Finding 2)
// -------------------------------------------------------------

test('Observational freshness: expired validUntil observation becomes unknown without claiming HTTP session expiry', async () => {
  const expiredSession = {
    status: 'verified',
    authenticated: true,
    accountId: '123',
    sessionEpoch: 0,
    observedAt: Date.now() - 60_000,
    validUntil: Date.now() - 30_000,
  };

  const service = new AuthorizationService({
    async checkSession() { return expiredSession; },
    async checkClassAccess() { return { status: 'unknown' }; },
    async checkExportPermission() { return { status: 'unknown' }; },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  const decision = await service.authorize({
    courseId: 10,
    classId: 20,
    canonicalUrl: 'https://platzi.com/cursos/c/clase/',
  });

  assert.equal(decision.authenticated, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 0);
});

test('getSessionValidityDeadline: returns minimum of finite validUntil, expiresAt, and sessionExpiresAt', () => {
  assert.equal(getSessionValidityDeadline({ validUntil: 5000 }), 5000);
  assert.equal(getSessionValidityDeadline({ expiresAt: 4000 }), 4000);
  assert.equal(getSessionValidityDeadline({ sessionExpiresAt: 3000 }), 3000);
  // Real expiration bound: observation TTL cannot extend real expiration!
  assert.equal(getSessionValidityDeadline({ validUntil: 5000, expiresAt: 4000 }), 4000);
  assert.equal(getSessionValidityDeadline({ validUntil: 5000, sessionExpiresAt: 3500 }), 3500);
  assert.equal(getSessionValidityDeadline({ validUntil: 5000, expiresAt: 6000, sessionExpiresAt: 4000 }), 4000);
  // Null and non-finite values are ignored
  assert.equal(getSessionValidityDeadline({ validUntil: 5000, sessionExpiresAt: null }), 5000);
  assert.equal(getSessionValidityDeadline({ validUntil: 'invalid', expiresAt: 4000 }), 4000);
  assert.equal(getSessionValidityDeadline({ validUntil: Number.NaN, expiresAt: 4000 }), 4000);
  assert.equal(getSessionValidityDeadline(null), 0);
  assert.equal(getSessionValidityDeadline({}), 0);
});

// -------------------------------------------------------------
// 2. Public Class Identity Resolver Tests
// -------------------------------------------------------------

const buildSsrHtml = ({
  courseId = 11059,
  courseName = 'Curso de Git y GitHub',
  classId = 71787,
  className = 'Gestión de ramas en Git: creación, fusión y eliminación eficiente',
  canonicalUrl = 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
} = {}) => {
  const event = {
    category: 'material-view',
    name: 'page-view',
    properties: {
      course_id: courseId,
      course_name: courseName,
      class_id: classId,
      class_position: 12,
      class_name: className,
      class_is_free: false,
    },
  };
  const payload = `1:${JSON.stringify(['$', '$L32', null, event])}\n`;
  const scriptContent = `self.__next_f.push(${JSON.stringify([1, payload])})`;

  return `<!DOCTYPE html>
<html>
<head>
  <title>${className} - Platzi</title>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${className}</h1>
  <script>${scriptContent}</script>
</body>
</html>`;
};

const SAMPLE_SSR_HTML = buildSsrHtml();

test('resolvePublicClassIdentity: returns DOMPARSER_UNAVAILABLE when DOMParser is absent in runtime', async () => {
  globalThis.DOMParser = undefined;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
    text: async () => SAMPLE_SSR_HTML,
  });

  const result = await resolvePublicClassIdentity('https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/');
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'DOMPARSER_UNAVAILABLE');
});

test('resolvePublicClassIdentity: parses canonical document with credentials: omit and returns minimal public identity', async () => {
  setupMockDOMParser();

  let fetchCredentials;
  globalThis.fetch = async (url, options) => {
    fetchCredentials = options?.credentials;
    return {
      ok: true,
      status: 200,
      url: 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
      text: async () => SAMPLE_SSR_HTML,
    };
  };

  const result = await resolvePublicClassIdentity('https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/');

  assert.equal(fetchCredentials, 'omit', 'Must use credentials: omit for public catalog fetch');
  assert.equal(result.status, 'verified');
  assert.equal(result.source, 'public_catalog');
  assert.deepEqual(result.identity, {
    courseId: 11059,
    courseSlug: 'gitgithub',
    classId: 71787,
    classSlug: 'gestion-de-ramas-en-git-creacion-fusion',
    canonicalUrl: 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
    title: 'Gestión de ramas en Git: creación, fusión y eliminación eficiente',
  });
  // Must NOT expose class_is_free authority, player, or VTT URLs
  assert.equal('class_is_free' in result.identity, false);
  assert.equal('isFreePublic' in result.identity, false);
  assert.equal('vttUrls' in result.identity, false);
  assert.equal('canView' in result, false);
});

test('resolvePublicClassIdentity: rejects userinfo and non-standard ports (URL boundary checks)', async () => {
  const userinfoUrl = await resolvePublicClassIdentity('https://user:pass@platzi.com/cursos/gitgithub/clase/');
  assert.equal(userinfoUrl.status, 'denied');
  assert.equal(userinfoUrl.reason, 'INVALID_CLASS_URL');

  const portUrl = await resolvePublicClassIdentity('https://platzi.com:8080/cursos/gitgithub/clase/');
  assert.equal(portUrl.status, 'denied');
  assert.equal(portUrl.reason, 'INVALID_CLASS_URL');
});

test('resolvePublicClassIdentity: rejects canonical mismatch, non-Platzi URLs, and corrupted metadata', async () => {
  setupMockDOMParser();

  // 1. Non-Platzi URL
  const nonPlatzi = await resolvePublicClassIdentity('https://evil.com/cursos/gitgithub/clase/');
  assert.equal(nonPlatzi.status, 'denied');
  assert.equal(nonPlatzi.reason, 'INVALID_CLASS_URL');

  // 2. Canonical redirect mismatch
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://platzi.com/cursos/other-course/other-class/',
    text: async () => SAMPLE_SSR_HTML,
  });

  const mismatch = await resolvePublicClassIdentity('https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/');
  assert.equal(mismatch.status, 'denied');
  assert.equal(mismatch.reason, 'CANONICAL_MISMATCH');

  // 3. Corrupted HTML missing SSR data
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
    text: async () => '<html><body>No SSR data</body></html>',
  });

  const corrupt = await resolvePublicClassIdentity('https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/');
  assert.equal(corrupt.status, 'denied');
  assert.equal(corrupt.reason, 'UNKNOWN_CLASS_IDENTITY');
});

// -------------------------------------------------------------
// 3. Diagnostic Resource Call Tests (links-files) (Finding 4)
// -------------------------------------------------------------

test('checkResourceDiagnostics: links-files HTTP 200 records available resource, NEVER grants canView or canExport', async () => {
  enableExtensionMode();

  const identity = {
    courseId: 11059,
    classId: 71787,
    canonicalUrl: 'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
  };
  const session = {
    status: 'verified',
    authenticated: true,
    accountId: '12345',
    sessionEpoch: 0,
    validUntil: Date.now() + 30_000,
  };

  let capturedOptions;
  let requestedUrl;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      url: 'https://api.platzi.com/materials/v1/71787/course/11059/links-files/',
      headers: new Map([['content-type', 'application/json']]),
      // Do NOT read body in diagnostics
    };
  };

  const diag = await checkResourceDiagnostics(identity, session);

  assert.equal(requestedUrl, 'https://api.platzi.com/materials/v1/71787/course/11059/links-files/');
  assert.equal(capturedOptions.credentials, 'include');
  assert.equal(capturedOptions.redirect, 'error');
  assert.equal(capturedOptions.cache, 'no-store');
  assert.equal(capturedOptions.headers['Accept'], 'application/json');
  assert.equal(diag.status, 'observed');
  assert.equal(diag.httpStatus, 200);
  assert.equal(diag.resourceAccess, 'available');
  assert.equal(diag.resourceType, 'links-files');
  // CRITICAL: NEVER grant canView or canExport or leak accountId
  assert.equal('canView' in diag, false);
  assert.equal('canExport' in diag, false);
  assert.equal('accountId' in diag, false);
});

test('checkResourceDiagnostics: guards against epoch change and expired freshness during await', async () => {
  enableExtensionMode();

  const identity = {
    courseId: 11059,
    classId: 71787,
    canonicalUrl: 'https://platzi.com/cursos/gitgithub/c/',
  };
  const session = {
    status: 'verified',
    authenticated: true,
    accountId: '12345',
    sessionEpoch: 0,
    validUntil: Date.now() + 30_000,
  };

  // Case 1: Epoch changes during in-flight fetch
  let resolveFetch;
  const delayedFetch = new Promise(resolve => { resolveFetch = resolve; });
  globalThis.fetch = async () => delayedFetch;

  const diagPromise = checkResourceDiagnostics(identity, session);

  // Epoch changes while request is pending!
  useAuthStore.setState({ sessionEpoch: 1 });

  resolveFetch({
    ok: true,
    status: 200,
    url: 'https://api.platzi.com/materials/v1/71787/course/11059/links-files/',
    headers: new Map([['content-type', 'application/json']]),
  });

  const diagEpochMismatch = await diagPromise;
  assert.equal(diagEpochMismatch.status, 'unknown');
  assert.equal(diagEpochMismatch.resourceAccess, 'unknown');
  assert.equal(diagEpochMismatch.reason, 'SESSION_EPOCH_MISMATCH');

  // Case 2: Freshness expires during in-flight fetch
  useAuthStore.setState({ sessionEpoch: 0 });
  const almostExpiredSession = {
    status: 'verified',
    authenticated: true,
    accountId: '12345',
    sessionEpoch: 0,
    validUntil: Date.now() + 10, // expires in 10ms
  };

  globalThis.fetch = async () => {
    await new Promise(r => setTimeout(r, 20)); // wait until expired
    return {
      ok: true,
      status: 200,
      url: 'https://api.platzi.com/materials/v1/71787/course/11059/links-files/',
      headers: new Map([['content-type', 'application/json']]),
    };
  };

  const diagExpired = await checkResourceDiagnostics(identity, almostExpiredSession);
  assert.equal(diagExpired.status, 'unknown');
  assert.equal(diagExpired.resourceAccess, 'unknown');
  assert.equal(diagExpired.reason, 'SESSION_EXPIRED');
});

test('checkResourceDiagnostics: links-files HTTP 403 records denied resource, NEVER grants access', async () => {
  enableExtensionMode();

  const identity = { courseId: 11059, classId: 71787, canonicalUrl: 'https://platzi.com/cursos/git/c/' };
  const session = {
    status: 'verified',
    authenticated: true,
    accountId: '12345',
    sessionEpoch: 0,
    validUntil: Date.now() + 30_000,
  };

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    url: 'https://api.platzi.com/materials/v1/71787/course/11059/links-files/',
    headers: new Map([['content-type', 'application/json']]),
  });

  const diag = await checkResourceDiagnostics(identity, session);

  assert.equal(diag.status, 'observed');
  assert.equal(diag.httpStatus, 403);
  assert.equal(diag.resourceAccess, 'denied');
  assert.equal('canView' in diag, false);
  assert.equal('accountId' in diag, false);
});

// -------------------------------------------------------------
// 4. Production Default Authorization Service Wiring
// -------------------------------------------------------------

test('defaultAuthorizationService uses real PlatziSessionAdapter and resolves identity while keeping access fail-closed', async () => {
  enableExtensionMode();
  setupMockDOMParser();

  globalThis.fetch = async (url) => {
    if (url.includes('/components/header/v2/user/')) {
      return {
        ok: true,
        status: 200,
        url: 'https://api.platzi.com/api/v1/components/header/v2/user/',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify({
          isAuthenticated: true,
          userId: 54321,
          userType: 'free',
          plan: 'Platzi Free',
          isB2B: false,
        }),
      };
    }
    if (url.includes('/cursos/')) {
      return {
        ok: true,
        status: 200,
        url,
        text: async () => SAMPLE_SSR_HTML,
      };
    }
    return { ok: false, status: 404 };
  };

  const decision = await defaultAuthorizationService.authorizeClassUrl(
    'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
  );

  assert.equal(decision.classId, undefined);
  assert.equal(decision.verified, false);
  assert.equal(decision.canView, false);
  assert.ok(
    decision.restrictionReason === 'AUTHORIZATION_BINDING_MISMATCH' || decision.restrictionReason === 'CLASS_ACCESS_DENIED',
    `Expected fail-closed denial, got ${decision.restrictionReason}`,
  );
});

// -------------------------------------------------------------
// 5. courseParser single-class resolution without protected gate
// -------------------------------------------------------------

test('parsePlatziUrl resolves single class URL using public metadata without hitting protected gate', async () => {
  setupMockDOMParser();

  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    url,
    text: async () => SAMPLE_SSR_HTML,
  });

  const parsed = await parsePlatziUrl(
    'https://platzi.com/cursos/gitgithub/gestion-de-ramas-en-git-creacion-fusion/',
  );

  assert.equal(parsed.courseSlug, 'gitgithub');
  assert.equal(parsed.videos.length, 1);
  assert.equal(parsed.videos[0].slug, 'gestion-de-ramas-en-git-creacion-fusion');
  assert.equal(parsed.videos[0].title, 'Gestión de ramas en Git: creación, fusión y eliminación eficiente');
  assert.equal(parsed.videos[0].status, 'pending');
});

// -------------------------------------------------------------
// 6. Built Extension ZIP In-Memory Inspection
// -------------------------------------------------------------

test('built extension zip: contains valid Manifest V3, no cookies/eval/content_scripts, and exact host permissions', async (t) => {
  const zipPath = resolve(process.cwd(), 'dist/upse-extension.zip');
  if (!existsSync(zipPath)) {
    t.skip('build:extension required');
    return;
  }

  const zipBuffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);

  // 1. Verify manifest.json exists inside zip
  const manifestFile = zip.file('manifest.json');
  assert.ok(manifestFile, 'manifest.json must exist in zip');

  const manifestContent = JSON.parse(await manifestFile.async('string'));
  assert.equal(manifestContent.manifest_version, 3);
  assert.deepEqual(manifestContent.permissions, [], 'permissions must be strictly empty array');
  assert.deepEqual(manifestContent.host_permissions, [
    'https://platzi.com/*',
    'https://www.platzi.com/*',
    'https://static.platzi.com/*',
    'https://api.platzi.com/*',
  ]);
  assert.equal(manifestContent.content_scripts, undefined, 'No speculative content scripts in extension package');

  // 2. Verify HTML script sources: bundled local only (no remote scripts)
  const htmlFile = zip.file('index.html');
  assert.ok(htmlFile, 'index.html must exist in zip');
  const htmlContent = await htmlFile.async('string');
  const scriptSrcMatches = [...htmlContent.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  assert.ok(scriptSrcMatches.length > 0, 'index.html must reference bundled entry script');
  for (const match of scriptSrcMatches) {
    const src = match[1];
    assert.equal(
      src.startsWith('http:') || src.startsWith('https:') || src.startsWith('//'),
      false,
      `Remote script src forbidden in extension HTML: ${src}`,
    );
  }

  // 3. Scan bundled javascript files
  const jsFiles = Object.keys(zip.files).filter(name => name.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'Must have bundled JS files');

  const credentialPatterns = [
    /Bearer\s+[A-Za-z0-9_-]{25,}/,
    /client_secret\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i,
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    /aws_secret_access_key\s*[:=]/i,
  ];

  for (const jsFile of jsFiles) {
    const code = await zip.file(jsFile).async('string');

    // Execution safety
    assert.equal(code.includes('eval('), false, `eval must not exist in ${jsFile}`);
    assert.equal(code.includes('new Function('), false, `new Function must not exist in ${jsFile}`);
    assert.equal(/importScripts\s*\(\s*["']https?:/i.test(code), false, `remote importScripts must not exist in ${jsFile}`);

    // No test toggles or injectable global setters in production bundle
    assert.equal(code.includes('resetSessionAdapterState'), false, `reset toggles must not exist in ${jsFile}`);
    assert.equal(code.includes('__UPSE_MOCK_ADAPTER__'), false, `mock adapter toggles must not exist in ${jsFile}`);

    // Session authority is non-persistent (no saving session tokens to storage)
    assert.equal(code.includes('localStorage.setItem("platzi_session"'), false, 'platzi_session must never be persisted');
    assert.equal(code.includes("localStorage.setItem('platzi_session'"), false, 'platzi_session must never be persisted');

    // Static scan for known literal credential patterns (safe matching, no printing matched secrets)
    for (const pattern of credentialPatterns) {
      if (pattern.test(code)) {
        assert.fail(`Known credential pattern matched in ${jsFile}`);
      }
    }
  }
});
