import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '../src/store/authStore.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';
import {
  copyMergedTxt,
  downloadVideoTxt,
  downloadMergedTxt,
  downloadZip,
} from '../src/utils/downloader.js';
import {
  revokeProof,
  assertAuthorizedExportProof,
  getClassRevision,
  bumpClassRevision,
} from '../src/utils/platziAccess.js';
import { defaultAuthorizationService } from '../src/utils/authorizationService.js';

const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalAdapter = defaultAuthorizationService.adapter;

const setMockNavigator = (navObj) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: navObj,
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  if (originalNavigatorDesc) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
  } else {
    delete globalThis.navigator;
  }
  defaultAuthorizationService.adapter = originalAdapter;
  useSubtitleStore.getState().reset();
});

const mockClassIdentity = {
  courseId: 101,
  classId: 202,
  canonicalUrl: 'https://platzi.com/cursos/js/intro/',
};

const makeValidProof = (overrides = {}) => {
  const account = overrides.sessionAccount || 'account-real-1';
  const epoch = overrides.sessionEpoch ?? useAuthStore.getState().sessionEpoch;
  const canonicalUrl = overrides.canonicalUrl || 'https://platzi.com/cursos/js/intro/';
  const classId = overrides.classId ?? 202;
  const courseId = overrides.courseId ?? 101;
  const classRevision = overrides.classRevision ?? getClassRevision(account, epoch, canonicalUrl);
  return {
    proofId: 'proof-' + Math.random().toString(36).slice(2),
    classId,
    courseId,
    canonicalUrl,
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/intro-es.vtt'],
    sessionAccount: account,
    sessionEpoch: epoch,
    classRevision,
    expiresAt: Date.now() + 60_000,
    capabilities: {
      verified: true,
      authenticated: true,
      canView: true,
      canExport: true,
      canExportSubtitles: true,
      accountId: account,
      sessionEpoch: epoch,
      courseId,
      classId,
      canonicalUrl,
      expiresAt: overrides.capabilityExpiresAt || Date.now() + 60_000,
    },
    identity: mockClassIdentity,
    ...overrides,
  };
};

const makeVideo = (overrides = {}) => {
  const video = {
    id: 'vid-1',
    slug: 'intro',
    title: 'Introducción',
    url: 'https://platzi.com/cursos/js/intro/',
    status: 'ready',
    selected: true,
    extractedContent: { es: '1\n00:00:00.000 --> 00:00:02.000\nHola mundo' },
    authorizationProof: makeValidProof(),
    ...overrides,
  };
  useSubtitleStore.setState({ videos: [video] });
  return video;
};

test('unauthorized copy never calls clipboard when session is unauthenticated or invalidated', async () => {
  let clipboardCalled = false;
  setMockNavigator({
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'session_invalid', sessionEpoch: 1 });
  const video = makeVideo();

  await assert.rejects(
    copyMergedTxt([video], 'es'),
    error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT',
  );
  assert.equal(clipboardCalled, false, 'navigator.clipboard.writeText must NEVER be called if session is invalid');

  useAuthStore.setState({ sessionStatus: 'unknown' });
  await assert.rejects(
    copyMergedTxt([video], 'es'),
    error => error.code === 'AUTHORIZATION_RECHECK_REQUIRED',
  );
  assert.equal(clipboardCalled, false, 'navigator.clipboard.writeText must NEVER be called if session is unknown');
});

