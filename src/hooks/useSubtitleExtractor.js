import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { parseVtt } from '../utils/vttParser';

const SUPPORTED_LANGS = ['es', 'en', 'pt', 'de', 'fr'];

const inferLangFromUrl = (url) => {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:^|[\/_\-.])(es|en|pt|de|fr)(?:\.vtt|[\/_\-.?&]|$)/i);
  return match ? match[1] : null;
};

const extractVttUrls = (html) => {
  // Buscamos cualquier URL que termine en .vtt, ignorando comillas, espacios y llaves JSON.
  const rawMatches = html.match(/https?:[^\s"'{}><]+\.vtt/g) || [];
  
  // Limpiamos las URLs escapadas de JSON (ej: https:\/\/... o variables unicode \u0026)
  const cleanedUrls = rawMatches.map(url => 
    url
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/\\u003d/g, '=')
  );
  
  return Array.from(new Set(cleanedUrls));
};

const fetchTextWithRetry = async (url, config, retries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

export const useSubtitleExtractor = () => {
  const { videos, updateVideo, startExtraction, stopExtraction, updateProgress, isExtracting, courseInfo } = useSubtitleStore();
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const sessionCookie = useAuthStore(state => state.cookie);

  const extractSubtitles = async () => {
    if (videos.length === 0 || isExtracting || !courseInfo) return;
    
    startExtraction();

    const pendingVideos = videos.filter(v => v.selected && (v.status === 'pending' || v.status === 'error'));
    
    // Concurrency (reducida a 2 para no saturar al servidor al pedir el HTML de cada página)
    const CONCURRENCY = 2;
    let index = 0;

    const worker = async () => {
      while (index < pendingVideos.length) {
        const video = pendingVideos[index++];
        
        updateVideo(video.id, { status: 'extracting' });
        
        try {
          // 1. Obtener el HTML de la página de la clase a través del proxy para no tener CORS
          const proxyUrl = `/api/platzi/cursos/${courseInfo.courseSlug}/${video.slug}/`;
          const headers = {};
          if (sessionCookie) {
            headers['x-platzi-cookie'] = sessionCookie;
          }

          const res = await axios.get(proxyUrl, { headers });
          const html = res.data;

          // 2. Extraer URLs VTT, incluyendo variantes escapadas en scripts JSON
          const uniqueVttUrls = extractVttUrls(html);

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

                const vttData = await fetchTextWithRetry(proxyVttUrl, {
                  headers: proxyHeaders,
                  responseType: 'text',
                  transformResponse: [(data) => data],
                }, 2);
                const cleanText = parseVtt(vttData);

                if (cleanText) {
                  extractedContent[lang] = cleanText;
                  hasSuccess = true;
                }
              } catch (err) {
                console.error(`Error descargando VTT desde ${vttUrl}`, err);
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
