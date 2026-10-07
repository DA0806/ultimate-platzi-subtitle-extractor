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

test('extension subtitle requests use native browser credentials', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, statusText: 'OK', text: async () => 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello' };
  };

  await getVtt('https://static.platzi.com/media/subtitle/demo-es.vtt');

  assert.equal(request.options.credentials, 'include');
  assert.equal(request.url.startsWith('https://static.platzi.com/'), true);
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

test('ordinary pages do not activate extension mode', () => {
  globalThis.location = { protocol: 'https:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  assert.equal(isExtension(), false);
});

test('extension manifest does not request cookie access', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, '1.0.5');
  assert.equal(manifest.permissions?.includes('cookies') ?? false, false);
});