test('copyMergedTxt rejects and never touches clipboard when proof is expired, wrong account, or revoked', async () => {
  let clipboardCalled = false;
  setMockNavigator({
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 2 });

  // 1. Expired proof
  const expiredVideo = makeVideo({
    authorizationProof: makeValidProof({ expiresAt: Date.now() - 5000 }),
  });
  await assert.rejects(
    copyMergedTxt([expiredVideo], 'es'),
    error => error.code === 'PROOF_EXPIRED',
  );
  assert.equal(clipboardCalled, false);

  // 2. Wrong sessionEpoch
  const wrongEpochVideo = makeVideo({
    authorizationProof: makeValidProof({ sessionEpoch: 0 }),
  });
  await assert.rejects(
    copyMergedTxt([wrongEpochVideo], 'es'),
    error => error.code === 'PLATZI_SESSION_INVALIDATED',
  );
  assert.equal(clipboardCalled, false);

  // 3. Revoked proof
  const revokedProof = makeValidProof();
  revokeProof(revokedProof.proofId);
  const revokedVideo = makeVideo({ authorizationProof: revokedProof });
  await assert.rejects(
    copyMergedTxt([revokedVideo], 'es'),
    error => error.code === 'PROOF_REVOKED',
  );
  assert.equal(clipboardCalled, false);
});

test('copyMergedTxt propagates writeText rejection (NotAllowedError) without indicating success', async () => {
  let writeCalled = false;
  setMockNavigator({
    clipboard: {
      writeText: async () => {
        writeCalled = true;
        const err = new Error('The request is not allowed by the user agent or the platform in the current context.');
        err.name = 'NotAllowedError';
        throw err;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 0 }) });
  await assert.rejects(
    copyMergedTxt([video], 'es'),
    error => error.name === 'NotAllowedError',
  );
  assert.equal(writeCalled, true);
});

test('copyMergedTxt awaits writeText fulfillment when preflight is verified', async () => {
  let copiedText = null;
  setMockNavigator({
    clipboard: {
      writeText: async (text) => {
        copiedText = text;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 0 }) });
  await copyMergedTxt([video], 'es');
  assert.ok(copiedText);
  assert.match(copiedText, /Hola mundo/);
});

test('revocation between awaits prevents final emission for ZIP, TXT, and Copy sinks', async () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  const proof = makeValidProof({ sessionEpoch: 0 });
  const video = makeVideo({ authorizationProof: proof });

  // If proof is revoked before sink emission
  revokeProof(proof.proofId);

  await assert.rejects(
    downloadMergedTxt([video], 'es', 'curso'),
    error => error.code === 'PROOF_REVOKED',
  );

  await assert.rejects(
    downloadVideoTxt(video, 'es', 'curso', 0),
    error => error.code === 'PROOF_REVOKED',
  );

  await assert.rejects(
    downloadZip([video], 'es', 'curso'),
    error => error.code === 'PROOF_REVOKED',
  );

  await assert.rejects(
    copyMergedTxt([video], 'es'),
    error => error.code === 'PROOF_REVOKED',
  );
});

test('race condition: session rotation during preflight awaits rejects before clipboard write', async () => {
  let clipboardCalled = false;
  setMockNavigator({
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  let resolveSession;
  const sessionPromise = new Promise(resolve => {
    resolveSession = resolve;
  });

  defaultAuthorizationService.adapter = {
    async checkSession() {
      // Simulate slow remote check
      await sessionPromise;
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 0 }) });

  // Start export
  const exportPromise = copyMergedTxt([video], 'es');

  // While preflight is awaiting, rotate session
  useAuthStore.getState().invalidateSession();

  // Now resolve the deferred session check with the old epoch
  resolveSession();

  await assert.rejects(
    exportPromise,
    error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT' || error.code === 'AUTHORIZATION_RECHECK_FAILED',
  );
  assert.equal(clipboardCalled, false, 'clipboard sink must never be called when session rotated during preflight');
});

