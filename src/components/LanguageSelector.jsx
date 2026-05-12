import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { Globe } from 'lucide-react';

const FLAGS = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
  de: '🇩🇪',
  fr: '🇫🇷'
};

const NAMES = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  de: 'Deutsch',
  fr: 'Français'
};

export const LanguageSelector = () => {
  const detectedLangs = useSubtitleStore(state => state.detectedLangs);
  const isExtracting = useSubtitleStore(state => state.isExtracting);
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const setPreferredLang = useSettingsStore(state => state.setPreferredLang);

  if (!detectedLangs || detectedLangs.length === 0) return null;

  return (
    <div className="mt-4 animate-fade-in">
      <label className="text-neutral-500 text-xs uppercase tracking-wider mb-2 block">
        Idiomas disponibles
      </label>
      <div className="flex flex-wrap gap-2">
        {detectedLangs.map(lang => (
          <button
            key={lang}
            disabled={isExtracting}
            onClick={() => setPreferredLang(lang)}
            className={`transition-all duration-200 cursor-pointer ${
              preferredLang === lang
                ? 'bg-platzi-green/10 border border-platzi-green/50 text-platzi-green rounded-full px-4 py-2 text-sm font-medium'
                : 'bg-dark-700 border border-dark-600 text-neutral-400 rounded-full px-4 py-2 text-sm hover:border-dark-500 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <span className="mr-2">{FLAGS[lang] || '🏳️'}</span>
            {NAMES[lang] || lang}
          </button>
        ))}

        <button
          disabled={isExtracting}
          onClick={() => setPreferredLang('all')}
          className={`transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            preferredLang === 'all'
              ? 'bg-dark-700 border border-dashed border-platzi-green/50 text-platzi-green rounded-full px-4 py-2 text-sm font-medium'
              : 'bg-dark-700 border border-dashed border-dark-600 text-neutral-400 rounded-full px-4 py-2 text-sm hover:border-dark-500 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <Globe className="w-4 h-4" />
          Todos
        </button>
      </div>
    </div>
  );
};
