import { isExtension } from './platziClient.js';
import { useAuthStore } from '../store/authStore.js';
import { getSessionValidityDeadline } from './authorizationService.js';

export const SESSION_USER_ENDPOINT = 'https://api.platzi.com/api/v1/components/header/v2/user/';
export const OBSERVATION_TTL_MS = 30_000;

export class PlatziSessionAdapter {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.getSessionEpoch = options.getSessionEpoch || (() => useAuthStore.getState().sessionEpoch || 0);
    this.lastVerifiedAccountId = null;
    this.requestIdCounter = 0;
    this.latestCompletedRequestId = 0;
  }

  _applyOutcome(requestId, operationEpoch, outcome) {
    if (this.getSessionEpoch() !== operationEpoch) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'SESSION_EPOCH_MISMATCH',
        sessionEpoch: this.getSessionEpoch(),
      };
    }
    if (requestId < this.latestCompletedRequestId) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'STALE_REQUEST',
        sessionEpoch: operationEpoch,
      };
    }
    this.latestCompletedRequestId = requestId;
    useAuthStore.getState().setSessionStatus('unknown');
    return {
      ...outcome,
      sessionEpoch: operationEpoch,
    };
  }

  _applyUnauthenticated(requestId, operationEpoch, observedAt, validUntil) {
    if (this.getSessionEpoch() !== operationEpoch) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'SESSION_EPOCH_MISMATCH',
        sessionEpoch: this.getSessionEpoch(),
      };
    }
    if (requestId < this.latestCompletedRequestId) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'STALE_REQUEST',
        sessionEpoch: operationEpoch,
      };
    }
    this.latestCompletedRequestId = requestId;
    if (this.lastVerifiedAccountId !== null) {
      this.lastVerifiedAccountId = null;
      useAuthStore.getState().invalidateSession();
    }
    useAuthStore.getState().setSessionStatus('unauthenticated');
    useAuthStore.getState().setUser(null);
    return {
      status: 'unauthenticated',
      authenticated: false,
      sessionEpoch: this.getSessionEpoch(),
      observedAt,
      validUntil,
      sessionExpiresAt: null,
    };
  }

  _applyVerified(requestId, operationEpoch, data, observedAt, validUntil) {
    if (this.getSessionEpoch() !== operationEpoch) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'SESSION_EPOCH_MISMATCH',
        sessionEpoch: this.getSessionEpoch(),
      };
    }
    if (requestId < this.latestCompletedRequestId) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'STALE_REQUEST',
        sessionEpoch: operationEpoch,
      };
    }
    this.latestCompletedRequestId = requestId;

    const accountId = String(data.userId);
    let currentEpoch = operationEpoch;
    if (this.lastVerifiedAccountId !== null && this.lastVerifiedAccountId !== accountId) {
      useAuthStore.getState().invalidateSession();
      currentEpoch = this.getSessionEpoch();
    }
    this.lastVerifiedAccountId = accountId;

    const accountType = typeof data.userType === 'string'
      ? data.userType
      : (typeof data.plan === 'string' ? data.plan : undefined);
    const plan = typeof data.plan === 'string' ? data.plan : undefined;
    const isB2B = typeof data.isB2B === 'boolean' ? data.isB2B : undefined;

    useAuthStore.getState().setSessionStatus('authenticated');
    useAuthStore.getState().setUser({
      plan,
      userType: accountType,
      isB2B,
    });

    return {
      status: 'verified',
      authenticated: true,
      accountId,
      accountType,
      plan,
      isB2B,
      sessionEpoch: currentEpoch,
      observedAt,
      validUntil,
      sessionExpiresAt: null,
    };
  }

  async checkSession() {
    const requestId = ++this.requestIdCounter;
    const operationEpoch = this.getSessionEpoch();

    if (!isExtension()) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'EXTENSION_ONLY_AUTH',
        sessionEpoch: operationEpoch,
      };
    }

    let response;
    try {
      response = await fetch(SESSION_USER_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'NETWORK_ERROR',
      });
    }

    if (this.getSessionEpoch() !== operationEpoch) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'SESSION_EPOCH_MISMATCH',
        sessionEpoch: this.getSessionEpoch(),
      };
    }
    if (requestId < this.latestCompletedRequestId) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'STALE_REQUEST',
        sessionEpoch: operationEpoch,
      };
    }

    if (response.url) {
      try {
        const respUrl = new URL(response.url);
        if (
          respUrl.origin !== 'https://api.platzi.com'
          || respUrl.pathname !== '/api/v1/components/header/v2/user/'
          || respUrl.search !== ''
          || respUrl.hash !== ''
        ) {
          return this._applyOutcome(requestId, operationEpoch, {
            status: 'unknown',
            authenticated: false,
            reason: 'REDIRECT_INVALID',
          });
        }
      } catch {
        return this._applyOutcome(requestId, operationEpoch, {
          status: 'unknown',
          authenticated: false,
          reason: 'REDIRECT_INVALID',
        });
      }
    }

    if (response.status === 403) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'HTTP_403',
      });
    }

    if (response.status === 401) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'HTTP_401',
      });
    }

    if (response.status !== 200) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: `HTTP_${response.status}`,
      });
    }

    const contentType = response.headers?.get ? response.headers.get('content-type') : null;
    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'NON_JSON_CONTENT_TYPE',
      });
    }

    let bodyText;
    try {
      bodyText = await response.text();
    } catch {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'READ_BODY_FAILED',
      });
    }

    const observedAt = this.now();
    const validUntil = observedAt + OBSERVATION_TTL_MS;

    if (this.getSessionEpoch() !== operationEpoch) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'SESSION_EPOCH_MISMATCH',
        sessionEpoch: this.getSessionEpoch(),
      };
    }
    if (requestId < this.latestCompletedRequestId) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: 'STALE_REQUEST',
        sessionEpoch: operationEpoch,
      };
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_JSON',
      });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_ROOT_SCHEMA',
      });
    }

    if (typeof data.isAuthenticated !== 'boolean') {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_ROOT_SCHEMA',
      });
    }

    if (data.isAuthenticated === false) {
      return this._applyUnauthenticated(requestId, operationEpoch, observedAt, validUntil);
    }

    if (!Number.isSafeInteger(data.userId) || data.userId <= 0) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_USER_ID',
      });
    }

    return this._applyVerified(requestId, operationEpoch, data, observedAt, validUntil);
  }
}

