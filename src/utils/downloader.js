import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { mergeSubtitles } from './textMerger.js';
import { useAuthStore } from '../store/authStore.js';
import { useSubtitleStore } from '../store/subtitleStore.js';
import {
  assertAuthorizedExportProof,
  revokeProof,
  isProofRevoked,
  bumpClassRevision,
} from './platziAccess.js';
import { defaultAuthorizationService } from './authorizationService.js';
import { assertPlayerAuthorizationProof, getPlayerPageIdentity } from './playerTracks.js';

const saveAs = fileSaver?.saveAs || fileSaver;

const normalizePageUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['platzi.com', 'www.platzi.com'].includes(url.hostname.toLowerCase())) return null;
    const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return `https://platzi.com${pathname}/`;
  } catch {
    return null;
  }
};

const isPlayerProof = proof => proof?.provider === 'user_authorized_player';
const normalizePlayerUrl = value => getPlayerPageIdentity(value)?.pageKey || null;
const sendPlayerValidation = proof => new Promise((resolve, reject) => {
  const extension = globalThis.chrome;
  if (!extension?.runtime?.sendMessage) {
    reject(Object.assign(new Error('La validación del reproductor requiere la extensión instalada.'), { code: 'PLAYER_EXTENSION_UNAVAILABLE' }));
    return;
  }
  extension.runtime.sendMessage({ type: 'PLAYER_VALIDATE', proof }, response => {
    if (extension.runtime.lastError) reject(Object.assign(new Error(extension.runtime.lastError.message), { code: 'PLAYER_MESSAGE_FAILED' }));
    else resolve(response);
  });
});

export const createExportContext = (videos = []) => {
  const authState = useAuthStore.getState();
  const storeVideos = useSubtitleStore.getState().videos;
  return Object.freeze({
    initialEpoch: authState.sessionEpoch ?? 0,
    sessionStatus: authState.sessionStatus,
    startedAt: Date.now(),
    initialStoreVideosLength: Array.isArray(storeVideos) ? storeVideos.length : 0,
    videosCount: videos.length,
  });
};

export const assertExportPreflight = (context, videos = []) => {
  const requiresPlatziSession = videos.length === 0 || videos.some(video => !isPlayerProof(video?.authorizationProof));
  if (!requiresPlatziSession) return;
  const currentStatus = useAuthStore?.getState?.()?.sessionStatus;
  const currentEpoch = useAuthStore?.getState?.()?.sessionEpoch ?? 0;
  if (currentStatus !== 'authenticated') {
    const error = new Error('No se puede exportar: la sesión de Platzi ha sido invalidada. Abre platzi.com y vuelve a verificar.');
    error.code = currentStatus === 'session_invalid'
      ? 'SESSION_INVALIDATED_CANNOT_EXPORT'
      : 'AUTHORIZATION_RECHECK_REQUIRED';
    throw error;
  }
  if (context && (currentEpoch !== context.initialEpoch || currentStatus !== context.sessionStatus)) {
    const error = new Error('La sesión de usuario cambió o fue invalidada durante la exportación.');
    error.code = 'SESSION_INVALIDATED_CANNOT_EXPORT';
    throw error;
  }
};

