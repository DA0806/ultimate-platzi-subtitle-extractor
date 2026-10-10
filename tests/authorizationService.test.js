import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorizationService,
  createUnknownAuthorizationAdapter,
} from '../src/utils/authorizationService.js';
import { bumpClassRevision } from '../src/utils/platziAccess.js';

const identity = {
  courseId: 10,
  courseSlug: 'curso',
  classId: 20,
  classSlug: 'clase',
  canonicalUrl: 'https://platzi.com/cursos/curso/clase/',
  title: 'Clase',
  isFreePublic: true,
};

const grant = ({ accountId = 'account-a', expiresAt = Date.now() + 60_000 } = {}) => ({
  status: 'verified',
  authenticated: true,
  canView: true,
  canExport: true,
  accountId,
  expiresAt,
  sessionEpoch: 0,
  courseId: identity.courseId,
  classId: identity.classId,
  canonicalUrl: identity.canonicalUrl,
});

test('default authorization service denies free classes despite local user context', async () => {
  const service = new AuthorizationService(createUnknownAuthorizationAdapter());
  const decision = await service.authorize(identity, {
    authenticated: true,
    canView: true,
    userConsentForPublicExport: true,
  });

  assert.equal(decision.authenticated, false);
  assert.equal(decision.canView, false);
  assert.equal(decision.canExport, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_UNAVAILABLE');
});

test('authorization service requires three independent verified adapter results', async () => {
  const calls = [];
  const service = new AuthorizationService({
    async checkSession() { calls.push('session'); return { status: 'verified', authenticated: true, accountId: 'account-a', sessionEpoch: 0, expiresAt: Date.now() + 60_000 }; },
    async checkClassAccess() { calls.push('class'); return { status: 'verified', canView: true, accountId: 'account-a', sessionEpoch: 0, expiresAt: Date.now() + 60_000, courseId: 10, classId: 20, canonicalUrl: identity.canonicalUrl }; },
    async checkExportPermission() { calls.push('export'); return grant(); },
  });

  const decision = await service.authorize(identity);
  assert.deepEqual(calls, ['session', 'class', 'export']);
  assert.equal(decision.authenticated, true);
  assert.equal(decision.canView, true);
  assert.equal(decision.canExport, true);
});

test('forged adapter results are denied when identity, account, epoch, or expiry do not bind', async () => {
  const service = new AuthorizationService({
    async checkSession() { return { status: 'verified', authenticated: true, accountId: 'account-a', sessionEpoch: 0, expiresAt: Date.now() + 60_000 }; },
    async checkClassAccess() { return { status: 'verified', canView: true, accountId: 'account-b', sessionEpoch: 0, expiresAt: Date.now() + 60_000, courseId: 10, classId: 20, canonicalUrl: identity.canonicalUrl }; },
    async checkExportPermission() { return grant({ accountId: 'account-a' }); },
  });

  const decision = await service.authorize(identity);
  assert.equal(decision.canExport, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_BINDING_MISMATCH');
});

test('authorizeClassUrl denies before class HTTP when no verified public identity resolver exists', async () => {
  const calls = [];
  const service = new AuthorizationService({
    async checkSession() { calls.push('session'); return grant(); },
    async checkClassAccess() { calls.push('class'); return grant(); },
    async checkExportPermission() { calls.push('export'); return grant(); },
  });

  const decision = await service.authorizeClassUrl('https://platzi.com/cursos/curso/clase/');
  assert.equal(decision.verified, false);
  assert.equal(decision.restrictionReason, 'UNKNOWN_CLASS_IDENTITY');
  assert.deepEqual(calls, ['session']);
});

test('authorizeClassUrl requires a source-bound public identity before all three permissions', async () => {
  const calls = [];
  const service = new AuthorizationService({
    async checkSession() { calls.push('session'); return grant(); },
    async resolveClassIdentity(url, session) {
      calls.push(['resolve', url, session.accountId]);
      return { status: 'verified', source: 'public_catalog', identity };
    },
    async checkClassAccess() { calls.push('class'); return { ...grant(), courseId: 10, classId: 20, canonicalUrl: identity.canonicalUrl }; },
    async checkExportPermission() { calls.push('export'); return { ...grant(), courseId: 10, classId: 20, canonicalUrl: identity.canonicalUrl }; },
  });

  const decision = await service.authorizeClassUrl(identity.canonicalUrl);
  assert.equal(decision.verified, true);
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), ['session', 'resolve', 'class', 'export']);
  assert.deepEqual(decision.identity, identity);
});

