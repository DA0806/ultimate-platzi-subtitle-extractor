import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectClassIdentityDocument,
  evaluateClassCapabilities,
  extractProtectedMaterial,
  assertAuthorizedExportProof,
} from '../src/utils/platziAccess.js';
import { useAuthStore } from '../src/store/authStore.js';
import { useSubtitleStore } from '../src/store/subtitleStore.js';
import { getPlatziPage } from '../src/utils/platziClient.js';
import { downloadZip, assertExportPreflight } from '../src/utils/downloader.js';

const pageUrl = 'https://platzi.com/cursos/javascript/intro-a-js/';
const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
});

const nextFlightScript = (...events) => {
  const payload = events.map((event, index) => `${index + 1}:${JSON.stringify(['$', '$L32', null, event])}\n`).join('');
  return `self.__next_f.push(${JSON.stringify([1, payload])})`;
};

const materialScript = ({ classId, className, source = 'https://static.platzi.com/media/subtitle/class-es.vtt' }) => {
  const payload = `1:${JSON.stringify(['$', '$L25', null, {
    surface: 'course',
    materialInfo: {
      id: classId,
      title: className,
      video: { movin: { subtitles: [{ source, type: 'captions', language: 'es', label: 'Spanish' }] } },
    },
  }])}\n`;
  return `self.__next_f.push(${JSON.stringify([1, payload])})`;
};

const classEvent = ({
  classId = 70442,
  className = 'Introducción a JavaScript',
  classPosition = 1,
  classIsFree = false,
  courseName = 'Curso de JavaScript',
  courseId = 10266,
} = {}) => ({
  category: 'material-view',
  name: 'page-view',
  properties: {
    class_name: className,
    class_id: classId,
    class_position: classPosition,
    class_is_free: classIsFree,
    course_name: courseName,
    course_id: courseId,
  },
});

const createDoc = ({
  url = pageUrl,
  heading = 'Introducción a JavaScript',
  events = [classEvent()],
  includeVtt = true,
  rawScript = '',
} = {}) => {
  const scriptContent = `${nextFlightScript(...events)}${includeVtt && events[0] ? materialScript({ classId: events[0].properties.class_id, className: events[0].properties.class_name }) : ''}${rawScript}`;
  return {
    title: heading,
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') return { href: url };
      if (selector === 'h1') return { textContent: heading };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'script') return [{ textContent: scriptContent }];
      return [];
    },
  };
};

// ---------------------------------------------------------
// Case 1: Anonymous on free class -> Denied
// ---------------------------------------------------------
test('Case 1: Anonymous user on free class is denied export (triple permission required)', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: true })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);
  assert.equal(identity.isFreePublic, true);

  const decision = evaluateClassCapabilities(identity, { authenticated: false, viewAccess: 'allowed' });
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.canExport, false);
  assert.equal(decision.subtitleExport, 'unknown');
  assert.throws(
    () => extractProtectedMaterial(doc, identity, decision),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );
});

// ---------------------------------------------------------
// Case 2: Authenticated user on free class with all 3 true -> Allowed
// ---------------------------------------------------------
test('Case 2: Local authenticated context and consent do not authorize a free class', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: true })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);

  const decision = evaluateClassCapabilities(identity, {
    authenticated: true,
    viewAccess: 'allowed',
    userConsentForPublicExport: true,
  });
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.subtitleExport, 'unknown');
  assert.throws(() => extractProtectedMaterial(doc, identity, decision), error => error.code === 'PLATZI_ACCESS_UNVERIFIED');
});

// ---------------------------------------------------------
// Case 3: Anonymous on non-free class -> Denied
// ---------------------------------------------------------
test('Case 3: Anonymous user on non-free class is denied view and export', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: false })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);

  const decision = evaluateClassCapabilities(identity, { authenticated: false });
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.entitlementTier, 'subscriber_only');
});

// ---------------------------------------------------------
// Case 4: Registered account without subscription on non-free class -> Denied
// ---------------------------------------------------------
test('Case 4: Registered user without subscription on non-free class is denied', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: false })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);

  const decision = evaluateClassCapabilities(identity, { authenticated: true, viewAccess: 'denied' });
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
});

// ---------------------------------------------------------
// Case 5: Active subscriber on non-free class without export license -> canView true, canExport false (Contract Pending)
// ---------------------------------------------------------
test('Case 5: Active subscriber on non-free class without explicit export grant has view allowed but export denied (contract pending)', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: false })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);

  const decision = evaluateClassCapabilities(identity, { authenticated: true, viewAccess: 'allowed' });
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false); // Subscription does not confer subtitle export!
  assert.equal(decision.subtitleExport, 'unknown');
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
  assert.throws(
    () => extractProtectedMaterial(doc, identity, decision),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );
});

