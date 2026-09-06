import { AlertTriangle, Loader2 } from 'lucide-react';
import { Progress } from './ui/Progress';
import { useSubtitleStore } from '../store/subtitleStore';
import { useI18n } from '../i18n';

export const ProgressBar = () => {
  const { progress, isExtracting, extractionNotice, videos } = useSubtitleStore();
  const { t } = useI18n();

  if (videos.length === 0 || (!isExtracting && !extractionNotice)) return null;

  const processed = videos.filter(video => !['pending', 'extracting'].includes(video.status)).length;
  const hasNotice = Boolean(extractionNotice);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <section
        className="pointer-events-auto mx-auto max-w-6xl animate-slide-up overflow-hidden rounded-xl border border-border/90 bg-card/95 shadow-[0_-18px_50px_-30px_hsl(var(--black)/0.8)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-state ease-motion"
        aria-label={t('progress.label')}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${hasNotice ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                {hasNotice ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-card-foreground">
                  {hasNotice ? t('progress.paused') : t('progress.analyzing')}
                </p>
                {!hasNotice && (
                  <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                    {t('progress.processing', { processed, total: videos.length })}
                  </p>
                )}
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-primary">
              {Math.round(progress)}%
            </span>
          </div>

          <Progress
            value={progress}
            aria-label={t('progress.label')}
            className="mt-4 h-2.5 bg-muted/80"
          />

          {hasNotice && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <p>{extractionNotice}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
