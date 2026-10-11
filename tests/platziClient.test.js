import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getPlatziPage,
  getVtt,
  isAllowedPlatziPageUrl,
  isAllowedVttUrl,
  isExtension,
} from '../src/utils/platziClient.js';
import { getClassRevision } from '../src/utils/platziAccess.js';
import { bumpClassRevision } from '../src/utils/platziAccess.js';
import { useAuthStore } from '../src/store/authStore.js';
import { defaultAuthorizationService } from '../src/utils/authorizationService.js';

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;
const originalAdapter = defaultAuthorizationService.adapter;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
  defaultAuthorizationService.adapter = originalAdapter;
});

test('extension mode does not require the cookies API', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, statusText: 'OK', text: async () => '<html />' };
  };

  await getPlatziPage('https://platzi.com/cursos/demo/');

  assert.equal(isExtension(), true);
  assert.equal(request.options.credentials, 'include');
  assert.equal('Cookie' in request.options.headers, false);
  assert.equal('x-platzi-cookie' in request.options.headers, false);
});

test('class gateway denies unknown identity before the first protected HTTP request', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let requests = 0;
  globalThis.fetch = async (url) => {
    if (!url || !String(url).includes('/components/headerv2/user/')) {
      requests += 1;
    }
    return { ok: true, status: 200, statusText: 'OK', text: async () => '<html />' };
  };

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/demo/una-clase/'),
    error => error.code === 'AUTHORIZATION_UNAVAILABLE',
  );
  assert.equal(requests, 0);
});

test('extension subtitle requests reject local proofs before any network request', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, statusText: 'OK', text: async () => 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello' };
  };

  await assert.rejects(
    getVtt(
      'https://static.platzi.com/media/subtitle/demo-es.vtt',
      'https://platzi.com/cursos/demo/',
      null,
      { status: 'free', pageUrl: 'https://platzi.com/cursos/demo/', vttUrls: ['https://static.platzi.com/media/subtitle/demo-es.vtt'] },
    ),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );
  assert.equal(request, undefined);
});

test('only permits HTTPS Platzi page and subtitle hosts', () => {
  assert.equal(isAllowedPlatziPageUrl('https://platzi.com/cursos/demo/'), true);
  assert.equal(isAllowedPlatziPageUrl('https://www.platzi.com/clases/demo/'), true);
  assert.equal(isAllowedPlatziPageUrl('http://platzi.com/cursos/demo/'), false);
  assert.equal(isAllowedPlatziPageUrl('https://evil.example/cursos/demo/'), false);
  assert.equal(isAllowedVttUrl('https://static.platzi.com/media/subtitle/demo-es.vtt'), true);
  assert.equal(isAllowedVttUrl('https://evil.example/demo.vtt'), false);
  assert.equal(isAllowedVttUrl('http://static.platzi.com/demo.vtt'), false);
});

test('dev gateways reject hostile or non-HTTPS URLs before proxy/network access', async () => {
  globalThis.location = { protocol: 'https:' };
  globalThis.chrome = undefined;

  await assert.rejects(
    getPlatziPage('https://evil.example/cursos/demo/'),
    error => error.code === 'INVALID_PLATZI_URL',
  );
  await assert.rejects(
    getVtt('http://static.platzi.com/media/subtitle/demo-es.vtt', 'https://platzi.com/cursos/demo/', null, null),
    error => error.code === 'INVALID_VTT_URL',
  );
});

test('ordinary pages do not activate extension mode', () => {
  globalThis.location = { protocol: 'https:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  assert.equal(isExtension(), false);
});

test('extension manifest does not request cookie access', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, '1.0.9');
  assert.equal(manifest.permissions?.includes('cookies') ?? false, false);
});

test('getPlatziPage standardizes 401 and 403 as resource errors and preserves session identity', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 10 });
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'Unauthorized',
    headers: new Map(),
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_UNAUTHORIZED' && error.status === 401,
  );
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated', 'generic 401 must NOT invalidate session');
  assert.equal(useAuthStore.getState().sessionEpoch, 10, 'generic 401 must NOT increment sessionEpoch');

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    text: async () => 'Forbidden',
    headers: new Map(),
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_FORBIDDEN' && error.status === 403,
  );
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated', 'generic 403 must NOT invalidate session');
  assert.equal(useAuthStore.getState().sessionEpoch, 10, 'generic 403 must NOT increment sessionEpoch');
});