test('replacement with the same id and URL cannot export the old content snapshot', async () => {
  let clipboardCalled = false;
  setMockNavigator({ clipboard: { writeText: async () => { clipboardCalled = true; } } });
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 50 });
  let resolveSession;
  const pendingSession = new Promise(resolve => { resolveSession = resolve; });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      await pendingSession;
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 50, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 50, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 50, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 50 }) });
  const exportPromise = copyMergedTxt([video], 'es');
  const replacement = {
    ...video,
    authorizationProof: makeValidProof({ sessionEpoch: 50, proofId: 'replacement-proof' }),
    extractedContent: { es: 'replacement content' },
  };
  useSubtitleStore.setState({ videos: [replacement] });
  resolveSession();

  await assert.rejects(exportPromise, error => error.code === 'STORE_CONTENT_STALE');
  assert.equal(clipboardCalled, false);
});

test('race condition: confirmed denial / purge during ZIP generation prevents file emission', async () => {
  const fileSaver = (await import('file-saver')).default;
  const JSZip = (await import('jszip')).default;
  let saveCalled = false;
  fileSaver.saveAs = () => { saveCalled = true; };

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 0 }) });
  useSubtitleStore.setState({ videos: [video] });

  defaultAuthorizationService.adapter = {
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const originalGenerateAsync = JSZip.prototype.generateAsync;
  JSZip.prototype.generateAsync = async function () {
    // During zip generation, content is purged due to confirmed denial or reset
    useSubtitleStore.getState().purgeExtractedContent();
    return new Blob(['zip-content']);
  };

  try {
    await assert.rejects(
      downloadZip([video], 'es', 'curso'),
      error => error.code === 'STORE_CONTENT_PURGED' || error.code === 'STORE_CONTENT_STALE',
    );
    assert.equal(saveCalled, false, 'ZIP file must never be saved if store content was purged during generation');
  } finally {
    JSZip.prototype.generateAsync = originalGenerateAsync;
  }
});

test('per-class revision: two proofs for same class, confirmed denial revokes second proof and prevents revival', async () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  const proofA1 = makeValidProof({ sessionEpoch: 0 });
  const proofA2 = makeValidProof({ sessionEpoch: 0 });

  // Confirmed denial for this class bumps the class revision
  bumpClassRevision(proofA1.sessionAccount, proofA1.sessionEpoch, proofA1.canonicalUrl);

  // Assert proofA2 is also rejected because revision was bumped
  assert.throws(
    () => assertAuthorizedExportProof(proofA2, proofA2.authorizedVttUrls[0], { currentSessionEpoch: 0 }),
    error => error.code === 'PROOF_REVOKED',
  );
});

test('per-class revision: denial of one class leaves different class and account valid', async () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  const classAProof = makeValidProof({
    classId: 202,
    canonicalUrl: 'https://platzi.com/cursos/js/intro/',
    sessionEpoch: 0,
  });
  const classBProof = makeValidProof({
    classId: 303,
    canonicalUrl: 'https://platzi.com/cursos/js/variables/',
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/var-es.vtt'],
    sessionEpoch: 0,
  });

  // Class A is denied
  bumpClassRevision(classAProof.sessionAccount, classAProof.sessionEpoch, classAProof.canonicalUrl);

  // Class A is revoked
  assert.throws(
    () => assertAuthorizedExportProof(classAProof, classAProof.authorizedVttUrls[0], { currentSessionEpoch: 0 }),
    error => error.code === 'PROOF_REVOKED',
  );

  // Class B is NOT revoked
  assert.doesNotThrow(
    () => assertAuthorizedExportProof(classBProof, classBProof.authorizedVttUrls[0], { currentSessionEpoch: 0 }),
  );
});

test('actual account mismatch in preflight recheck triggers session invalidation and rejects export', async () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      // Recheck returns different account!
      return { status: 'verified', authenticated: true, accountId: 'account-different-99', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-different-99', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-different-99', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionAccount: 'account-real-1', sessionEpoch: 0 }) });
  await assert.rejects(
    copyMergedTxt([video], 'es'),
    error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT' || error.code === 'AUTHORIZATION_RECHECK_FAILED',
  );
  assert.equal(useAuthStore.getState().sessionStatus, 'session_invalid', 'account mismatch must invalidate global session');
});

