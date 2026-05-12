import axios from 'axios';

const POSSIBLE_LANGS = ['es', 'en', 'pt', 'de', 'fr'];

export const detectAvailableLanguages = async (courseSlug, videoSlug) => {
  const availableLangs = [];
  
  // Hacemos peticiones HEAD a través del proxy local
  // URL base: /api/static/media/assets/[courseSlug]/[videoSlug]/[lang].vtt
  
  const checkLang = async (lang) => {
    try {
      const url = `/api/static/media/assets/${courseSlug}/${videoSlug}/${lang}.vtt`;
      const res = await axios.head(url);
      if (res.status === 200) {
        availableLangs.push(lang);
      }
    } catch (error) {
      // Ignorar 404
    }
  };

  // Ejecutamos todas las peticiones concurrentemente
  await Promise.all(POSSIBLE_LANGS.map(checkLang));

  // Fallback si por alguna razón la URL no es accesible y todo devuelve 404/error,
  // asumimos que al menos hay español disponible.
  return availableLangs.length > 0 ? availableLangs : ['es'];
};
