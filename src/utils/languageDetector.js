import { useAuthStore } from '../store/authStore';
import { getPlatziPage } from './platziClient';

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[-/_.])(es|en|pt|de|fr)(?:\.vtt|[-/_.?&]|$)/i);
  return match ? match[1] : null;
};

export const detectAvailableLanguages = async (videoUrl) => {
  try {
    const sessionCookie = useAuthStore.getState().cookie;
    const res = await getPlatziPage(videoUrl, sessionCookie);
    const html = res.data;

    // Buscamos URLs completas o hashes de archivos VTT
    const rawMatches = html.match(/(?:https?:[^\s"'{}><\\]+|[a-zA-Z0-9_-]+)\.vtt/ig) || [];
    
    const langs = new Set();
    rawMatches.forEach(url => {
      const lang = inferLangFromUrl(url);
      if (lang) langs.add(lang);
    });

    const availableLangs = Array.from(langs);
    return availableLangs.length > 0 ? availableLangs : ['es'];
  } catch (error) {
    console.error("Error detecting languages via HTML", error);
    return ['es'];
  }
};
