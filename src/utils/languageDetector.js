import { getPlatziPage } from './platziClient.js';
import { assertPlatziFreeClass } from './platziAccess.js';

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[-/_.])(es|en|pt|de|fr)(?:\.vtt|[-/_.?&]|$)/i);
  return match ? match[1] : null;
};

export const detectAvailableLanguages = async (videoUrl) => {
  try {
    const res = await getPlatziPage(videoUrl);
    const html = res.data;
    const accessProof = assertPlatziFreeClass(html, videoUrl);

    const langs = new Set();
    const urls = accessProof.authorizedVttUrls || accessProof.vttUrls || [];
    urls.forEach(url => {
      const lang = inferLangFromUrl(url);
      if (lang) langs.add(lang);
    });

    const availableLangs = Array.from(langs);
    return availableLangs.length > 0 ? availableLangs : ['es'];
  } catch (error) {
    console.error('Error detecting languages via HTML', error);
    if (error?.code === 'PLATZI_ACCESS_UNVERIFIED') throw error;
    return ['es'];
  }
};
