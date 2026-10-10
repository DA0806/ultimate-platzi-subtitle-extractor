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

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
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
  globalThis.fetch = async () => {
    requests += 1;
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
  assert.equal(manifest.version, '1.0.7');
  assert.equal(manifest.permissions?.includes('cookies') ?? false, false);
});

test('getPlatziPage standardizes 401 and 403 errors as PLATZI_SESSION_INVALIDATED', async () => {
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
    error => error.code === 'PLATZI_SESSION_INVALIDATED' && error.status === 401,
  );

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    text: async () => 'Forbidden',
    headers: new Map(),
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_SESSION_INVALIDATED' && error.status === 403,
  );
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

test('extension gateway rejects a login redirect as session invalidation', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://platzi.com/login/?next=/cursos/demo/',
    text: async () => '<html />',
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/demo/'),
    error => error.code === 'PLATZI_SESSION_INVALIDATED' && error.status === 401,
  );
});

test('getVtt rejects when proof sessionEpoch does not match current session epoch', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };

  const proof = {
    status: 'free',
    pageUrl: 'https://platzi.com/cursos/demo/',
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/demo-es.vtt'],
    sessionEpoch: 0,
    expiresAt: Date.now() + 600_000,
    sessionAccount: 'account-a',
    capabilities: { verified: true },
  };

  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionEpoch: 5 });

  await assert.rejects(
    getVtt('https://static.platzi.com/media/subtitle/demo-es.vtt', 'https://platzi.com/cursos/demo/', null, proof),
    error => error.code === 'PLATZI_SESSION_INVALIDATED',
  );
});
