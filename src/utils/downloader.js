import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { mergeSubtitles } from './textMerger.js';
import { useAuthStore } from '../store/authStore.js';
import { assertAuthorizedExportProof } from './platziAccess.js';
import { defaultAuthorizationService } from './authorizationService.js';

const saveAs = fileSaver?.saveAs || fileSaver;

export const assertExportPreflight = () => {
  const sessionStatus = useAuthStore?.getState?.()?.sessionStatus;
  if (sessionStatus !== 'authenticated') {
    const error = new Error('No se puede exportar: la sesión de Platzi ha sido invalidada. Abre platzi.com y vuelve a verificar.');
    error.code = sessionStatus === 'session_invalid'
      ? 'SESSION_INVALIDATED_CANNOT_EXPORT'
      : 'AUTHORIZATION_RECHECK_REQUIRED';
    throw error;
  }
};

const revalidateExportPreflight = async (videos = []) => {
  assertExportPreflight();
  const currentEpoch = useAuthStore.getState().sessionEpoch;
  for (const video of videos) {
    const proof = video?.authorizationProof;
    if (!proof) {
      const error = new Error('La autorización de esta clase no está disponible o debe verificarse de nuevo.');
      error.code = 'AUTHORIZATION_RECHECK_REQUIRED';
      throw error;
    }
    if (proof.authorizedVttUrls?.[0]) {
      assertAuthorizedExportProof(proof, proof.authorizedVttUrls[0], { currentSessionEpoch: currentEpoch });
    } else if (proof.capabilities?.verified !== true) {
      const error = new Error('La autorización de esta clase no está verificada.');
      error.code = 'AUTHORIZATION_RECHECK_REQUIRED';
      throw error;
    }
    const identity = proof.identity || {
      courseId: proof.courseId,
      classId: proof.classId,
      canonicalUrl: proof.canonicalUrl,
    };
    const decision = await defaultAuthorizationService.recheck(identity);
    if (!decision.verified || decision.accountId !== proof.sessionAccount || decision.sessionEpoch !== currentEpoch) {
      const error = new Error('La autorización de exportación ya no es válida.');
      error.code = 'AUTHORIZATION_RECHECK_FAILED';
      throw error;
    }
  }
};

export const downloadVideoTxt = async (video, targetLang, courseSlug, index) => {
  await revalidateExportPreflight([video]);
  if (!video?.extractedContent) return;

  const fallbackLang = Object.keys(video.extractedContent)[0];
  const selectedLang = targetLang === 'all' ? fallbackLang : (video.extractedContent[targetLang] ? targetLang : fallbackLang);
  const content = selectedLang ? video.extractedContent[selectedLang] : '';

  if (!content) return;

  const numStr = String((index ?? 0) + 1).padStart(2, '0');
  const safeCourse = courseSlug || 'subtitulos';
  const safeSlug = video.slug || `clase-${numStr}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

  saveAs(blob, `${safeCourse}-clase-${numStr}-${safeSlug}.${selectedLang}.txt`);
};

export const downloadMergedTxt = async (videos, targetLang, courseSlug) => {
  await revalidateExportPreflight(videos);
  const mergedText = mergeSubtitles(videos, targetLang);
  if (!mergedText) return;

  const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${courseSlug || 'subtitulos'}-${targetLang}.txt`);
};

export const downloadZip = async (videos, targetLang, courseSlug) => {
  await revalidateExportPreflight(videos);
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
      // Create subfolders for each language
      Object.keys(video.extractedContent).forEach(lang => {
        const content = video.extractedContent[lang];
        if (content) {
          zip.folder(lang).file(`clase-${numStr}-${video.slug}.txt`, content);
        }
      });
    } else {
      // Just the target language
      const content = video.extractedContent[targetLang];
      if (content) {
        zip.file(`clase-${numStr}-${video.slug}.${targetLang}.txt`, content);
      }
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  await revalidateExportPreflight(videos);
  saveAs(content, `${courseSlug || 'subtitulos'}.zip`);
};
