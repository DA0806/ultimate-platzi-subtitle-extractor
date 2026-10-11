import { isExtension } from './platziClient.js';
import { useAuthStore } from '../store/authStore.js';
import { getSessionValidityDeadline } from './sessionDeadline.js';
import { getVersionInfo } from './version.js';

export const SESSION_USER_ENDPOINT = 'https://api.platzi.com/api/v1/components/headerv2/user/';
export const OBSERVATION_TTL_MS = 30_000;

export const buildSanitizedDiagnostic = ({
  environment = isExtension() ? 'extension' : 'web_other',
  httpStatus = null,
  responseKind = 'not_received',
  authStatus = 'auth_unknown',
  reason = 'UNKNOWN',
  urlExactMatch = false,
} = {}) => {
  const validHttpStatus = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null;
  const validResponseKind = ['empty', 'json', 'html', 'other', 'unread', 'not_received'].includes(responseKind)
    ? responseKind
    : 'other';
  const validAuthStatus = ['auth_unknown', 'authenticated', 'unauthenticated'].includes(authStatus)
    ? authStatus
    : 'auth_unknown';
  const allowedReasons = [
    'HTTP_404', 'HTTP_403', 'HTTP_401', 'HTTP_429', 'TIMEOUT', 'ABORTED',
    'NETWORK_ERROR', 'NON_JSON_CONTENT_TYPE', 'READ_BODY_FAILED',
    'INVALID_JSON', 'INVALID_ROOT_SCHEMA', 'INVALID_USER_ID',
    'REDIRECT_INVALID', 'SESSION_EPOCH_MISMATCH', 'STALE_REQUEST',
    'EXTENSION_ONLY_AUTH', 'ACCOUNT_CHANGED', 'HTTP_OTHER', 'OK',
  ];
  const sanitizedReason = allowedReasons.includes(reason)
    ? reason
    : 'UNKNOWN';
  const versionInfo = getVersionInfo();

  return Object.freeze({
    environment: environment === 'extension' ? 'extension' : 'web_other',
    codeVersion: versionInfo.codeVersion,
    manifestVersion: versionInfo.manifestVersion,
    endpointHint: 'headerv2/user/',
    method: 'GET',
    httpStatus: validHttpStatus,
    responseKind: validResponseKind,
    authStatus: validAuthStatus,
    reason: sanitizedReason,
    urlExactMatch: Boolean(urlExactMatch),
  });
};

export const formatDiagnosticReport = (diag) => {
  if (!diag) return '';
  const safe = buildSanitizedDiagnostic(diag);
  const env = safe.environment === 'extension' ? 'Chrome Extension' : 'Web / Other';
  const http = safe.httpStatus !== null ? String(safe.httpStatus) : 'null';

  let resp = 'desconocida';
  if (safe.responseKind === 'empty') resp = 'vacía';
  else if (safe.responseKind === 'json') resp = 'json';
  else if (safe.responseKind === 'html') resp = 'html';
  else if (safe.responseKind === 'other') resp = 'otra';
  else if (safe.responseKind === 'unread') resp = 'no leída';
  else if (safe.responseKind === 'not_received') resp = 'no recibida';

  let auth = 'desconocida';
  if (safe.authStatus === 'authenticated') auth = 'autenticada';
  else if (safe.authStatus === 'unauthenticated') auth = 'sin sesión';

  return [
    `Entorno: ${env}`,
    `Versión código: ${safe.codeVersion}`,
    `Versión manifest: ${safe.manifestVersion || 'no disponible'}`,
    `Endpoint: ${safe.endpointHint}`,
    `Método: ${safe.method}`,
    `HTTP: ${http}`,
    `Respuesta: ${resp}`,
    `Autenticación: ${auth}`,
    `Motivo: ${safe.reason}`,
  ].join('\n');
};

