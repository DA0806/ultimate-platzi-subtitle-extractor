import { Globe, Languages } from 'lucide-react';
import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

const LANGUAGE_NAME_KEYS = {
  es: 'subtitles.name.es',
  en: 'subtitles.name.en',
  pt: 'subtitles.name.pt',
  de: 'subtitles.name.de',
  fr: 'subtitles.name.fr',
};

export const LanguageSelector = () => {
  const detectedLangs = useSubtitleStore(state => state.detectedLangs);
  const isExtracting = useSubtitleStore(state => state.isExtracting);
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const setPreferredLang = useSettingsStore(state => state.setPreferredLang);
  const { t } = useI18n();

  if (!detectedLangs || detectedLangs.length === 0) return null;

  return (
    <fieldset className="mt-5 animate-fade-in">
      <legend className="flex items-center gap-2 text-sm font-medium text-card-foreground">
        <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
        {t('subtitles.label')}
      </legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('subtitles.help')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {detectedLangs.map((lang, index) => (
          <Button
            key={lang}
            type="button"
            size="sm"
            variant={preferredLang === lang ? 'default' : 'outline'}
            disabled={isExtracting}
            aria-pressed={preferredLang === lang}
            onClick={() => setPreferredLang(lang)}
            className="animate-state-change"
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <span className="font-mono text-xs uppercase">{lang}</span>
            <span>{LANGUAGE_NAME_KEYS[lang] ? t(LANGUAGE_NAME_KEYS[lang]) : lang}</span>
          </Button>
        ))}

        <Button
          type="button"
          size="sm"
          variant={preferredLang === 'all' ? 'secondary' : 'outline'}
          disabled={isExtracting}
          aria-pressed={preferredLang === 'all'}
          onClick={() => setPreferredLang('all')}
          className="animate-state-change"
          style={{ animationDelay: `${detectedLangs.length * 35}ms` }}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          {t('subtitles.all')}
        </Button>
      </div>
    </fieldset>
  );
};