const assertVideoStoreMembership = (video) => {
  const storeVideos = useSubtitleStore.getState().videos;
  if (!Array.isArray(storeVideos) || storeVideos.length === 0) {
    const error = new Error('El almacén de subtítulos fue reiniciado.');
    error.code = 'STORE_CONTENT_PURGED';
    throw error;
  }
  const playerVideo = isPlayerProof(video.authorizationProof);
  const videoUrl = playerVideo
    ? normalizePlayerUrl(video.url || video.canonicalUrl)
    : normalizePageUrl(video.url || video.canonicalUrl);
  if (!videoUrl) {
    const error = new Error('La identidad canónica del video no está disponible en el almacén.');
    error.code = 'STORE_CONTENT_STALE';
    throw error;
  }
  const currentVideo = storeVideos.find(candidate => (
    candidate.id === video.id &&
    (playerVideo ? normalizePlayerUrl(candidate.url || candidate.canonicalUrl) : normalizePageUrl(candidate.url || candidate.canonicalUrl)) === videoUrl
  ));
  if (!currentVideo) {
    const error = new Error('El video a exportar no pertenece al curso cargado en el almacén.');
    error.code = 'STORE_CONTENT_STALE';
    throw error;
  }
  if (currentVideo.authorizationProof !== video.authorizationProof) {
    const error = new Error('La prueba de autorización del video fue reemplazada.');
    error.code = 'STORE_CONTENT_STALE';
    throw error;
  }
  if (video.status === 'no-video') {
    if (currentVideo.status !== 'no-video') {
      const error = new Error('El estado de lectura del video fue reemplazado.');
      error.code = 'STORE_CONTENT_STALE';
      throw error;
    }
    return;
  }
  if (currentVideo.status !== 'ready' || !currentVideo.extractedContent || Object.keys(currentVideo.extractedContent).length === 0 || currentVideo.extractedContent !== video.extractedContent) {
    const error = new Error('El contenido extraído del video fue purgado o invalidado.');
    error.code = 'STORE_CONTENT_PURGED';
    throw error;
  }
};

const assertVideoMatchesProof = (video, proof) => {
  if (video.authorizationProof && video.authorizationProof !== proof) {
    const error = new Error('La prueba de autorización no coincide con el video.');
    error.code = 'AUTHORIZATION_BINDING_MISMATCH';
    throw error;
  }
  const videoUrl = video.url || video.canonicalUrl;
  if (videoUrl) {
    const playerVideo = isPlayerProof(proof);
    const normVideoUrl = playerVideo ? normalizePlayerUrl(videoUrl) : normalizePageUrl(videoUrl);
    const normProofUrl = playerVideo ? proof.pageKey : normalizePageUrl(proof.canonicalUrl || proof.pageUrl);
    if (!normVideoUrl || !normProofUrl || normVideoUrl !== normProofUrl) {
      const error = new Error('La URL canónica del video no coincide con la prueba de autorización.');
      error.code = 'AUTHORIZATION_BINDING_MISMATCH';
      throw error;
    }
  }
  if (isPlayerProof(proof)) {
    if (video.provenance !== 'user_authorized_player') {
      const error = new Error('El contenido del reproductor no tiene una procedencia válida.');
      error.code = 'AUTHORIZATION_BINDING_MISMATCH';
      throw error;
    }
    return;
  }
  if (video.slug && proof.classSlug && video.slug !== proof.classSlug) {
    const error = new Error('El slug de clase no coincide con la prueba.');
    error.code = 'AUTHORIZATION_BINDING_MISMATCH';
    throw error;
  }
  if (video.classId && proof.classId && video.classId !== proof.classId) {
    const error = new Error('El identificador de clase no coincide con la prueba.');
    error.code = 'AUTHORIZATION_BINDING_MISMATCH';
    throw error;
  }
};

