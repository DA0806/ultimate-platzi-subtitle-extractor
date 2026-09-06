import { useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { useCourseParser } from '../hooks/useCourseParser';
import { useLanguageDetect } from '../hooks/useLanguageDetect';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { translateCourseError, useI18n } from '../i18n';

export const UrlInput = ({ onLoadingChange }) => {
  const [url, setUrl] = useState('');
  const { parseUrl, isParsing, error } = useCourseParser();
  const { detectLangs, isDetecting } = useLanguageDetect();
  const { language, t } = useI18n();
  const isLoading = isParsing || isDetecting;
  const errorMessage = error ? translateCourseError(error, language) : '';

  const handleSubmit = async event => {
    event.preventDefault();
    if (!url.trim() || isLoading) return;

    onLoadingChange?.(true);

    try {
      await parseUrl(url);
      await detectLangs();
    } catch (err) {
      console.error(err);
    } finally {
      onLoadingChange?.(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" aria-busy={isLoading}>
      <label htmlFor="course-url" className="text-sm font-medium text-card-foreground">{t('url.label')}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="course-url"
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://platzi.com/cursos/..."
            disabled={isLoading}
            invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'course-url-help course-url-error' : 'course-url-help'}
            className="pl-10"
            required
          />
        </div>
        <Button type="submit" disabled={isLoading || !url.trim()} loading={isLoading} className="sm:min-w-36">
          <span
            key={isParsing ? 'parsing' : isDetecting ? 'detecting' : 'idle'}
            className="animate-state-change"
          >
            {isParsing ? t('url.analyzing') : isDetecting ? t('url.detecting') : t('url.analyze')}
          </span>
        </Button>
      </div>
      <p id="course-url-help" className="mt-2 text-xs leading-5 text-muted-foreground">
        {t('url.help')}
      </p>
      {errorMessage && (
        <p id="course-url-error" role="alert" className="mt-2 flex items-start gap-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      )}
    </form>
  );
};