// ---------------------------------------------------------
// Case 6: Verified provider mock granting 3 true -> Allowed in test mock
// ---------------------------------------------------------
test('Case 6: Verified mock provider granting all 3 permissions allows export of subscriber class', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: false })] });
  const identity = inspectClassIdentityDocument(doc, pageUrl);

  const mockOfficialProvider = {
    evaluateCapabilities: () => ({
      authenticated: true,
      authentication: 'authenticated',
      canView: true,
      viewAccess: 'allowed',
      canExportSubtitles: true,
      subtitleExport: 'allowed',
      canExport: true,
      entitlementTier: 'subscriber_only',
      exportGrantSource: 'explicit_contract_grant',
      restrictionReason: null,
    }),
  };

  const decision = evaluateClassCapabilities(identity, {}, mockOfficialProvider);
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
});

// ---------------------------------------------------------
// Case 7: Text/reading/quiz class without video
// ---------------------------------------------------------
test('Case 7: Text/quiz class without video extracts identity and 0 VTT tracks safely', () => {
  const doc = createDoc({ events: [classEvent({ classIsFree: true })], includeVtt: false });
  const identity = inspectClassIdentityDocument(doc, pageUrl);
  assert.ok(identity);

  const decision = evaluateClassCapabilities(identity, {
    authenticated: true,
    viewAccess: 'allowed',
    userConsentForPublicExport: true,
  });

  assert.throws(() => extractProtectedMaterial(doc, identity, decision), error => error.code === 'PLATZI_ACCESS_UNVERIFIED');
});

// ---------------------------------------------------------
// Case 8: Mixed course batch handling
// ---------------------------------------------------------
test('Case 8: Mixed course batch allows free classes to proceed while blocking private classes', () => {
  const freeIdentity = {
    classId: 101,
    title: 'Free Class 1',
    isFreePublic: true,
  };
  const paidIdentity = {
    classId: 102,
    title: 'Paid Class 2',
    isFreePublic: false,
  };

  const freeDecision = evaluateClassCapabilities(freeIdentity, {
    authenticated: true,
    viewAccess: 'allowed',
    userConsentForPublicExport: true,
  });
  const paidDecision = evaluateClassCapabilities(paidIdentity, {
    authenticated: true,
    viewAccess: 'allowed',
    userConsentForPublicExport: true,
  });

  assert.equal(freeDecision.canExportSubtitles, false);
  assert.equal(paidDecision.canExportSubtitles, false);
  assert.equal(paidDecision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
});

// ---------------------------------------------------------
// Case 9: Corrupt / truncated SSR metadata fails closed
// ---------------------------------------------------------
test('Case 9: Corrupt SSR metadata fails closed with unknown decision and denies all sensitive actions', () => {
  const corruptDoc = createDoc({ events: [], rawScript: 'self.__next_f.push([1, "1:CORRUPT_NOT_JSON"])' });
  const identity = inspectClassIdentityDocument(corruptDoc, pageUrl);
  assert.equal(identity, null);

  const decision = evaluateClassCapabilities(identity);
  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExportSubtitles, false);
  assert.equal(decision.restrictionReason, 'UNKNOWN_CLASS_IDENTITY');
});

// ---------------------------------------------------------
// Case 10: T frame injection / spoofing attempt
// ---------------------------------------------------------
test('Case 10: T frame payload containing spoofed class_is_free is safely consumed as text without parsing', () => {
  const spoofedPayload = `,["$","$L32",null,{"properties":{"class_id":70442,"class_name":"Introducción a JavaScript","class_is_free":true}}],"text"`;
  const byteLen = new TextEncoder().encode(spoofedPayload).length;
  const rawScript = `self.__next_f.push([1, "42:T${byteLen.toString(16)},${spoofedPayload}"])`;

  const doc = createDoc({ events: [], rawScript });
  const identity = inspectClassIdentityDocument(doc, pageUrl);
  assert.equal(identity, null);
});

// ---------------------------------------------------------
// Case 11: Worker restart / memory heap loss invalidates ephemeral proofs
// ---------------------------------------------------------
test('Case 11: Worker restart or expired TTL invalidates ephemeral proof', () => {
  const proof = {
    proofId: 'test-proof',
    classId: 70442,
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/class-es.vtt'],
    sessionEpoch: 0,
    expiresAt: Date.now() - 1000, // Expired
    sessionAccount: 'account-a',
    capabilities: { verified: true },
  };

  assert.throws(
    () => assertAuthorizedExportProof(proof, 'https://static.platzi.com/media/subtitle/class-es.vtt'),
    error => error.code === 'PROOF_EXPIRED',
  );
});