const revalidateExportPreflight = async (videos = [], context) => {
  assertExportPreflight(context, videos);

  for (const video of videos) {
    const proof = video?.authorizationProof;
    if (!proof) {
      const error = new Error('La autorización de esta clase no está disponible o debe verificarse de nuevo.');
      error.code = 'AUTHORIZATION_RECHECK_REQUIRED';
      throw error;
    }

    assertVideoMatchesProof(video, proof);
    assertVideoStoreMembership(video);

    if (isPlayerProof(proof)) {
      assertPlayerAuthorizationProof(proof, {
        pageUrl: proof.pageKey,
        tabId: proof.tabId,
        documentId: proof.documentId,
        playerId: proof.playerId,
        trackId: proof.trackId,
        playerRevision: proof.playerRevision,
        authorizationNonce: proof.authorizationNonce,
      });
      const validation = await sendPlayerValidation(proof);
      if (!validation?.ok) {
        const error = new Error(validation?.error?.message || 'La página o la pista cambiaron; vuelve a detectar la pista.');
        error.code = validation?.error?.code || 'PLAYER_STALE_CONTEXT';
        throw error;
      }
      continue;
    }

    if (isProofRevoked(proof.proofId)) {
      const error = new Error('La prueba de autorización de esta clase fue revocada.');
      error.code = 'PROOF_REVOKED';
      throw error;
    }

    assertAuthorizedExportProof(
      proof,
      proof.authorizedVttUrls?.[0] || null,
      { currentSessionEpoch: context.initialEpoch }
    );

    const identity = proof.identity || {
      courseId: proof.courseId,
      classId: proof.classId,
      canonicalUrl: proof.canonicalUrl,
    };

    const decision = await defaultAuthorizationService.recheck(identity, {
      expectedAccount: proof.sessionAccount,
    });

    assertExportPreflight(context, videos);

    const now = Date.now();
    if (proof.expiresAt && now >= proof.expiresAt) {
      const error = new Error('La prueba de autorización caducó durante la revalidación.');
      error.code = 'PROOF_EXPIRED';
      throw error;
    }

    const decisionMatches = Boolean(
      decision.verified &&
      decision.canonicalUrl === proof.canonicalUrl &&
      decision.classId === proof.classId &&
      decision.courseId === proof.courseId &&
      decision.accountId === proof.sessionAccount &&
      decision.sessionEpoch === context.initialEpoch &&
      decision.expiresAt > now
    );

    if (!decisionMatches) {
      if (decision.accountId && decision.accountId !== proof.sessionAccount) {
        useAuthStore.getState().invalidateSession();
      }
      if (decision.restrictionReason === 'CLASS_ACCESS_DENIED' || decision.restrictionReason === 'EXPORT_PERMISSION_DENIED') {
        bumpClassRevision(proof.sessionAccount, context.initialEpoch, proof.canonicalUrl);
        useSubtitleStore.getState().updateVideo(video.id, { extractedContent: {}, status: 'error' });
      }
      if (proof.proofId) {
        revokeProof(proof.proofId);
      }
      const error = new Error('La autorización de exportación ya no es válida.');
      error.code = 'AUTHORIZATION_RECHECK_FAILED';
      throw error;
    }
  }
};

const assertFinalExportPreflight = async (videos, context) => {
  assertExportPreflight(context, videos);
  for (const video of videos) {
    const proof = video?.authorizationProof;
    assertVideoMatchesProof(video, proof);
    assertVideoStoreMembership(video);
    if (isPlayerProof(proof)) {
      assertPlayerAuthorizationProof(proof, {
        pageUrl: proof.pageKey,
        tabId: proof.tabId,
        documentId: proof.documentId,
        playerId: proof.playerId,
        trackId: proof.trackId,
        playerRevision: proof.playerRevision,
        authorizationNonce: proof.authorizationNonce,
      });
      const validation = await sendPlayerValidation(proof);
      if (!validation?.ok) {
        const error = new Error(validation?.error?.message || 'La página o la pista cambiaron; vuelve a detectar la pista.');
        error.code = validation?.error?.code || 'PLAYER_STALE_CONTEXT';
        throw error;
      }
      continue;
    }
    assertAuthorizedExportProof(proof, proof.authorizedVttUrls?.[0] || null, {
      currentSessionEpoch: context.initialEpoch,
    });
  }
};

// Keep this synchronous guard immediately adjacent to every external export side effect.
const assertFinalExportSinkPreflight = (videos, context) => {
  assertExportPreflight(context, videos);
  for (const video of videos) {
    const proof = video?.authorizationProof;
    assertVideoMatchesProof(video, proof);
    assertVideoStoreMembership(video);
    if (isPlayerProof(proof)) {
      assertPlayerAuthorizationProof(proof, {
        pageUrl: proof.pageKey,
        tabId: proof.tabId,
        documentId: proof.documentId,
        playerId: proof.playerId,
        trackId: proof.trackId,
        playerRevision: proof.playerRevision,
        authorizationNonce: proof.authorizationNonce,
      });
    } else {
      assertAuthorizedExportProof(proof, proof.authorizedVttUrls?.[0] || null, {
        currentSessionEpoch: context.initialEpoch,
      });
    }
  }
};

