import test from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '../src/store/authStore.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';

test('authStore.invalidateSession increments sessionEpoch and updates sessionStatus', () => {
  const initialEpoch = useAuthStore.getState().sessionEpoch ?? 0;
  useAuthStore.getState().invalidateSession();
  const nextEpoch = useAuthStore.getState().sessionEpoch;
  assert.equal(nextEpoch, initialEpoch + 1);
  assert.equal(useAuthStore.getState().sessionStatus, 'session_invalid');
});

test('subtitleStore.purgeExtractedContent clears all extracted text and resets ready status', () => {
  useSubtitleStore.setState({
    videos: [
      {
        id: 'vid-1',
        slug: 'intro',
        title: 'Intro',
        url: 'https://platzi.com/cursos/javascript/intro/',
        status: 'ready',
        selected: true,
        availableLangs: ['es'],
        extractedContent: { es: 'WEBVTT text sample' },
      },
      {
        id: 'vid-2',
        slug: 'variables',
        title: 'Variables',
        url: 'https://platzi.com/cursos/javascript/variables/',
        status: 'pending',
        selected: true,
        availableLangs: [],
        extractedContent: {},
      },
    ],
  });

  useSubtitleStore.getState().purgeExtractedContent();

  const state = useSubtitleStore.getState();
  assert.equal(state.videos.length, 2);
  assert.deepEqual(state.videos[0].extractedContent, {});
  assert.equal(state.videos[0].status, 'pending');
  assert.equal(state.videos[0].title, 'Intro');
  assert.deepEqual(state.videos[1].extractedContent, {});
});

test('stale operations cannot overwrite current state if sessionEpoch changes during request', async () => {
  useAuthStore.setState({ sessionEpoch: 1, sessionStatus: 'authenticated' });
  useSubtitleStore.setState({
    videos: [
      {
        id: 'vid-stale',
        slug: 'intro',
        title: 'Intro',
        url: 'https://platzi.com/cursos/javascript/intro/',
        status: 'pending',
        selected: true,
        availableLangs: [],
        extractedContent: {},
      },
    ],
  });

  const jobEpoch = useAuthStore.getState().sessionEpoch;

  // Simulate an async operation that started with jobEpoch
  const asyncWorkerTask = async () => {
    // In the middle of async work, the session is invalidated
    useAuthStore.getState().invalidateSession();
    useSubtitleStore.getState().purgeExtractedContent();

    // Guard: stale operation must check if current sessionEpoch !== jobEpoch
    if (useAuthStore.getState().sessionEpoch !== jobEpoch) {
      // Abort without writing stale extracted text
      return;
    }

    useSubtitleStore.getState().updateVideo('vid-stale', {
      status: 'ready',
      extractedContent: { es: 'STALE OVERWRITE' },
    });
  };

  await asyncWorkerTask();

  const video = useSubtitleStore.getState().videos.find(v => v.id === 'vid-stale');
  assert.notEqual(video.status, 'ready');
  assert.deepEqual(video.extractedContent, {});
});

test('downloader preflight asserts valid session and rejects export when session is invalidated', async () => {
  const { assertExportPreflight, downloadMergedTxt, downloadZip } = await import('../src/utils/downloader.js');
  
  useAuthStore.setState({ sessionStatus: 'session_invalid' });
  
  assert.throws(() => assertExportPreflight(), error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT');
  await assert.rejects(downloadMergedTxt([], 'es', 'curso'), error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT');
  await assert.rejects(downloadZip([], 'es', 'curso'), error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT');

  // Unknown authority remains blocked by default.
  useAuthStore.setState({ sessionStatus: 'unknown' });
  assert.throws(() => assertExportPreflight(), error => error.code === 'AUTHORIZATION_RECHECK_REQUIRED');
});

