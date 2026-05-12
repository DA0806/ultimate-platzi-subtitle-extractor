import { Download, Archive, Copy, CheckCircle2 } from 'lucide-react';
import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { downloadMergedTxt, downloadZip } from '../utils/downloader';
import { mergeSubtitles } from '../utils/textMerger';
import { useState } from 'react';

export const ExportPanel = () => {
  const { videos, isExtracting, courseInfo } = useSubtitleStore();
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const [copied, setCopied] = useState(false);

  const exportableVideos = videos.filter(
    (v) => v.selected && (
      (v.status === 'ready' && v.extractedContent && Object.keys(v.extractedContent).length > 0) ||
      (v.status === 'no-video')
    )
  );

  // Solo mostrar el panel si hay videos y no se está extrayendo (o al menos un video ya está listo)
  if (videos.length === 0 || exportableVideos.length === 0 || isExtracting) return null;

  const handleCopy = () => {
    const text = mergeSubtitles(exportableVideos, preferredLang === 'all' ? 'es' : preferredLang);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    downloadMergedTxt(exportableVideos, preferredLang === 'all' ? 'es' : preferredLang, courseInfo?.courseSlug);
  };

  const handleDownloadZip = () => {
    downloadZip(exportableVideos, preferredLang, courseInfo?.courseSlug);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border-t border-neutral-200 dark:border-dark-600 p-4 animate-slide-up shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Extracción completada. ¿Cómo deseas exportar?
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={handleCopy}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-platzi-green" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar TXT'}
          </button>
          
          <button 
            onClick={handleDownloadTxt}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar TXT
          </button>

          <button 
            onClick={handleDownloadZip}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-platzi-green hover:bg-platzi-green-hover text-black text-sm font-semibold transition-colors"
          >
            <Archive className="w-4 h-4" />
            Descargar ZIP
          </button>
        </div>

      </div>
    </div>
  );
};
