import { useEffect } from 'react';
import { useSettingsStore } from './store/settingsStore';
import { useSubtitleStore } from './store/subtitleStore';
import { useSubtitleExtractor } from './hooks/useSubtitleExtractor';
import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { LanguageSelector } from './components/LanguageSelector';
import { VideoList } from './components/VideoList';
import { ProgressBar } from './components/ProgressBar';
import { ExportPanel } from './components/ExportPanel';
import { Play } from 'lucide-react';

function App() {
  const theme = useSettingsStore(state => state.theme);
  const { videos, isExtracting } = useSubtitleStore();
  const { extractSubtitles } = useSubtitleExtractor();

  // Apply dark mode class to html element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen pb-24 transition-colors duration-200">
      <Header />
      <ProgressBar />
      
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight mb-4">
            Extrae subtítulos de <span className="text-platzi-green">cualquier clase</span>
          </h2>
          <p className="text-neutral-500 max-w-xl mx-auto mt-2">
            Pega la URL de un curso o una clase individual de Platzi para descargar los subtítulos en formato texto o VTT, y organizarlos automáticamente.
          </p>
          <div className="mt-4 inline-block bg-yellow-500/10 text-yellow-500 text-xs px-3 py-1.5 rounded-full border border-yellow-500/20">
            ⚠️ Debes ejecutar esta app localmente para que el proxy funcione.
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-600 p-6 sm:p-8 mb-8 animate-slide-up">
          <UrlInput />
          <LanguageSelector />
          
          {videos.length > 0 && (
            <div className="mt-6 flex justify-end animate-fade-in">
              <button
                onClick={extractSubtitles}
                disabled={isExtracting || videos.filter(v => v.selected).length === 0 || videos.filter(v => v.selected).every(v => v.status === 'ready' || v.status === 'error')}
                className="bg-platzi-green hover:bg-platzi-green-hover text-black font-semibold rounded-xl px-6 py-3 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                {isExtracting ? 'Procesando...' : 'Iniciar Extracción'}
              </button>
            </div>
          )}
        </div>

        <VideoList />
      </main>

      <ExportPanel />
    </div>
  );
}

export default App;