export const copyMergedTxt = async (videos, targetLang) => {
  const context = createExportContext(videos);
  await revalidateExportPreflight(videos, context);
  assertExportPreflight(context, videos);

  for (const video of videos) {
    if (isProofRevoked(video?.authorizationProof?.proofId)) {
      const error = new Error('La prueba de autorización de esta clase fue revocada.');
      error.code = 'PROOF_REVOKED';
      throw error;
    }
    assertVideoStoreMembership(video);
  }

  const mergedText = mergeSubtitles(videos, targetLang);
  if (!mergedText) return;

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    const error = new Error('La API del portapapeles no está disponible en este entorno.');
    error.code = 'CLIPBOARD_UNAVAILABLE';
    throw error;
  }

  await assertFinalExportPreflight(videos, context);
  assertFinalExportSinkPreflight(videos, context);

  await navigator.clipboard.writeText(mergedText);
};

export const downloadVideoTxt = async (video, targetLang, courseSlug, index) => {
  const context = createExportContext([video]);
  await revalidateExportPreflight([video], context);
  assertExportPreflight(context, [video]);

  await assertFinalExportPreflight([video], context);

  if (!video?.extractedContent) return;

  const fallbackLang = Object.keys(video.extractedContent)[0];
  const selectedLang = targetLang === 'all' ? fallbackLang : (video.extractedContent[targetLang] ? targetLang : fallbackLang);
  const content = selectedLang ? video.extractedContent[selectedLang] : '';

  if (!content) return;

  await assertFinalExportPreflight([video], context);
  assertFinalExportSinkPreflight([video], context);

  const numStr = String((index ?? 0) + 1).padStart(2, '0');
  const safeCourse = courseSlug || 'subtitulos';
  const safeSlug = video.slug || `clase-${numStr}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

  saveAs(blob, `${safeCourse}-clase-${numStr}-${safeSlug}.${selectedLang}.txt`);
};

export const downloadMergedTxt = async (videos, targetLang, courseSlug) => {
  const context = createExportContext(videos);
  await revalidateExportPreflight(videos, context);
  assertExportPreflight(context, videos);

  for (const video of videos) {
    if (isProofRevoked(video?.authorizationProof?.proofId)) {
      const error = new Error('La prueba de autorización de esta clase fue revocada.');
      error.code = 'PROOF_REVOKED';
      throw error;
    }
    assertVideoStoreMembership(video);
  }

  const mergedText = mergeSubtitles(videos, targetLang);
  if (!mergedText) return;

  await assertFinalExportPreflight(videos, context);
  assertFinalExportSinkPreflight(videos, context);

  const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${courseSlug || 'subtitulos'}-${targetLang}.txt`);
};

export const downloadZip = async (videos, targetLang, courseSlug) => {
  const context = createExportContext(videos);
  await revalidateExportPreflight(videos, context);
  assertExportPreflight(context, videos);

  const zip = new JSZip();
  const isAllLangs = targetLang === 'all';

  videos.forEach((video, index) => {
    const numStr = String(index + 1).padStart(2, '0');

    if (video.status === 'no-video') {
      const content = `Clase ${numStr} — ${video.title}\n\n(Esta clase es de lectura y no contiene video/subtítulos)\n`;
      if (isAllLangs) {
        zip.folder('info').file(`clase-${numStr}-${video.slug}.txt`, content);
      } else {
        zip.file(`clase-${numStr}-${video.slug}.info.txt`, content);
      }
      return;
    }

    if (!video.extractedContent) return;
    
    if (isAllLangs) {
      Object.keys(video.extractedContent).forEach(lang => {
        const content = video.extractedContent[lang];
        if (content) {
          zip.folder(lang).file(`clase-${numStr}-${video.slug}.txt`, content);
        }
      });
    } else {
      const content = video.extractedContent[targetLang];
      if (content) {
        zip.file(`clase-${numStr}-${video.slug}.${targetLang}.txt`, content);
      }
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });

  await revalidateExportPreflight(videos, context);
  assertExportPreflight(context, videos);

  await assertFinalExportPreflight(videos, context);
  assertFinalExportSinkPreflight(videos, context);

  saveAs(content, `${courseSlug || 'subtitulos'}.zip`);
};
