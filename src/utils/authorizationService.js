import { useAuthStore } from '../store/authStore.js';

const UNKNOWN_REASON = 'AUTHORIZATION_UNAVAILABLE';

const unknownResult = () => ({ status: 'unknown' });

export const createUnknownAuthorizationAdapter = () => Object.freeze({
  async checkSession() { return unknownResult(); },
  async checkClassAccess() { return unknownResult(); },
  async checkExportPermission() { return unknownResult(); },
});

const deny = (reason = UNKNOWN_REASON) => ({
  authenticated: false,
  authentication: 'unknown',
  canView: false,
  viewAccess: 'unknown',
  canExportSubtitles: false,
  subtitleExport: 'unknown',
  canExport: false,
  entitlementTier: 'unknown_restricted',
  exportGrantSource: 'none',
  restrictionReason: reason,
  verified: false,
});

const finiteFuture = (value, now) => Number.isFinite(value) && value > now;

const sameIdentity = (identity, result) => (
  result.courseId === identity.courseId &&
  result.classId === identity.classId &&
  result.canonicalUrl === identity.canonicalUrl
);

const validStatus = result => result && result.status === 'verified';

const normalizeClassUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['platzi.com', 'www.platzi.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || (url.port && url.port !== '443')) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 3 || !['cursos', 'clases'].includes(parts[0])) return null;
    return `https://platzi.com/${parts.join('/')}/`;
  } catch {
    return null;
  }
};

const validSession = (session, now) => (
  validStatus(session) &&
  session.authenticated === true &&
  Boolean(session.accountId) &&
  Number.isInteger(session.sessionEpoch) &&
  finiteFuture(session.expiresAt, now)
);

const validResolvedIdentity = (result, canonicalUrl) => {
  const identity = result?.identity;
  if (!validStatus(result) || !['public_catalog', 'official_adapter'].includes(result.source) || !identity || !Number.isInteger(identity.courseId) || identity.courseId <= 0 || !Number.isInteger(identity.classId) || identity.classId <= 0 || normalizeClassUrl(identity.canonicalUrl) !== canonicalUrl) return null;
  return Object.freeze({ ...identity, canonicalUrl });
};

/**
 * The only production default is an unknown adapter. A future official
 * integration must be supplied when constructing the service explicitly.
 */
export class AuthorizationService {
  constructor(adapter = createUnknownAuthorizationAdapter(), options = {}) {
    if (!adapter || typeof adapter.checkSession !== 'function' || typeof adapter.checkClassAccess !== 'function' || typeof adapter.checkExportPermission !== 'function') {
      throw new TypeError('Authorization adapter must implement checkSession, checkClassAccess, and checkExportPermission');
    }
    this.adapter = adapter;
    this.now = options.now || (() => Date.now());
    this.getSessionEpoch = options.getSessionEpoch || (() => 0);
  }

  async authorize(identity, options = {}) {
    if (!identity || typeof identity !== 'object' || !identity.canonicalUrl || identity.classId === undefined || identity.courseId === undefined) {
      return deny('UNKNOWN_CLASS_IDENTITY');
    }

    const now = this.now();
    let session;
    let access;
    let exportPermission;
    try {
      session = options.session || await this.adapter.checkSession();
      if (!validSession(session, now)) {
        return deny(UNKNOWN_REASON);
      }

      access = await this.adapter.checkClassAccess(identity, session);
      if (!validStatus(access) || access.canView !== true || !sameIdentity(identity, access) || access.accountId !== session.accountId || access.sessionEpoch !== session.sessionEpoch || !finiteFuture(access.expiresAt, now)) {
        return deny(access?.status === 'denied' ? 'CLASS_ACCESS_DENIED' : 'AUTHORIZATION_BINDING_MISMATCH');
      }

      exportPermission = await this.adapter.checkExportPermission(identity, session, access);
      if (!validStatus(exportPermission) || exportPermission.canExport !== true || !sameIdentity(identity, exportPermission) || exportPermission.accountId !== session.accountId || exportPermission.sessionEpoch !== session.sessionEpoch || !finiteFuture(exportPermission.expiresAt, now)) {
        return deny(exportPermission?.status === 'denied' ? 'EXPORT_PERMISSION_DENIED' : 'AUTHORIZATION_BINDING_MISMATCH');
      }
    } catch {
      return deny(UNKNOWN_REASON);
    }

    const currentEpoch = this.getSessionEpoch();
    if (session.sessionEpoch !== currentEpoch || access.sessionEpoch !== currentEpoch || exportPermission.sessionEpoch !== currentEpoch) {
      return deny('SESSION_EPOCH_MISMATCH');
    }

    const expiresAt = Math.min(session.expiresAt, access.expiresAt, exportPermission.expiresAt);
    if (!finiteFuture(expiresAt, now)) return deny('AUTHORIZATION_EXPIRED');

    return {
      authenticated: true,
      authentication: 'authenticated',
      canView: true,
      viewAccess: 'allowed',
      canExportSubtitles: true,
      subtitleExport: 'allowed',
      canExport: true,
      entitlementTier: exportPermission.entitlementTier || 'unknown',
      exportGrantSource: exportPermission.exportGrantSource || 'official_adapter',
      restrictionReason: null,
      verified: true,
      accountId: session.accountId,
      sessionAccount: session.accountId,
      sessionEpoch: session.sessionEpoch,
      expiresAt,
      courseId: identity.courseId,
      classId: identity.classId,
      canonicalUrl: identity.canonicalUrl,
      identity,
    };
  }

  async authorizeClassUrl(classUrl) {
    const canonicalUrl = normalizeClassUrl(classUrl);
    if (!canonicalUrl) return deny('INVALID_CLASS_URL');

    const now = this.now();
    let session;
    try {
      session = await this.adapter.checkSession();
      if (!validSession(session, now)) return deny(UNKNOWN_REASON);
      if (typeof this.adapter.resolveClassIdentity !== 'function') return deny('UNKNOWN_CLASS_IDENTITY');
      const resolved = validResolvedIdentity(
        await this.adapter.resolveClassIdentity(canonicalUrl, session),
        canonicalUrl,
      );
      if (!resolved) return deny('UNKNOWN_CLASS_IDENTITY');
      if (session.sessionEpoch !== this.getSessionEpoch()) return deny('SESSION_EPOCH_MISMATCH');
      const decision = await this.authorize(resolved, { session });
      return decision.verified ? { ...decision, identity: resolved } : decision;
    } catch {
      return deny(UNKNOWN_REASON);
    }
  }

  async recheck(identity) {
    const decision = await this.authorize(identity);
    if (!decision.verified) useAuthStore.getState().invalidateSession();
    return decision;
  }
}

export const createAuthorizationService = (adapter, options) => new AuthorizationService(adapter, options);

export const defaultAuthorizationService = new AuthorizationService(undefined, {
  getSessionEpoch: () => useAuthStore.getState().sessionEpoch || 0,
});

export const isVerifiedAuthorizationDecision = decision => Boolean(
  decision?.verified === true &&
  decision.authenticated === true &&
  decision.canView === true &&
  decision.canExport === true &&
  decision.canExportSubtitles === true &&
  Number.isInteger(decision.sessionEpoch) &&
  decision.accountId &&
  finiteFuture(decision.expiresAt, Date.now())
);

export const createDeniedAuthorizationDecision = deny;
