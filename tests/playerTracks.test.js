import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayerAuthorizationProof,
  assertPlayerAuthorizationProof,
  probePlayerTracks,
  readPlayerTrack,
} from '../src/utils/playerTracks.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';
import { copyMergedTxt } from '../src/utils/downloader.js';
import { isTrustedPlayerMessageSender } from '../src/utils/playerMessageAuth.js';

const pageUrl = 'https://example.test/lesson/one?secret=ignored#fragment';

const makeTrack = (overrides = {}) => ({
  kind: 'subtitles',
  language: 'es',
  label: 'Español',
  mode: 'showing',
  cues: [
    { startTime: 2, endTime: 3, text: 'dos' },
    { startTime: 1, endTime: 2, text: 'uno' },
    { startTime: 1, endTime: 2, text: 'uno' },
    { startTime: 4, endTime: 5, text: 'uno' },
  ],
  ...overrides,
});

const makeDocument = (tracks) => ({
  querySelectorAll(selector) {
    assert.equal(selector, 'video');
    return [{ textTracks: tracks }];
  },
});

const context = {
  tabId: 12,
  documentId: 'document-a',
  pageUrl,
  playerId: 'player-1',
  trackId: 'track-1',
};

test('probePlayerTracks reports metadata without touching cue text', () => {
  let textReads = 0;
  const track = makeTrack({
    cues: [{ startTime: 0, endTime: 1, get text() { textReads += 1; return 'secret'; } }],
  });
  const result = probePlayerTracks({
    documentRef: makeDocument([track]),
    pageUrl,
    tabId: 12,
    documentId: 'document-a',
  });

  assert.equal(textReads, 0);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.tracks.map(({ language, label, mode }) => ({ language, label, mode })), [
    { language: 'es', label: 'Español', mode: 'showing' },
  ]);
  assert.equal(result.tracks[0].text, undefined);
  assert.equal(result.page.pathname, '/lesson/one');
});

test('player worker accepts only messages from the extension workspace', () => {
  const runtime = { id: 'extension-id', getURL: path => `chrome-extension://extension-id/${path}` };
  assert.equal(isTrustedPlayerMessageSender({ id: 'extension-id', url: 'chrome-extension://extension-id/index.html' }, runtime), true);
  assert.equal(isTrustedPlayerMessageSender({ id: 'extension-id', url: 'chrome-extension://extension-id/options.html' }, runtime), false);
  assert.equal(isTrustedPlayerMessageSender({ id: 'extension-id', url: 'chrome-extension://extension-id/index.html?from=other' }, runtime), false);
  assert.equal(isTrustedPlayerMessageSender({ id: 'extension-id', url: 'https://example.test/player' }, runtime), false);
  assert.equal(isTrustedPlayerMessageSender({ id: 'other-extension', url: 'chrome-extension://other-extension/index.html' }, runtime), false);
  assert.equal(isTrustedPlayerMessageSender({ id: 'extension-id' }, runtime), false);
});

test('probePlayerTracks permits metadata inspection on Platzi while local authorization remains denied', () => {
  const result = probePlayerTracks({
    documentRef: makeDocument([makeTrack()]),
    pageUrl: 'https://platzi.com/cursos/demo/clase-uno/?token=redacted',
    tabId: 12,
    documentId: 'document-a',
  });
  assert.equal(result.status, 'available');
  assert.equal(result.page.origin, 'https://platzi.com');
  assert.throws(
    () => createPlayerAuthorizationProof({
      pageUrl: 'https://platzi.com/cursos/demo/clase-uno/',
      tabId: 12,
      documentId: 'document-a',
      playerId: result.tracks[0].playerId,
      trackId: result.tracks[0].trackId,
      rightsConfirmed: true,
    }),
    error => error.code === 'PLAYER_PAGE_UNSUPPORTED',
  );
});

test('readPlayerTrack orders cues, preserves repeated text at different times, and removes exact duplicates', () => {
  const track = makeTrack();
  const detected = probePlayerTracks({ documentRef: makeDocument([track]), pageUrl, tabId: 12, documentId: 'document-a' });
  const readContext = { ...context, playerId: detected.tracks[0].playerId, trackId: detected.tracks[0].trackId };
  const proof = createPlayerAuthorizationProof({
    ...readContext,
    rightsConfirmed: true,
    now: 1_000,
    ttlMs: 10_000,
  });
  const result = readPlayerTrack(track, {
    proof,
    context: readContext,
    currentTrack: track,
    now: 2_000,
  });

  assert.deepEqual(result.cues, [
    { startTime: 1, endTime: 2, text: 'uno' },
    { startTime: 2, endTime: 3, text: 'dos' },
    { startTime: 4, endTime: 5, text: 'uno' },
  ]);
  assert.equal(result.text, 'uno dos uno');
  assert.equal(result.language, 'es');
});

test('readPlayerTrack rejects stale page or replaced player before storing cues', () => {
  const track = makeTrack();
  const detected = probePlayerTracks({ documentRef: makeDocument([track]), pageUrl, tabId: 12, documentId: 'document-a' });
  const readContext = { ...context, playerId: detected.tracks[0].playerId, trackId: detected.tracks[0].trackId };
  const proof = createPlayerAuthorizationProof({ ...readContext, rightsConfirmed: true, now: 1_000 });

  assert.throws(
    () => readPlayerTrack(track, {
      proof,
      context: readContext,
      currentTrack: track,
      currentContext: { ...context, pageUrl: 'https://example.test/lesson/two' },
      now: 2_000,
    }),
    error => error.code === 'PLAYER_STALE_CONTEXT',
  );

  assert.throws(
    () => readPlayerTrack(track, {
      proof,
      context: readContext,
      currentTrack: makeTrack(),
      now: 2_000,
    }),
    error => error.code === 'PLAYER_STALE_CONTEXT',
  );
});

