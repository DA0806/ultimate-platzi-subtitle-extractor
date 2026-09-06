import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { parseVtt } from '../utils/vttParser';
import { translate } from '../i18n';

const SUPPORTED_LANGS = ['es', 'en', 'pt', 'de', 'fr'];
const REQUEST_GAP_MS = 400;
const BLOCK_PAGE_PATTERNS = [
  /just a moment/i,
  /verify you are human/i,
  /access denied/i,
  /too many requests/i,
  /rate limit(?:ed)?/i,
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[-/_.])(es|en|pt|de|fr)(?:\.vtt|[-/_.?&]|$)/i);
  return match ? match[1] : null;
};

const extractVttUrls = (html) => {
  // Buscamos URLs completas o hashes de archivos VTT (ej: 6eec75eb...-en.vtt)
  const rawMatches = html.match(/(?:https?:[^\s"'{}><\\]+|[a-zA-Z0-9_-]+)\.vtt/ig) || [];
  
  const cleanedUrls = rawMatches.map(url => {
    let clean = url
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/\\u003d/g, '=');
    
    // Si no empieza con http, es un hash. Asumimos la ruta de Platzi.
    if (!clean.startsWith('http')) {
      clean = `https://static.platzi.com/media/subtitle/${clean}`;
    }
    return clean;
  });
  
  return Array.from(new Set(cleanedUrls));
};

const isRetryableError = (error) => {
  const status = error?.response?.status;
  return !status || [408, 425, 500, 502, 503, 504].includes(status);
};

const getRetryDelay = (error, attempt) => {
  const retryAfterSeconds = Number(error?.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.min(retryAfterSeconds * 1000, 30_000);
  }
  return 500 * (2 ** attempt);
};

const requestWithRetry = async (url, config, beforeRequest, retries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await beforeRequest?.();
      const response = await axios.get(url, config);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) {
        break;
      }
      await sleep(getRetryDelay(error, attempt));
    }
  }
  throw lastError;
};

const isBlockedResponse = (body) => (
  typeof body === 'string' && BLOCK_PAGE_PATTERNS.some(pattern => pattern.test(body))
);

const createBlockedResponseError = () => {
  const error = new Error('Platzi devolvió una página de protección');
  error.code = 'PLATZI_BLOCKED_PAGE';
  return error;
};

