import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { Buffer } from 'node:buffer';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { useAuthStore } from '../src/store/authStore.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';
import { defaultAuthorizationService } from '../src/utils/authorizationService.js';
import { getClassRevision } from '../src/utils/platziAccess.js';

const originalAdapter = defaultAuthorizationService.adapter;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-export-harness-'));
const outputFiles = [];
const pendingWrites = [];

fileSaver.saveAs = (blob, name) => {
  const target = path.join(outputDir, name);
  const write = blob.arrayBuffer().then(bytes => fs.writeFile(target, Buffer.from(bytes))).then(() => outputFiles.push(target));
  pendingWrites.push(write);
};

const { copyMergedTxt, downloadVideoTxt, downloadMergedTxt, downloadZip } = await import(`../src/utils/downloader.js?export-harness=${Date.now()}`);

const identity = {
  courseId: 101,
  classId: 202,
  canonicalUrl: 'https://platzi.com/cursos/harness/fixture/',
};

const proof = {
  proofId: `harness-${Date.now()}`,
  ...identity,
  sessionAccount: 'harness-account',
  sessionEpoch: 0,
  classRevision: getClassRevision('harness-account', 0, identity.canonicalUrl),
  expiresAt: Date.now() + 60_000,
  authorizedVttUrls: ['https://static.platzi.com/harness.vtt'],
  capabilities: {
    verified: true,
    authenticated: true,
    canView: true,
    canExport: true,
    canExportSubtitles: true,
    accountId: 'harness-account',
    sessionEpoch: 0,
    ...identity,
    expiresAt: Date.now() + 60_000,
  },
};

const videos = [
  {
    id: 'fixture-1', slug: 'primera', title: 'Primera', url: identity.canonicalUrl,
    status: 'ready', selected: true,
    extractedContent: { es: '1\n00:00:00.000 --> 00:00:01.000\nContenido propio uno' },
    authorizationProof: proof,
  },
  {
    id: 'fixture-2', slug: 'segunda', title: 'Segunda', url: identity.canonicalUrl,
    status: 'ready', selected: true,
    extractedContent: { es: '1\n00:00:01.000 --> 00:00:02.000\nContenido propio dos' },
    authorizationProof: { ...proof, proofId: `${proof.proofId}-2`, classId: 202 },
  },
];

const authorizedAdapter = {
  async checkSession() { return { status: 'verified', authenticated: true, accountId: 'harness-account', sessionEpoch: 0, expiresAt: Date.now() + 60_000 }; },
  async checkClassAccess() { return { status: 'verified', canView: true, accountId: 'harness-account', sessionEpoch: 0, ...identity, expiresAt: Date.now() + 60_000 }; },
  async checkExportPermission() { return { status: 'verified', canExport: true, accountId: 'harness-account', sessionEpoch: 0, ...identity, expiresAt: Date.now() + 60_000 }; },
};

const setClipboard = () => {
  let value = '';
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async text => { value = text; } } },
  });
  return () => value;
};

afterEach(() => {
  defaultAuthorizationService.adapter = originalAdapter;
  useSubtitleStore.getState().reset();
  useAuthStore.setState({ sessionStatus: 'unknown', sessionEpoch: 0 });
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
});

test('isolated export harness exercises real TXT, merged TXT, ZIP and clipboard side effects', async () => {
  defaultAuthorizationService.adapter = authorizedAdapter;
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  useSubtitleStore.setState({ videos });
  const readClipboard = setClipboard();

  await downloadVideoTxt(videos[0], 'es', 'harness', 0);
  await downloadMergedTxt(videos, 'es', 'harness');
  await downloadZip(videos, 'es', 'harness');
  await copyMergedTxt(videos, 'es');
  await Promise.all(pendingWrites);

  const names = outputFiles.map(file => path.basename(file));
  assert.deepEqual(names, ['harness-clase-01-primera.es.txt', 'harness-es.txt', 'harness.zip'], 'individual TXT, merged TXT and ZIP must be written');
  assert.match(await fs.readFile(outputFiles[0], 'utf8'), /Contenido propio uno/);
  assert.match(await fs.readFile(outputFiles[1], 'utf8'), /Contenido propio uno[\s\S]*Contenido propio dos/);

  const archive = await JSZip.loadAsync(await fs.readFile(outputFiles[2]));
  assert.deepEqual(Object.keys(archive.files), ['clase-01-primera.es.txt', 'clase-02-segunda.es.txt']);
  assert.equal(await archive.files['clase-02-segunda.es.txt'].async('string'), videos[1].extractedContent.es);
  assert.match(readClipboard(), /Contenido propio uno[\s\S]*Contenido propio dos/);
});
