import axios from 'axios';

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
  return Boolean(url && url.hostname === 'static.platzi.com');
};

export const getPlatziPage = async (urlOrPath, sessionCookie = null) => {
  if (isExtension()) {
    let targetUrl;
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      targetUrl = urlOrPath;
    } else {
      const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
      targetUrl = `https://platzi.com${cleanPath}`;
    }

    if (!isAllowedPlatziPageUrl(targetUrl)) {
      throw new Error('La URL debe pertenecer a https://platzi.com o https://www.platzi.com');
    }

    const headers = {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(`Error al consultar Platzi (${response.status}): ${response.statusText}`);
      error.status = response.status;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorText,
      };
      throw error;
    }

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
    const parsed = new URL(urlOrPath);
    pathname = parsed.pathname + parsed.search;
  } else {
    pathname = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }

  const proxyUrl = `/api/platzi${pathname}`;
  const headers = {
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  };
  if (sessionCookie) {
    headers['x-platzi-cookie'] = sessionCookie;
  }

  const response = await axios.get(proxyUrl, { headers });
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
  };
};

export const getVtt = async (vttUrl, referer = null, sessionCookie = null) => {
  if (isExtension()) {
    if (!isAllowedVttUrl(vttUrl)) {
      throw new Error('La URL de subtítulos debe pertenecer a https://static.platzi.com');
    }

    const response = await fetch(vttUrl, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(`Error al descargar VTT (${response.status}): ${response.statusText}`);
      error.status = response.status;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorText,
      };
      throw error;
    }

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
  if (sessionCookie) {
    headers['x-platzi-cookie'] = sessionCookie;
  }

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
};

export const fetchPlatziHtml = getPlatziPage;
export const fetchVttContent = getVtt;