export const platziSessionAdapter = new PlatziSessionAdapter();

export const checkResourceDiagnostics = async (identity, session) => {
  if (
    !identity
    || !Number.isSafeInteger(identity.courseId)
    || identity.courseId <= 0
    || !Number.isSafeInteger(identity.classId)
    || identity.classId <= 0
    || typeof identity.canonicalUrl !== 'string'
  ) {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'INVALID_RESOURCE_IDENTITY',
    };
  }

  const currentEpochBefore = useAuthStore.getState().sessionEpoch;
  const nowBefore = Date.now();

  if (
    session?.status !== 'verified'
    || session?.authenticated !== true
    || !session?.accountId
    || session?.sessionEpoch !== currentEpochBefore
    || getSessionValidityDeadline(session, nowBefore) <= nowBefore
  ) {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'UNVERIFIED_SESSION',
    };
  }

  if (!isExtension()) {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'EXTENSION_ONLY_AUTH',
    };
  }

  const targetUrl = `https://api.platzi.com/materials/v1/${identity.classId}/course/${identity.courseId}/links-files/`;
  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      credentials: 'include',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });
  } catch {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'NETWORK_ERROR',
    };
  }

  const observedAt = Date.now();

  const currentEpochAfter = useAuthStore.getState().sessionEpoch;
  if (currentEpochAfter !== session.sessionEpoch) {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'SESSION_EPOCH_MISMATCH',
      observedAt,
    };
  }

  if (getSessionValidityDeadline(session, observedAt) <= observedAt) {
    return {
      status: 'unknown',
      resourceAccess: 'unknown',
      reason: 'SESSION_EXPIRED',
      observedAt,
    };
  }

  if (response.url) {
    try {
      const respUrl = new URL(response.url);
      if (
        respUrl.origin !== 'https://api.platzi.com'
        || respUrl.pathname !== `/materials/v1/${identity.classId}/course/${identity.courseId}/links-files/`
        || respUrl.search !== ''
        || respUrl.hash !== ''
      ) {
        return {
          status: 'unknown',
          httpStatus: response.status,
          resourceAccess: 'unknown',
          reason: 'REDIRECT_INVALID',
          observedAt,
        };
      }
    } catch {
      return {
        status: 'unknown',
        httpStatus: response.status,
        resourceAccess: 'unknown',
        reason: 'REDIRECT_INVALID',
        observedAt,
      };
    }
  }

  const contentType = response.headers?.get ? response.headers.get('content-type') : null;
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return {
      status: 'unknown',
      httpStatus: response.status,
      resourceAccess: 'unknown',
      reason: 'NON_JSON_CONTENT_TYPE',
      observedAt,
    };
  }

  if (response.status === 200) {
    return {
      status: 'observed',
      httpStatus: 200,
      resourceAccess: 'available',
      resourceType: 'links-files',
      observedAt,
    };
  }

  if (response.status === 403) {
    return {
      status: 'observed',
      httpStatus: 403,
      resourceAccess: 'denied',
      resourceType: 'links-files',
      observedAt,
    };
  }

  return {
    status: 'unknown',
    httpStatus: response.status,
    resourceAccess: 'unknown',
    reason: `HTTP_${response.status}`,
    observedAt,
  };
};