test('no-VTT class with expired proof or forged verified:true is rejected by assertAuthorizedExportProof', () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });

  // 1. Expired no-VTT proof
  const expiredNoVttProof = makeValidProof({
    authorizedVttUrls: [],
    expiresAt: Date.now() - 1000,
    sessionEpoch: 0,
  });
  assert.throws(
    () => assertAuthorizedExportProof(expiredNoVttProof, null, { currentSessionEpoch: 0 }),
    error => error.code === 'PROOF_EXPIRED',
  );

  // 2. Forged verified:true proof without intact capability fields
  const forgedProof = {
    proofId: 'forged-1',
    classId: 202,
    courseId: 101,
    canonicalUrl: 'https://platzi.com/cursos/js/intro/',
    sessionAccount: 'account-1',
    sessionEpoch: 0,
    expiresAt: Date.now() + 60_000,
    capabilities: { verified: true }, // missing authenticated, canView, canExport!
    authorizedVttUrls: [],
  };
  assert.throws(
    () => assertAuthorizedExportProof(forgedProof, null, { currentSessionEpoch: 0 }),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );

  const noExportSubtitleProof = makeValidProof({ authorizedVttUrls: [] });
  noExportSubtitleProof.capabilities = {
    ...noExportSubtitleProof.capabilities,
    canExport: true,
    canExportSubtitles: false,
  };
  assert.throws(
    () => assertAuthorizedExportProof(noExportSubtitleProof, null, { currentSessionEpoch: 0 }),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );
});

test('class revisions stay monotonic across reissued proofs and repeated denials', () => {
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 60 });
  const canonicalUrl = 'https://platzi.com/cursos/js/revision-lifecycle/';
  const proofOne = makeValidProof({ sessionAccount: 'revision-account', sessionEpoch: 60, canonicalUrl, classId: 606, classRevision: getClassRevision('revision-account', 60, canonicalUrl) });
  const firstDenial = bumpClassRevision('revision-account', 60, canonicalUrl);
  assert.equal(firstDenial, proofOne.classRevision + 1);
  assert.throws(() => assertAuthorizedExportProof(proofOne, null, { currentSessionEpoch: 60 }), error => error.code === 'PROOF_REVOKED');

  const proofTwo = makeValidProof({ sessionAccount: 'revision-account', sessionEpoch: 60, canonicalUrl, classId: 606, classRevision: getClassRevision('revision-account', 60, canonicalUrl) });
  assert.doesNotThrow(() => assertAuthorizedExportProof(proofTwo, null, { currentSessionEpoch: 60 }));
  const secondDenial = bumpClassRevision('revision-account', 60, canonicalUrl);
  assert.equal(secondDenial, firstDenial + 1);
  assert.throws(() => assertAuthorizedExportProof(proofTwo, null, { currentSessionEpoch: 60 }), error => error.code === 'PROOF_REVOKED');
});

test('deferred clipboard fulfillment does not indicate success prematurely', async () => {
  let resolveWrite;
  const writePromise = new Promise((resolve) => {
    resolveWrite = resolve;
  });

  let writeFinished = false;
  setMockNavigator({
    clipboard: {
      writeText: async () => {
        await writePromise;
        writeFinished = true;
      },
    },
  });

  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
  defaultAuthorizationService.adapter = {
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
    async checkExportPermission() {
      return { status: 'verified', canExport: true, accountId: 'account-real-1', sessionEpoch: 0, expiresAt: Date.now() + 60_000, ...mockClassIdentity };
    },
  };

  const video = makeVideo({ authorizationProof: makeValidProof({ sessionEpoch: 0 }) });
  const exportPromise = copyMergedTxt([video], 'es');

  // Verify that before writeText fulfills, export is NOT complete
  assert.equal(writeFinished, false);

  // Now fulfill writeText
  resolveWrite();
  await exportPromise;

  assert.equal(writeFinished, true);
});
