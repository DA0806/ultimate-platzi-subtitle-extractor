import axios from 'axios';
import { assertAuthorizedExportProof, assertFreeAccessProofForUrl } from './platziAccess.js';
import { useAuthStore } from '../store/authStore.js';
import { defaultAuthorizationService } from './authorizationService.js';

export const isExtension = () => (
  typeof globalThis.chrome !== 'undefined' &&
  Boolean(globalThis.chrome?.runtime?.id) &&
  typeof location !== 'undefined' && location.protocol === 'chrome-extension:'
);

const parseHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

export const isAllowedPlatziPageUrl = (value) => {
  const url = parseHttpsUrl(value);
  return Boolean(url && (url.hostname === 'platzi.com' || url.hostname === 'www.platzi.com'));
};

export const isAllowedVttUrl = (value) => {
  const url = parseHttpsUrl(value);
  return Boolean(url && url.hostname === 'static.platzi.com' && url.pathname.toLowerCase().endsWith('.vtt'));
};

const assertAllowedPageUrl = (value) => {
  if (!isAllowedPlatziPageUrl(value)) {
    const error = new Error('La URL debe pertenecer a https://platzi.com o https://www.platzi.com');
    error.code = 'INVALID_PLATZI_URL';
    throw error;
  }
};

const assertAllowedVttRequest = (value) => {
  if (!isAllowedVttUrl(value)) {
    const error = new Error('La URL de subtítulos debe pertenecer a https://static.platzi.com y terminar en .vtt');
    error.code = 'INVALID_VTT_URL';
    throw error;
  }
};

const isClassPageUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean);
    return parts.length === 3 && (parts[0] === 'cursos' || parts[0] === 'clases');
  } catch {
    return false;
  }
};

const assertAuthorizedClassPage = async (targetUrl) => {
  if (!isClassPageUrl(targetUrl)) return null;
  const decision = await defaultAuthorizationService.authorizeClassUrl(targetUrl);
  if (!decision.verified) {
    const error = new Error('La autorización oficial de esta clase no está disponible.');
    error.code = decision.restrictionReason || 'AUTHORIZATION_UNAVAILABLE';
    throw error;
  }
  return decision;
};

const rejectLoginRedirect = (value) => {
  const pathname = new URL(value).pathname.replace(/\/+$/, '');
  if (pathname === '/login' || pathname === '/iniciar-sesion') {
    useAuthStore.getState().invalidateSession();
    const error = new Error('Platzi redirigió la solicitud a una pantalla de inicio de sesión.');
    error.code = 'PLATZI_SESSION_INVALIDATED';
    error.status = 401;
    throw error;
  }
};

const handleHttpResponseErrors = async (response) => {
  if (response.ok) return;

  const errorText = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403) {
    try {
      useAuthStore.getState().invalidateSession();
    } catch {
      // Ignore if store is uninitialized
    }
    const error = new Error(`Sesión de Platzi no autorizada o expirada (${response.status}): ${response.statusText}`);
    error.code = 'PLATZI_SESSION_INVALIDATED';
    error.status = response.status;
    error.response = {
      status: response.status,
      statusText: response.statusText,
      data: errorText,
    };
    throw error;
  }

  if (response.status === 429) {
    const retryHeader = response.headers?.get ? response.headers.get('retry-after') : null;
    const retrySeconds = retryHeader ? Number.parseInt(retryHeader, 10) : null;
    const error = new Error(`Límite de peticiones alcanzado en Platzi (429): ${response.statusText}`);
    error.code = 'PLATZI_RATE_LIMITED';
    error.status = 429;
    error.retryAfter = Number.isFinite(retrySeconds) ? retrySeconds : null;
    error.response = {
      status: response.status,
      statusText: response.statusText,
      data: errorText,
    };
    throw error;
  }

  const error = new Error(`Error al consultar Platzi (${response.status}): ${response.statusText}`);
  error.status = response.status;
  error.response = {
    status: response.status,
    statusText: response.statusText,
    data: errorText,
  };
  throw error;
};

export const getPlatziPage = async (urlOrPath) => {
  if (isExtension()) {
    let targetUrl;
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      targetUrl = urlOrPath;
    } else {
      const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
      targetUrl = `https://platzi.com${cleanPath}`;
    }

    if (!isAllowedPlatziPageUrl(targetUrl)) {
      assertAllowedPageUrl(targetUrl);
    }
    await assertAuthorizedClassPage(targetUrl);

    const headers = {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    await handleHttpResponseErrors(response);

    assertAllowedPageUrl(response.url || targetUrl);
    rejectLoginRedirect(response.url || targetUrl);

    const htmlText = await response.text();
    return {
      data: htmlText,
      status: response.status,
      statusText: response.statusText,
    };
  }

  // Dev server mode (fallback via Vite proxy)
  let pathname;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    assertAllowedPageUrl(urlOrPath);
    const parsed = new URL(urlOrPath);
    pathname = parsed.pathname + parsed.search;
  } else {
    pathname = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }

  assertAllowedPageUrl(`https://platzi.com${pathname}`);
  await assertAuthorizedClassPage(`https://platzi.com${pathname}`);

  const proxyUrl = `/api/platzi${pathname}`;
  const headers = {
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  };

  try {
    const response = await axios.get(proxyUrl, { headers });
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      useAuthStore.getState().invalidateSession();
      err.code = 'PLATZI_SESSION_INVALIDATED';
    } else if (err.response?.status === 429) {
      err.code = 'PLATZI_RATE_LIMITED';
    }
    throw err;
  }
};

export const getVtt = async (vttUrl, referer = null, ...legacyArgs) => {
  const accessProof = legacyArgs[1] || null;
  assertAllowedVttRequest(vttUrl);
  if (referer) assertAllowedPageUrl(referer);
  const currentEpoch = useAuthStore?.getState?.()?.sessionEpoch;
  const targetProof = accessProof;
  assertAuthorizedExportProof(targetProof, vttUrl, { currentSessionEpoch: currentEpoch });
  if (referer) {
    assertFreeAccessProofForUrl(targetProof, referer, vttUrl);
  }

  const identity = targetProof.identity || {
    courseId: targetProof.courseId,
    classId: targetProof.classId,
    canonicalUrl: targetProof.canonicalUrl,
  };
  const currentDecision = await defaultAuthorizationService.recheck(identity);
  if (!currentDecision.verified || currentDecision.accountId !== targetProof.sessionAccount || currentDecision.sessionEpoch !== targetProof.sessionEpoch) {
    const error = new Error('La autorización de exportación ya no es válida');
    error.code = 'AUTHORIZATION_RECHECK_FAILED';
    throw error;
  }

  if (isExtension()) {
    const response = await fetch(vttUrl, {
      method: 'GET',
      credentials: 'include',
    });

    await handleHttpResponseErrors(response);

    const vttText = await response.text();
    return {
      data: vttText,
      status: response.status,
      statusText: response.statusText,
    };
  }

  // Dev server mode (fallback via Vite proxy)
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(vttUrl)}`;
  const headers = {};
  if (referer) {
    headers['x-proxy-referer'] = referer;
  }

  try {
    const response = await axios.get(proxyUrl, {
      headers,
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      useAuthStore.getState().invalidateSession();
      err.code = 'PLATZI_SESSION_INVALIDATED';
    } else if (err.response?.status === 429) {
      err.code = 'PLATZI_RATE_LIMITED';
    }
    throw err;
  }
};

export const fetchPlatziHtml = getPlatziPage;
export const fetchVttContent = getVtt;