test('player authorization rejects Platzi, unconfirmed rights, and mismatched scopes', () => {
  assert.throws(
    () => createPlayerAuthorizationProof({ ...context, rightsConfirmed: true, pageUrl: 'https://platzi.com/cursos/a/b/' }),
    error => error.code === 'PLAYER_PAGE_UNSUPPORTED',
  );
  assert.throws(
    () => createPlayerAuthorizationProof({ ...context, rightsConfirmed: false }),
    error => error.code === 'PLAYER_RIGHTS_CONFIRMATION_REQUIRED',
  );

  const proof = createPlayerAuthorizationProof({ ...context, rightsConfirmed: true, now: 1_000 });
  assert.throws(
    () => assertPlayerAuthorizationProof({ ...proof }, context, 2_000),
    error => error.code === 'PLAYER_AUTHORIZATION_REQUIRED',
  );
  assert.throws(
    () => assertPlayerAuthorizationProof(proof, { ...context, tabId: 13 }, 2_000),
    error => error.code === 'PLAYER_AUTHORIZATION_SCOPE_MISMATCH',
  );
  assert.throws(
    () => assertPlayerAuthorizationProof(proof, context, proof.expiresAt),
    error => error.code === 'PLAYER_AUTHORIZATION_EXPIRED',
  );
});

test('readPlayerTrack rejects malformed cue timing before returning content', () => {
  const track = makeTrack({ cues: [{ startTime: 3, endTime: 2, text: 'bad' }] });
  const detected = probePlayerTracks({ documentRef: makeDocument([track]), pageUrl, tabId: 12, documentId: 'document-a' });
  const readContext = { ...context, playerId: detected.tracks[0].playerId, trackId: detected.tracks[0].trackId };
  const proof = createPlayerAuthorizationProof({ ...readContext, rightsConfirmed: true, now: 1_000 });
  assert.throws(
    () => readPlayerTrack(track, { proof, context: readContext, currentTrack: track, now: 2_000 }),
    error => error.code === 'PLAYER_INVALID_CUE',
  );
});

test('readPlayerTrack rejects non-subtitle text track kinds', () => {
  const track = makeTrack({ kind: 'metadata' });
  const detected = probePlayerTracks({ documentRef: makeDocument([track]), pageUrl, tabId: 12, documentId: 'document-a' });
  const readContext = { ...context, playerId: detected.tracks[0].playerId, trackId: detected.tracks[0].trackId };
  const proof = createPlayerAuthorizationProof({ ...readContext, rightsConfirmed: true, now: 1_000 });
  assert.throws(
    () => readPlayerTrack(track, { proof, context: readContext, now: 2_000 }),
    error => error.code === 'PLAYER_TRACK_KIND_UNSUPPORTED',
  );
});

test('readPlayerTrack rejects a Platzi media or track resource on an otherwise local page', () => {
  const track = makeTrack({ src: 'https://media.platzi.com/captions.vtt' });
  const detected = probePlayerTracks({ documentRef: makeDocument([track]), pageUrl, tabId: 12, documentId: 'document-a' });
  const readContext = { ...context, playerId: detected.tracks[0].playerId, trackId: detected.tracks[0].trackId };
  const proof = createPlayerAuthorizationProof({ ...readContext, rightsConfirmed: true, now: 1_000 });
  assert.throws(
    () => readPlayerTrack(track, { proof, context: { ...readContext, mediaSrc: 'https://example.test/video.mp4' }, now: 2_000 }),
    error => error.code === 'PLAYER_RESOURCE_UNSUPPORTED',
  );
});

test('probePlayerTracks reports missing or disabled tracks without reading cues', () => {
  const result = probePlayerTracks({
    documentRef: makeDocument([
      makeTrack({ mode: 'disabled' }),
    ]),
    pageUrl,
    tabId: 12,
    documentId: 'document-a',
  });

  assert.equal(result.status, 'available');
  assert.equal(result.tracks[0].enabled, false);
  assert.equal(result.tracks[0].mode, 'disabled');
});

test('local player proof reaches the existing clipboard export sink without Platzi session authorization', async () => {
  const originalChrome = globalThis.chrome;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalVideos = useSubtitleStore.getState().videos;
  const proof = createPlayerAuthorizationProof({ ...context, rightsConfirmed: true, now: Date.now() });
  const video = {
    id: 'player-track-1',
    slug: 'player-track-1',
    title: 'Contenido propio',
    url: `${proof.origin}${proof.pathname}`,
    status: 'ready',
    selected: true,
    extractedContent: { es: 'uno dos' },
    authorizationProof: proof,
    provenance: 'user_authorized_player',
  };
  let copied = '';
  globalThis.chrome = {
    runtime: {
      sendMessage(message, callback) {
        assert.equal(message.type, 'PLAYER_VALIDATE');
        callback({ ok: true, result: { status: 'available' } });
      },
    },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value; } } } });
  useSubtitleStore.setState({ videos: [video] });
  try {
    await copyMergedTxt([video], 'es');
    assert.match(copied, /Contenido propio \[ES\][\s\S]*uno dos/);
  } finally {
    useSubtitleStore.setState({ videos: originalVideos });
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    globalThis.chrome = originalChrome;
  }
});