test('recheck with per-class denial or export unknown leaves global session and other classes intact', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 5 });

  const service = new AuthorizationService({
    async checkSession() {
      return { status: 'verified', authenticated: true, accountId: 'account-a', sessionEpoch: 5, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return { status: 'verified', canView: true, accountId: 'account-a', sessionEpoch: 5, expiresAt: Date.now() + 60_000, courseId: identity.courseId, classId: identity.classId, canonicalUrl: identity.canonicalUrl };
    },
    async checkExportPermission() {
      return { status: 'denied', canExport: false, accountId: 'account-a', sessionEpoch: 5, expiresAt: Date.now() + 60_000, courseId: identity.courseId, classId: identity.classId, canonicalUrl: identity.canonicalUrl };
    },
  }, {
    getSessionEpoch: () => useAuthStore.getState().sessionEpoch,
  });

  const decision = await service.recheck(identity);
  assert.equal(decision.verified, false);
  assert.equal(decision.restrictionReason, 'EXPORT_PERMISSION_DENIED');
  // Global session MUST remain intact: no logout, no epoch increment!
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 5);
});

test('recheck with authoritative session expiration or unauthenticated invalidates global session', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 5 });

  const service = new AuthorizationService({
    async checkSession() {
      return { status: 'verified', authenticated: false, accountId: 'account-a', sessionEpoch: 5, expiresAt: Date.now() + 60_000 };
    },
    async checkClassAccess() {
      return grant();
    },
    async checkExportPermission() {
      return grant();
    },
  }, {
    getSessionEpoch: () => useAuthStore.getState().sessionEpoch,
  });

  const decision = await service.recheck(identity);
  assert.equal(decision.verified, false);
  // Authoritative failure MUST invalidate session and increment epoch
  assert.equal(useAuthStore.getState().sessionStatus, 'session_invalid');
  assert.equal(useAuthStore.getState().sessionEpoch, 6);
});

test('recheck ignores a delayed old unauthenticated response after the session rotates', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 30 });
  let resolveSession;
  const pendingSession = new Promise(resolve => { resolveSession = resolve; });
  const service = new AuthorizationService({
    async checkSession() { return pendingSession; },
    async checkClassAccess() { return grant({ accountId: 'account-new' }); },
    async checkExportPermission() { return grant({ accountId: 'account-new' }); },
  }, {
    getSessionEpoch: () => useAuthStore.getState().sessionEpoch,
  });

  const check = service.recheck(identity);
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 31 });
  resolveSession({ status: 'unauthenticated', authenticated: false });

  const decision = await check;
  assert.equal(decision.restrictionReason, 'SESSION_EPOCH_MISMATCH');
  assert.equal(useAuthStore.getState().sessionStatus, 'authenticated');
  assert.equal(useAuthStore.getState().sessionEpoch, 31);
});

test('authorize rejects a delayed allow after another check bumps the class revision', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  const raceIdentity = { ...identity, canonicalUrl: 'https://platzi.com/cursos/curso/revision-race/' };
  useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 40 });
  let resolveAccess;
  const pendingAccess = new Promise(resolve => { resolveAccess = resolve; });
  const service = new AuthorizationService({
    async checkSession() { return { status: 'verified', authenticated: true, accountId: 'account-race', sessionEpoch: 40, expiresAt: Date.now() + 60_000 }; },
    async checkClassAccess() { return pendingAccess; },
    async checkExportPermission() { return grant({ accountId: 'account-race' }); },
  }, {
    getSessionEpoch: () => useAuthStore.getState().sessionEpoch,
  });

  const authorization = service.authorize(raceIdentity);
  bumpClassRevision('account-race', 40, raceIdentity.canonicalUrl);
  resolveAccess({ status: 'verified', canView: true, accountId: 'account-race', sessionEpoch: 40, expiresAt: Date.now() + 60_000, courseId: raceIdentity.courseId, classId: raceIdentity.classId, canonicalUrl: raceIdentity.canonicalUrl });

  const decision = await authorization;
  assert.equal(decision.verified, false);
  assert.equal(decision.restrictionReason, 'AUTHORIZATION_BINDING_MISMATCH');
});
