import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[\/_\-.])(es|en|pt|de|fr)(?:\.vtt|[\/_\-.?&]|$)/i);
  return match ? match[1] : null;
};

export const detectAvailableLanguages = async (videoUrl) => {
  try {
    const parsedUrl = new URL(videoUrl);
    const proxyUrl = `/api/platzi${parsedUrl.pathname}`;
    const sessionCookie = useAuthStore.getState().cookie;
    
    const headers = {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    };
    if (sessionCookie) {
      headers['x-platzi-cookie'] = sessionCookie;
    }

    const res = await axios.get(proxyUrl, { headers });
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