export class PlatziSessionAdapter {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.getSessionEpoch = options.getSessionEpoch || (() => useAuthStore.getState().sessionEpoch || 0);
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 10_000;
    this.lastVerifiedAccountId = null;
    this.requestIdCounter = 0;
    this.latestStartedRequestId = 0;
    this.latestCompletedRequestId = 0;
  }

  _isStale(requestId, operationEpoch) {
    if (this.getSessionEpoch() !== operationEpoch) {
      return { isStale: true, reason: 'SESSION_EPOCH_MISMATCH' };
    }
    if (requestId < this.latestStartedRequestId) {
      return { isStale: true, reason: 'STALE_REQUEST' };
    }
    if (requestId < this.latestCompletedRequestId) {
      return { isStale: true, reason: 'STALE_REQUEST' };
    }
    return { isStale: false };
  }

  _applyOutcome(requestId, operationEpoch, outcome, diagnosticProps = {}) {
    const staleCheck = this._isStale(requestId, operationEpoch);
    if (staleCheck.isStale) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: staleCheck.reason,
        sessionEpoch: operationEpoch,
      };
    }
    this.latestCompletedRequestId = requestId;

    useAuthStore.getState().setUser(null);
    useAuthStore.getState().setSessionStatus('unknown');

    const sanitizedDiag = buildSanitizedDiagnostic({
      ...diagnosticProps,
      authStatus: 'auth_unknown',
      reason: outcome.reason,
    });
    useAuthStore.getState().setVerificationResult({
      isVerifying: false,
      lastDiagnostic: sanitizedDiag,
    });

    return {
      ...outcome,
      sessionEpoch: operationEpoch,
    };
  }

  _applyUnauthenticated(requestId, operationEpoch, observedAt, validUntil, diagnosticProps = {}) {
    const staleCheck = this._isStale(requestId, operationEpoch);
    if (staleCheck.isStale) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: staleCheck.reason,
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

    const sanitizedDiag = buildSanitizedDiagnostic({
      ...diagnosticProps,
      authStatus: 'unauthenticated',
      reason: 'OK',
    });
    useAuthStore.getState().setVerificationResult({
      isVerifying: false,
      lastDiagnostic: sanitizedDiag,
    });

    return {
      status: 'unauthenticated',
      authenticated: false,
      sessionEpoch: this.getSessionEpoch(),
      observedAt,
      validUntil,
      sessionExpiresAt: null,
    };
  }

  _applyVerified(requestId, operationEpoch, data, observedAt, validUntil, diagnosticProps = {}) {
    const staleCheck = this._isStale(requestId, operationEpoch);
    if (staleCheck.isStale) {
      return {
        status: 'unknown',
        authenticated: false,
        reason: staleCheck.reason,
        sessionEpoch: operationEpoch,
      };
    }
    this.latestCompletedRequestId = requestId;

    const accountId = String(data.userId);
    let currentEpoch = operationEpoch;
    const accountChanged = this.lastVerifiedAccountId !== null && this.lastVerifiedAccountId !== accountId;
    if (accountChanged) {
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

    const sanitizedDiag = buildSanitizedDiagnostic({
      ...diagnosticProps,
      authStatus: 'authenticated',
      reason: accountChanged ? 'ACCOUNT_CHANGED' : 'OK',
    });
    useAuthStore.getState().setVerificationResult({
      isVerifying: false,
      lastDiagnostic: sanitizedDiag,
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
    this.latestStartedRequestId = requestId;
    const operationEpoch = this.getSessionEpoch();

    useAuthStore.getState().setVerifying(true, requestId);

    if (!isExtension()) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'EXTENSION_ONLY_AUTH',
      }, {
        environment: 'web_other',
        httpStatus: null,
        responseKind: 'not_received',
        reason: 'EXTENSION_ONLY_AUTH',
      });
    }

    const controller = new AbortController();
    let timeoutFired = false;
    const timeoutId = setTimeout(() => {
      timeoutFired = true;
      try {
        controller.abort('timeout');
      } catch {
        // Safe abort
      }
    }, this.timeoutMs);

    let response;
    try {
      response = await fetch(SESSION_USER_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      const postFetchStale = this._isStale(requestId, operationEpoch);
      if (postFetchStale.isStale) {
        clearTimeout(timeoutId);
        return this._applyOutcome(requestId, operationEpoch, {
          status: 'unknown',
          authenticated: false,
          reason: postFetchStale.reason,
        });
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isTimeout = timeoutFired || fetchErr?.name === 'TimeoutError' || (fetchErr?.name === 'AbortError' && timeoutFired);
      const isAborted = !isTimeout && fetchErr?.name === 'AbortError';
      const reason = isTimeout ? 'TIMEOUT' : (isAborted ? 'ABORTED' : 'NETWORK_ERROR');
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason,
      }, {
        environment: 'extension',
        httpStatus: null,
        responseKind: 'not_received',
        reason,
      });
    }

    let urlExactMatch = !response.url;
    if (response.url) {
      try {
        const respUrl = new URL(response.url);
        urlExactMatch = (
          respUrl.origin === 'https://api.platzi.com'
          && respUrl.pathname === '/api/v1/components/headerv2/user/'
          && respUrl.search === ''
          && respUrl.hash === ''
        );
      } catch {
        urlExactMatch = false;
      }
    }

    if (!urlExactMatch) {
      clearTimeout(timeoutId);
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'REDIRECT_INVALID',
      }, {
        environment: 'extension',
        httpStatus: response.status,
        responseKind: 'other',
        urlExactMatch: false,
        reason: 'REDIRECT_INVALID',
      });
    }

    let bodyText = '';
    let readBodyFailed = false;
    try {
      bodyText = await response.text();
      const postBodyStale = this._isStale(requestId, operationEpoch);
      if (postBodyStale.isStale) {
        clearTimeout(timeoutId);
        return this._applyOutcome(requestId, operationEpoch, {
          status: 'unknown',
          authenticated: false,
          reason: postBodyStale.reason,
        });
      }
    } catch (readErr) {
      readBodyFailed = true;
      if (timeoutFired || readErr?.name === 'TimeoutError' || (readErr?.name === 'AbortError' && timeoutFired)) {
        clearTimeout(timeoutId);
        return this._applyOutcome(requestId, operationEpoch, {
          status: 'unknown',
          authenticated: false,
          reason: 'TIMEOUT',
        }, {
          environment: 'extension',
          httpStatus: response.status,
          responseKind: 'unread',
          urlExactMatch: true,
          reason: 'TIMEOUT',
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (timeoutFired) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'TIMEOUT',
      }, {
        environment: 'extension',
        httpStatus: response.status,
        responseKind: 'unread',
        urlExactMatch: true,
        reason: 'TIMEOUT',
      });
    }

    const contentType = response.headers?.get ? response.headers.get('content-type') : null;
    let responseKind = 'other';
    if (readBodyFailed) {
      responseKind = 'unread';
    } else if (!bodyText || bodyText.trim().length === 0) {
      responseKind = 'empty';
    } else if (contentType && contentType.toLowerCase().includes('application/json')) {
      responseKind = 'json';
    } else if (contentType && contentType.toLowerCase().includes('text/html')) {
      responseKind = 'html';
    }

    const observedAt = this.now();
    const validUntil = observedAt + OBSERVATION_TTL_MS;

    if (response.status !== 200) {
      const statusReasons = {
        401: 'HTTP_401',
        403: 'HTTP_403',
        404: 'HTTP_404',
        429: 'HTTP_429',
      };
      const reason = statusReasons[response.status] || 'HTTP_OTHER';
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason,
      }, {
        environment: 'extension',
        httpStatus: response.status,
        responseKind,
        urlExactMatch: true,
        reason,
      });
    }

    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'NON_JSON_CONTENT_TYPE',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind,
        urlExactMatch: true,
        reason: 'NON_JSON_CONTENT_TYPE',
      });
    }

    if (readBodyFailed) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'READ_BODY_FAILED',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind: 'unread',
        urlExactMatch: true,
        reason: 'READ_BODY_FAILED',
      });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_JSON',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind,
        urlExactMatch: true,
        reason: 'INVALID_JSON',
      });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_ROOT_SCHEMA',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind: 'json',
        urlExactMatch: true,
        reason: 'INVALID_ROOT_SCHEMA',
      });
    }

    if (typeof data.isAuthenticated !== 'boolean') {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_ROOT_SCHEMA',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind: 'json',
        urlExactMatch: true,
        reason: 'INVALID_ROOT_SCHEMA',
      });
    }

    if (data.isAuthenticated === false) {
      return this._applyUnauthenticated(requestId, operationEpoch, observedAt, validUntil, {
        environment: 'extension',
        httpStatus: 200,
        responseKind: 'json',
        urlExactMatch: true,
      });
    }

    if (!Number.isSafeInteger(data.userId) || data.userId <= 0) {
      return this._applyOutcome(requestId, operationEpoch, {
        status: 'unknown',
        authenticated: false,
        reason: 'INVALID_USER_ID',
      }, {
        environment: 'extension',
        httpStatus: 200,
        responseKind: 'json',
        urlExactMatch: true,
        reason: 'INVALID_USER_ID',
      });
    }

    return this._applyVerified(requestId, operationEpoch, data, observedAt, validUntil, {
      environment: 'extension',
      httpStatus: 200,
      responseKind: 'json',
      urlExactMatch: true,
    });
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