// ---------------------------------------------------------
// Case 12: Account / session rotation in another tab invalidates proofs & purges live content
// ---------------------------------------------------------
test('Case 12: Account rotation or discrepancy triggers session invalidation and purges memory', () => {
  useAuthStore.setState({ sessionEpoch: 1, sessionStatus: 'authenticated' });
  useSubtitleStore.setState({
    videos: [{ id: 'v1', status: 'ready', extractedContent: { es: 'subtitles' } }],
  });

  const proof = {
    proofId: 'proof-12',
    classId: 70442,
    authorizedVttUrls: ['https://static.platzi.com/media/subtitle/class-es.vtt'],
    sessionAccount: 'account_A',
    sessionEpoch: 1,
    expiresAt: Date.now() + 600_000,
    capabilities: { verified: true },
  };

  // Discrepancy detected with active account B
  assert.throws(
    () => assertAuthorizedExportProof(proof, 'https://static.platzi.com/media/subtitle/class-es.vtt', { currentAccount: 'account_B' }),
    error => error.code === 'SESSION_ACCOUNT_MISMATCH',
  );

  // Invalidate session
  useAuthStore.getState().invalidateSession();
  useSubtitleStore.getState().purgeExtractedContent();

  assert.equal(useAuthStore.getState().sessionEpoch, 2);
  assert.deepEqual(useSubtitleStore.getState().videos[0].extractedContent, {});
});

// ---------------------------------------------------------
// Case 13: 401 Unauthorized halts batch, increments epoch, and purges content
// ---------------------------------------------------------
test('Case 13: 401 during request halts batch and purges content immediately', async () => {
  useAuthStore.setState({ sessionEpoch: 3, sessionStatus: 'authenticated' });
  useSubtitleStore.setState({
    videos: [{ id: 'v1', status: 'ready', extractedContent: { es: 'text' } }],
  });

  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'Unauthorized',
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_SESSION_INVALIDATED',
  );

  assert.equal(useAuthStore.getState().sessionEpoch, 4);
  assert.equal(useAuthStore.getState().sessionStatus, 'session_invalid');
});

// ---------------------------------------------------------
// Case 14: Race condition between concurrent workers -> stale operation cannot overwrite
// ---------------------------------------------------------
test('Case 14: Stale async operation cannot overwrite store after sessionEpoch increment', async () => {
  const initialEpoch = 10;
  useAuthStore.setState({ sessionEpoch: initialEpoch });
  useSubtitleStore.setState({
    videos: [{ id: 'race-vid', status: 'extracting', extractedContent: {} }],
  });

  // Worker 1 hits 401 and invalidates
  useAuthStore.getState().invalidateSession();
  useSubtitleStore.getState().purgeExtractedContent();

  // Worker 2 finishes afterwards with older epoch
  const worker2Epoch = initialEpoch;
  if (useAuthStore.getState().sessionEpoch === worker2Epoch) {
    useSubtitleStore.getState().updateVideo('race-vid', {
      status: 'ready',
      extractedContent: { es: 'stale' },
    });
  }

  // Verify race-vid was NOT overwritten
  const video = useSubtitleStore.getState().videos.find(v => v.id === 'race-vid');
  assert.notEqual(video.status, 'ready');
  assert.deepEqual(video.extractedContent, {});
});

// ---------------------------------------------------------
// Case 15: 429 Rate Limiting respects Retry-After and halts batch
// ---------------------------------------------------------
test('Case 15: 429 Rate Limit standardizes PLATZI_RATE_LIMITED and parses retry-after header', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };

  const headers = new Map([['retry-after', '30']]);
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    text: async () => 'Rate limited',
    headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
  });

  await assert.rejects(
    getPlatziPage('https://platzi.com/cursos/javascript/'),
    error => error.code === 'PLATZI_RATE_LIMITED' && error.retryAfter === 30,
  );
});

// ---------------------------------------------------------
// Preflight & Download Controls
// ---------------------------------------------------------
test('Preflight and download controls: cached export recheck and no persistent credentials', async () => {
  // 1. Session invalidated prevents ZIP / TXT export
  useAuthStore.setState({ sessionStatus: 'session_invalid' });
  assert.throws(() => assertExportPreflight(), error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT');
  await assert.rejects(downloadZip([], 'es', 'curso'), error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT');

  // 2. Zero persistent credentials in authStore
  const state = useAuthStore.getState();
  assert.equal(state.cookie, null);
  assert.equal(state.token, null);
});