const getExtractionNotice = (error) => {
  if (error?.code === 'PLATZI_BLOCKED_PAGE') {
    return translate('extractionNotice.blocked');
  }

  const status = error?.response?.status;
  if (status === 429) {
    return translate('extractionNotice.rateLimited');
  }
  if (status === 403) {
    return translate('extractionNotice.forbidden');
  }
  if (status === 401) {
    return translate('extractionNotice.unauthorized');
  }
  if (status >= 500 && status <= 599) {
    return translate('extractionNotice.server', { status });
  }
  if (['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(error?.code)) {
    return translate('extractionNotice.network');
  }
  return null;
};

export const useSubtitleExtractor = () => {
  const {
    videos,
    updateVideo,
    startExtraction,
    stopExtraction,
    updateProgress,
    setExtractionNotice,
    isExtracting,
    courseInfo,
  } = useSubtitleStore();
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const sessionCookie = useAuthStore(state => state.cookie);

  const extractSubtitles = async () => {
    if (videos.length === 0 || isExtracting || !courseInfo) return;
    
    startExtraction();

    const pendingVideos = videos.filter(v => v.selected && (v.status === 'pending' || v.status === 'error'));
    
    // Concurrency (reducida a 2 para no saturar al servidor al pedir el HTML de cada página)
    const CONCURRENCY = 2;
    let index = 0;
    let stopRequested = false;
    let lastRequestStartedAt = 0;
    let requestQueue = Promise.resolve();

    // ponytail: una cola en memoria por extracción; si hay varios trabajos simultáneos,
    // mover este límite a un scheduler por cuenta.
    const waitForRequestSlot = async () => {
      let release;
      const previousRequest = requestQueue;
      requestQueue = new Promise(resolve => {
        release = resolve;
      });

      await previousRequest;
      const elapsed = Date.now() - lastRequestStartedAt;
      const waitTime = Math.max(0, REQUEST_GAP_MS - elapsed);
      if (waitTime > 0) {
        await sleep(waitTime);
      }
      lastRequestStartedAt = Date.now();
      release();
    };

    const registerFailure = (error) => {
      const notice = getExtractionNotice(error);
      if (!notice) return false;

      stopRequested = true;
      setExtractionNotice(notice);
      return true;
    };

    const worker = async () => {
      while (!stopRequested && index < pendingVideos.length) {
        const video = pendingVideos[index++];
        
        updateVideo(video.id, { status: 'extracting' });
        
        try {
          // 1. Obtener el HTML de la página de la clase a través del proxy para no tener CORS
          const parsedUrl = new URL(video.url);
          const proxyUrl = `/api/platzi${parsedUrl.pathname}`;
          const headers = {
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
          };
          if (sessionCookie) {
            headers['x-platzi-cookie'] = sessionCookie;
          }

          const res = await requestWithRetry(proxyUrl, { headers }, waitForRequestSlot);
          const html = res.data;

          // 2. Extraer URLs VTT, incluyendo variantes escapadas en scripts JSON
          const uniqueVttUrls = extractVttUrls(html);

          if (uniqueVttUrls.length === 0 && isBlockedResponse(html)) {
            throw createBlockedResponseError();
          }

          const extractedContent = {};
          let hasSuccess = false;

          if (uniqueVttUrls.length > 0) {
            const urlsByLang = new Map();
            for (const vttUrl of uniqueVttUrls) {
              const lang = inferLangFromUrl(vttUrl) || 'es';
              if (!urlsByLang.has(lang)) {
                urlsByLang.set(lang, []);
              }
              urlsByLang.get(lang).push(vttUrl);
            }

            // Si el idioma preferido no aparece inferido, intentamos fallback con cualquier VTT
            const candidateUrls = preferredLang === 'all'
              ? uniqueVttUrls
              : (urlsByLang.get(preferredLang) || uniqueVttUrls);

            // Descargar cada VTT candidato
            for (const vttUrl of candidateUrls) {
              try {
                const lang = inferLangFromUrl(vttUrl) || 'es';
                
                // Si el usuario seleccionó un idioma específico, saltar los demás
                if (preferredLang !== 'all' && urlsByLang.get(preferredLang) && lang !== preferredLang) {
                  continue;
                }

                // Descarga de VTT a través del proxy con headers de sesion/referer
                const proxyVttUrl = `/api/proxy?url=${encodeURIComponent(vttUrl)}`;
                const proxyHeaders = {
                  'x-proxy-referer': video.url,
                };
                if (sessionCookie) {
                  proxyHeaders['x-platzi-cookie'] = sessionCookie;
                }

                const vttResponse = await requestWithRetry(proxyVttUrl, {
                  headers: proxyHeaders,
                  responseType: 'text',
                  transformResponse: [(data) => data],
                }, waitForRequestSlot);
                const vttData = vttResponse.data;

                if (isBlockedResponse(vttData)) {
                  throw createBlockedResponseError();
                }
                const cleanText = parseVtt(vttData);

                if (cleanText) {
                  extractedContent[lang] = cleanText;
                  hasSuccess = true;
                }
              } catch (err) {
                console.error(`Error descargando VTT desde ${vttUrl}`, err);
                if (registerFailure(err)) break;
              }
            }
          }

          if (hasSuccess) {
            const extractedLangs = Object.keys(extractedContent).filter((lang) => SUPPORTED_LANGS.includes(lang));
            updateVideo(video.id, { 
              status: 'ready', 
              extractedContent,
              availableLangs: extractedLangs.length > 0 ? extractedLangs : video.availableLangs
            });
          } else {
            // Si la extracción falló porque no hay URLs en toda la página,
            // asumimos que es una lectura, quiz, o simplemente un video sin subtítulos.
            updateVideo(video.id, {
              status: uniqueVttUrls.length === 0 ? 'no-video' : 'error',
              extractedContent: {},
            });
          }

        } catch (error) {
          console.error(`Error procesando clase ${video.slug}`, error);
          registerFailure(error);
          updateVideo(video.id, { status: 'error' });
        } finally {
          updateProgress();
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, pendingVideos.length) }).map(worker);
    
    await Promise.all(workers);
    stopExtraction();
  };

  return { extractSubtitles };
};
