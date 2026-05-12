export const mergeSubtitles = (videos, targetLang) => {
  let mergedText = '';

  videos.forEach((video, index) => {
    // Si la clase no tiene video (ej. texto/lectura), agregamos el encabezado y un placeholder
    if (video.status === 'no-video') {
      const divider = '════════════════════════════════════\n';
      const header = `Clase ${String(index + 1).padStart(2, '0')} — ${video.title} [INFO]\n`;
      mergedText += `${divider}${header}${divider}\n(Esta clase es de lectura y no contiene video/subtítulos)\n\n\n`;
      return;
    }

    // Only include if we have extracted content
    if (!video.extractedContent || Object.keys(video.extractedContent).length === 0) return;

    // Use targetLang, or fallback to the first available, or empty string
    let content = video.extractedContent[targetLang];
    let langUsed = targetLang;
    
    if (!content) {
      // Fallback
      const fallbackLang = Object.keys(video.extractedContent)[0];
      if (fallbackLang) {
        content = video.extractedContent[fallbackLang];
        langUsed = fallbackLang;
      }
    }

    if (!content) return;

    const divider = '════════════════════════════════════\n';
    const header = `Clase ${String(index + 1).padStart(2, '0')} — ${video.title} [${String(langUsed || targetLang).toUpperCase()}]\n`;
    
    mergedText += `${divider}${header}${divider}\n${content}\n\n\n`;
  });

  return mergedText;
};
