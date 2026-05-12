import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { mergeSubtitles } from './textMerger';

export const downloadVideoTxt = (video, targetLang, courseSlug, index) => {
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

export const downloadMergedTxt = (videos, targetLang, courseSlug) => {
  const mergedText = mergeSubtitles(videos, targetLang);
  if (!mergedText) return;

  const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${courseSlug || 'subtitulos'}-${targetLang}.txt`);
};

export const downloadZip = async (videos, targetLang, courseSlug) => {
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
  saveAs(content, `${courseSlug || 'subtitulos'}.zip`);
};
