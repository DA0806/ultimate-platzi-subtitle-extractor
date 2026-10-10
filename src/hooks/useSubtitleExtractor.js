import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { defaultAuthorizationService } from '../utils/authorizationService.js';
import { getPlatziPage, getVtt } from '../utils/platziClient';
import {
  inspectClassIdentityDocument,
  extractProtectedMaterial,
  createPlatziAccessError,
} from '../utils/platziAccess.js';
import { parseVtt } from '../utils/vttParser';
import { translate } from '../i18n';
import { requestWithRetry } from '../utils/requestWithRetry.js';

const SUPPORTED_LANGS = ['es', 'en', 'pt', 'de', 'fr'];
const REQUEST_GAP_MS = 400;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BLOCK_PAGE_PATTERNS = [
  /just a moment/i,
  /verify you are human/i,
  /access denied/i,
  /too many requests/i,
  /rate limit(?:ed)?/i,
];

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[-/_.])(es|en|pt|de|fr)(?:\.vtt|[-/_.?&]|$)/i);
  return match ? match[1] : null;
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
  if (error?.code === 'PLATZI_SESSION_INVALIDATED' || error?.status === 401) {
    return translate('extractionNotice.sessionInvalidated') || translate('extractionNotice.unauthorized');
  }
  if (error?.code === 'PLATZI_ACCESS_UNVERIFIED') {
    return translate('extractionNotice.accessUnverified');
  }
  if (error?.code === 'AUTHORIZATION_UNAVAILABLE' || error?.code === 'AUTHORIZATION_RECHECK_FAILED') {
    return translate('extractionNotice.authorizationUnavailable') || translate('extractionNotice.accessUnverified');
  }
  if (typeof error?.code === 'string' && error.code.startsWith('AUTHORIZATION_')) {
    return translate('extractionNotice.authorizationUnavailable') || translate('extractionNotice.accessUnverified');
  }
  if (error?.code === 'PLATZI_BLOCKED_PAGE') {
    return translate('extractionNotice.blocked');
  }
  const status = error?.response?.status || error?.status;
  if (status === 429 || error?.code === 'PLATZI_RATE_LIMITED') {
    return translate('extractionNotice.rateLimited');
  }
  if (status === 403) {
    return translate('extractionNotice.forbidden');
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

  const extractSubtitles = async () => {
    if (videos.length === 0 || isExtracting || !courseInfo) return;
    
    startExtraction();

    const jobEpoch = useAuthStore.getState().sessionEpoch ?? 0;

    const pendingVideos = videos.filter(v => v.selected && (v.status === 'pending' || v.status === 'error'));

    // Do not request class HTML or protected material until an official session source exists.
    const sessionCheck = await defaultAuthorizationService.adapter.checkSession();
    if (sessionCheck?.status !== 'verified' || sessionCheck.authenticated !== true) {
      const error = new Error('La autorización oficial de la sesión no está disponible.');
      error.code = 'AUTHORIZATION_UNAVAILABLE';
      setExtractionNotice(getExtractionNotice(error));
      stopExtraction();
      return;
    }
    useAuthStore.getState().setSessionStatus('authenticated');
    
    // Concurrency limit: 2 workers
    const CONCURRENCY = 2;
    let index = 0;
    let stopRequested = false;
    let lastRequestStartedAt = 0;
    let requestQueue = Promise.resolve();

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

      const session = await defaultAuthorizationService.adapter.checkSession();
      if (session?.status !== 'verified' || session.authenticated !== true || !session.accountId || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now() || session.sessionEpoch !== useAuthStore.getState().sessionEpoch) {
        const error = new Error('La autorización oficial de la sesión ya no está vigente.');
        error.code = 'AUTHORIZATION_RECHECK_FAILED';
        throw error;
      }
    };

    const registerFailure = (error) => {
      const notice = getExtractionNotice(error);
      if (error?.code === 'PLATZI_SESSION_INVALIDATED' || error?.status === 401 || error?.status === 403) {
        stopRequested = true;
        useAuthStore.getState().invalidateSession();
        useSubtitleStore.getState().purgeExtractedContent();
        if (notice) setExtractionNotice(notice);
        return true;
      }

      if (notice) {
        stopRequested = true;
        setExtractionNotice(notice);
        return true;
      }
      return false;
    };

    const worker = async () => {
      while (!stopRequested && index < pendingVideos.length) {
        if (useAuthStore.getState().sessionEpoch !== jobEpoch) {
          stopRequested = true;
          return;
        }

        const video = pendingVideos[index++];
        updateVideo(video.id, { status: 'extracting' });
        
        try {
          // Resolve and authorize the public identity before the first class request.
          let preauthorization = await defaultAuthorizationService.authorizeClassUrl(video.url);
          if (!preauthorization.verified) {
            const authorizationError = new Error('La autorización oficial de esta clase no está disponible.');
            authorizationError.code = preauthorization.restrictionReason || 'AUTHORIZATION_UNAVAILABLE';
            throw authorizationError;
          }

          // The class gateway repeats this full gate on every HTTP attempt.
          const res = await requestWithRetry(
            () => getPlatziPage(video.url),
            async () => {
              await waitForRequestSlot();
              preauthorization = await defaultAuthorizationService.authorizeClassUrl(video.url);
              if (!preauthorization.verified) {
                const authorizationError = new Error('La autorización oficial de esta clase ya no está vigente.');
                authorizationError.code = preauthorization.restrictionReason || 'AUTHORIZATION_RECHECK_FAILED';
                throw authorizationError;
              }
            }
          );

          if (stopRequested || useAuthStore.getState().sessionEpoch !== jobEpoch) return;

          const html = res.data;
          const doc = typeof DOMParser === 'function' ? new DOMParser().parseFromString(html, 'text/html') : null;
          if (!doc) throw createPlatziAccessError('DOM_PARSER_UNAVAILABLE');

          // Corroborate the public resolver with the SSR identity after authorization.
          const identity = inspectClassIdentityDocument(doc, video.url);
          if (!identity) throw createPlatziAccessError('UNKNOWN_METADATA');
          if (
            identity.courseId !== preauthorization.identity.courseId ||
            identity.classId !== preauthorization.identity.classId ||
            identity.canonicalUrl !== preauthorization.identity.canonicalUrl
          ) {
            const mismatch = new Error('La identidad SSR no coincide con la identidad pública autorizada.');
            mismatch.code = 'AUTHORIZATION_BINDING_MISMATCH';
            throw mismatch;
          }

          const capabilities = preauthorization;
          useAuthStore.getState().setSessionStatus('authenticated');

          // Bloqueo temporal para clases no exportables
          if (!capabilities.canExportSubtitles && !capabilities.canExport) {
            updateVideo(video.id, {
              status: 'error',
              restrictionReason: capabilities.restrictionReason,
            });
            const blockedError = createPlatziAccessError(capabilities.restrictionReason);
            blockedError.code = capabilities.restrictionReason === 'AUTHORIZATION_UNAVAILABLE'
              ? 'AUTHORIZATION_UNAVAILABLE'
              : blockedError.code;
            registerFailure(blockedError);
            continue;
          }

          // Emitir prueba efímera and obtain VTT tracks only after the corroboration.
          const accessProof = extractProtectedMaterial(doc, identity, capabilities, {
            sessionEpoch: jobEpoch,
            sessionAccount: capabilities.sessionAccount,
          });
          const uniqueVttUrls = accessProof.authorizedVttUrls || accessProof.vttUrls || [];

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

            const candidateUrls = preferredLang === 'all'
              ? uniqueVttUrls
              : (urlsByLang.get(preferredLang) || uniqueVttUrls);

            for (const vttUrl of candidateUrls) {
              if (stopRequested || useAuthStore.getState().sessionEpoch !== jobEpoch) return;

              try {
                const lang = inferLangFromUrl(vttUrl) || 'es';
                if (preferredLang !== 'all' && urlsByLang.get(preferredLang) && lang !== preferredLang) {
                  continue;
                }

                const vttResponse = await requestWithRetry(
                  () => getVtt(vttUrl, video.url, null, accessProof),
                  waitForRequestSlot
                );
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

          // Verificación de stale race antes de escribir estado consolidado
          if (stopRequested || useAuthStore.getState().sessionEpoch !== jobEpoch) return;

          if (hasSuccess) {
            const extractedLangs = Object.keys(extractedContent).filter((lang) => SUPPORTED_LANGS.includes(lang));
            updateVideo(video.id, { 
              status: 'ready', 
              extractedContent,
              authorizationProof: accessProof,
              availableLangs: extractedLangs.length > 0 ? extractedLangs : video.availableLangs
            });
          } else {
            updateVideo(video.id, {
              status: uniqueVttUrls.length === 0 ? 'no-video' : 'error',
              extractedContent: {},
            });
          }

        } catch (error) {
          console.error(`Error procesando clase ${video.slug}`, error);
          registerFailure(error);
          if (useAuthStore.getState().sessionEpoch === jobEpoch) {
            updateVideo(video.id, { status: 'error' });
          }
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