test('getPlatziPage standardizes 429 errors as PLATZI_RATE_LIMITED with retryAfter', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };

  const headers = new Map([['retry-after', '15']]);
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    text: async () => 'Too Many Requests',
    headers: {
      get: (k) => headers.get(k.toLowerCase()) ?? null,
    },
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_RATE_LIMITED' && error.status === 429 && error.retryAfter === 15,
  );
});

test('extension gateway rejects a login redirect as resource unauthorized without invalidating session', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 10 });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://platzi.com/login/?next=/cursos/demo/',
    text: async () => '<html />',
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/demo/'),
    error => error.code === 'PLATZI_UNAUTHORIZED' && error.status === 401,
  );
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated', 'login redirect must NOT invalidate session');
  assert.equal(useAuthStore.getState().sessionEpoch, 10, 'login redirect must NOT increment sessionEpoch');
});

test('getVtt rejects when proof sessionEpoch does not match current session epoch', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };

  const proof = {
    status: 'free',
    pageUrl: 'https://platzi.com/cursos/demo/',
    canonicalUrl: 'https://platzi.com/cursos/demo/',
    courseId: 1,
    classId: 2,
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/demo-es.vtt'],
    sessionEpoch: 0,
    expiresAt: Date.now() + 600_000,
    sessionAccount: 'account-a',
    classRevision: getClassRevision('account-a', 0, 'https://platzi.com/cursos/demo/'),
    capabilities: {
      verified: true,
      authenticated: true,
      canView: true,
      canExport: true,
      canExportSubtitles: true,
      accountId: 'account-a',
      sessionEpoch: 0,
      courseId: 1,
      classId: 2,
      canonicalUrl: 'https://platzi.com/cursos/demo/',
      expiresAt: Date.now() + 600_000,
    },
  };

  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionEpoch: 5 });

  await assert.rejects(
    getVtt('https://static.platzi.com/media/subtitle/demo-es.vtt', 'https://platzi.com/cursos/demo/', null, proof),
    error => error.code === 'PLATZI_SESSION_INVALIDATED',
  );
});

test('getVtt drops delayed body content after class revocation', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  const identity = {
    courseId: 701,
    classId: 702,
    canonicalUrl: 'https://platzi.com/cursos/race/delayed-vtt/',
  };
  const account = 'delayed-vtt-account';
  const epoch = 70;
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: epoch });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: account, sessionEpoch: epoch, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: account, sessionEpoch: epoch, expiresAt: Date.now() + 60_000, ...identity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: account, sessionEpoch: epoch, expiresAt: Date.now() + 60_000, ...identity };
    },
  };
  const vttUrl = 'https://static.platzi.com/media/subtitle/delayed-vtt-es.vtt';
  const classRevision = getClassRevision(account, epoch, identity.canonicalUrl);
  const proof = {
    ...identity,
    proofId: 'delayed-vtt-proof',
    sessionAccount: account,
    sessionEpoch: epoch,
    classRevision,
    authorizedVttUrls: [vttUrl],
    expiresAt: Date.now() + 60_000,
    capabilities: {
      verified: true,
      authenticated: true,
      canView: true,
      canExport: true,
      canExportSubtitles: true,
      accountId: account,
      sessionEpoch: epoch,
      ...identity,
      expiresAt: Date.now() + 60_000,
    },
  };
  let resolveBody;
  const body = new Promise(resolve => { resolveBody = resolve; });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => body,
  });

  const request = getVtt(vttUrl, null, null, proof);
  bumpClassRevision(account, epoch, identity.canonicalUrl);
  resolveBody('WEBVTT\n\n00:00.000 --> 00:01.000\nsecret');

  await assert.rejects(request, error => error.code === 'PROOF_REVOKED');
});
