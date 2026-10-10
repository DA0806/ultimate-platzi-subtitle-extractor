import { getPlatziPage } from './platziClient.js';
import { inspectClassIdentityDocument } from './platziAccess.js';

const EXCLUDED_CLASS_SLUGS = new Set([
  'opiniones',
  'opinion',
  'discusiones',
  'comunidad',
  'comentarios',
]);

const normalizePlatziPath = (href) => {
  if (!href) return null;
  try {
    const url = new URL(href, 'https://platzi.com');
    return url.pathname.replace(/\/+$/, '/') || '/';
  } catch {
    return null;
  }
};

export const normalizeClassTitle = (title) =>
  String(title || '').trim().replace(/^(\d{1,3})(?=\p{L})/u, '$1. ');

export const parsePlatziUrl = async (url) => {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

    if (pathParts[0] !== 'cursos' && pathParts[0] !== 'clases') {
      throw new Error('URL no reconocida como curso de Platzi');
    }

    const courseSlug = pathParts[1];
    const isSingleVideo = pathParts.length > 2;

    const response = await getPlatziPage(url);
    const html = response.data;

    // Utilizar DOMParser para analizar el HTML estático de Platzi
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let title = `Curso de ${courseSlug.replace(/-/g, ' ')}`;
    const h1Element = doc.querySelector('h1');
    if (h1Element && h1Element.textContent) {
      title = h1Element.textContent.trim();
    }

    let videos = [];

    // Buscar elementos del temario por su clase o etiqueta
    // Platzi suele usar <a> dentro de <li> con ids como syllabus-material-XXXX
    let syllabusLinks = Array.from(doc.querySelectorAll('li[id^="syllabus-material-"] a[href*="/cursos/"]'));

    // Fallback por si cambia la estructura
    if (syllabusLinks.length === 0) {
      syllabusLinks = Array.from(doc.querySelectorAll('a[href*="/cursos/"]'));
    }

    const uniqueLinks = new Set();

    syllabusLinks.forEach((a) => {
      const href = a.getAttribute('href');
      const normalizedPath = normalizePlatziPath(href);
      if (!normalizedPath) return;

      const parts = normalizedPath.split('/').filter(Boolean);
      // Formato valido para clase: /cursos/{courseSlug}/{classSlug}/
      if (parts.length !== 3 || parts[0] !== 'cursos' || parts[1] !== courseSlug) return;

      const slug = parts[2];
      if (!slug || EXCLUDED_CLASS_SLUGS.has(slug)) return;

      if (uniqueLinks.has(normalizedPath)) return;

      // Extraer título
      let classTitle = `Clase ${uniqueLinks.size + 1}`;
      const h3 = a.querySelector('h3');
      if (h3 && h3.textContent) {
        classTitle = normalizeClassTitle(h3.textContent);
      } else if (a.textContent) {
        classTitle = normalizeClassTitle(a.textContent);
        // Limpiar si capturó la duración dentro del texto del <a>
        classTitle = classTitle.replace(/\d{2}:\d{2}\s*min/g, '').trim();
      }

      // Evita colar enlaces de opiniones por texto visible
      if (/\bopiniones?\b/i.test(classTitle)) return;

      // Extraer duración si existe
      let durationStr = '00:00';
      const durationSpan = Array.from(a.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('min'));
      if (durationSpan) {
        durationStr = durationSpan.textContent.replace('min', '').trim();
      }

      uniqueLinks.add(normalizedPath);

      videos.push({
        id: `vid-${uniqueLinks.size}`,
        slug: slug,
        title: classTitle,
        duration: durationStr,
        url: `https://platzi.com${normalizedPath}`,
        status: 'pending',
        selected: true, // Seleccionado por defecto para descargar
        availableLangs: [],
        extractedContent: {}
      });
    });

    // Si es un video individual y no extrajo nada, intentar meterlo a mano
    if (videos.length === 0 && isSingleVideo) {
      const identity = inspectClassIdentityDocument(doc, url);
      const singleTitle = identity?.title || title || `Clase: ${pathParts[2].replace(/-/g, ' ')}`;
      videos = [{
        id: `vid-single`,
        slug: identity?.classSlug || pathParts[2],
        title: singleTitle,
        duration: '00:00',
        url: identity?.canonicalUrl || url,
        status: 'pending',
        selected: true,
        availableLangs: [],
        extractedContent: {}
      }];
    }

    if (videos.length === 0) {
      // Intentar buscar el error de firewall (Cloudflare)
      if (html.includes('Cloudflare') || html.includes('firewall')) {
        throw new Error('Bloqueado por el firewall de Platzi. Verifica la conexión con Platzi.');
      }
      throw new Error('No se encontraron clases en la página. Es posible que el curso esté bloqueado o la estructura de la página haya cambiado.');
    }

    return {
      courseSlug,
      title,
      videos
    };

  } catch (err) {
    console.error(err);
    const status = err.response?.status || err.status;
    if (status) {
      if (status === 404) {
        throw new Error('Curso no encontrado o no accesible (Error 404). Verifica la URL o el acceso de tu cuenta en Platzi.', { cause: err });
      }
      if (status === 401 || status === 403) {
        throw new Error(`Acceso no autorizado (Error ${status}). Abre platzi.com para comprobar tu sesión y vuelve a intentarlo.`, { cause: err });
      }
      throw new Error(`Error ${status} al consultar Platzi.`, { cause: err });
    }
    throw new Error(err.message || 'URL inválida o error procesando el curso.', { cause: err });
  }
};
