import { CheckCircle2, CircleDashed, Loader2, AlertCircle, Download } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useSubtitleStore } from '../store/subtitleStore';
import { downloadVideoTxt } from '../utils/downloader';

export const VideoCard = ({ video, index }) => {
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const updateVideo = useSubtitleStore(state => state.updateVideo);
  const isExtracting = useSubtitleStore(state => state.isExtracting);
  const courseInfo = useSubtitleStore(state => state.courseInfo);

  const statusConfig = {
    pending: {
      color: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
      icon: <CircleDashed className="w-4 h-4" />,
      text: 'Pendiente'
    },
    extracting: {
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-500/20',
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      text: 'Extrayendo...'
    },
    ready: {
      color: 'bg-platzi-green/20 text-platzi-green-hover dark:bg-platzi-green/10 dark:text-platzi-green border border-platzi-green/20',
      icon: <CheckCircle2 className="w-4 h-4" />,
      text: 'Listo'
    },
    'no-video': {
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-500/20',
      icon: <AlertCircle className="w-4 h-4" />,
      text: 'No es video'
    },
    error: {
      color: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-500/20',
      icon: <AlertCircle className="w-4 h-4" />,
      text: 'Error'
    }
  };

  const status = statusConfig[video.status];

  // Helper to determine if a lang badge should be shown based on selection
  const showLangBadge = (lang) => {
    if (preferredLang === 'all') return true;
    return lang === preferredLang;
  };

  const canDownloadSingle =
    video.status === 'ready' &&
    video.extractedContent &&
    Object.keys(video.extractedContent).length > 0;

  return (
    <div className={`bg-white dark:bg-dark-700 border ${video.selected ? 'border-platzi-green/40 shadow-lg shadow-platzi-green/5' : 'border-neutral-200 dark:border-dark-600'} rounded-2xl overflow-hidden hover:border-platzi-green/40 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 animate-fade-in`}>
      
      <div className="flex items-center self-start sm:self-auto mt-1 sm:mt-0">
        <input 
          type="checkbox" 
          checked={video.selected}
          disabled={isExtracting}
          onChange={(e) => updateVideo(video.id, { selected: e.target.checked })}
          className="w-5 h-5 rounded border-neutral-300 dark:border-dark-500 text-platzi-green focus:ring-platzi-green/50 dark:bg-dark-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex-grow min-w-0">
        <h3 className={`font-medium truncate ${video.selected ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`} title={video.title}>
          {video.title}
        </h3>
        <p className="text-neutral-500 text-sm mt-1">
          {video.duration}
        </p>
      </div>

      <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto ${!video.selected && 'opacity-50'}`}>
        {/* Languge badges */}
        <div className="flex gap-1.5 mr-auto sm:mr-4">
          {video.availableLangs?.filter(showLangBadge).map(lang => (
            <span key={lang} className="bg-platzi-green/10 text-platzi-green text-xs rounded-full px-2 py-0.5 border border-platzi-green/20 uppercase">
              {lang}
            </span>
          ))}
          {/* Si el preferido no está disponible (mock logic) */}
          {preferredLang !== 'all' && video.availableLangs?.length > 0 && !video.availableLangs.includes(preferredLang) && (
            <span className="bg-red-500/10 text-red-400 text-xs rounded-full px-2 py-0.5 border border-red-500/20">
              {preferredLang} (N/A)
            </span>
          )}
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${status.color}`}>
          {status.icon}
          {status.text}
        </div>

        {canDownloadSingle && (
          <button
            onClick={() => downloadVideoTxt(video, preferredLang, courseInfo?.courseSlug, index)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-dark-800 dark:text-neutral-200 dark:hover:bg-dark-600 transition-colors"
            title="Descargar esta clase"
          >
            <Download className="w-4 h-4" />
            Clase TXT
          </button>
        )}
      </div>
    </div>
  );
};
