import { useState } from 'react';
import { Archive, CheckCircle2, Copy, Download } from 'lucide-react';
import { useSubtitleStore } from '../store/subtitleStore';
import { useSettingsStore } from '../store/settingsStore';
import { downloadMergedTxt, downloadZip } from '../utils/downloader';
import { mergeSubtitles } from '../utils/textMerger';
import { Button } from './ui/Button';
import { Progress } from './ui/Progress';
import { useI18n } from '../i18n';

export const ExportPanel = () => {
  const { videos, isExtracting, extractionNotice, progress, courseInfo } = useSubtitleStore();
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const exportableVideos = videos.filter(
    video =>
      video.selected &&
      ((video.status === 'ready' &&
        video.extractedContent &&
        Object.keys(video.extractedContent).length > 0) ||
        video.status === 'no-video')
  );
  const selectedVideos = videos.filter(video => video.selected);
  const processedVideos = selectedVideos.filter(video => (
    ['ready', 'error', 'no-video'].includes(video.status)
  )).length;

  if (videos.length === 0 || exportableVideos.length === 0 || isExtracting || extractionNotice) return null;

  const handleCopy = () => {
    const text = mergeSubtitles(exportableVideos, preferredLang === 'all' ? 'es' : preferredLang);
    navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    downloadMergedTxt(exportableVideos, preferredLang === 'all' ? 'es' : preferredLang, courseInfo?.courseSlug);
  };

  const handleDownloadZip = () => {
    downloadZip(exportableVideos, preferredLang, courseInfo?.courseSlug);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <section
        className="pointer-events-auto mx-auto max-w-6xl animate-result-reveal overflow-hidden rounded-xl border border-primary/25 bg-card/95 shadow-[0_-18px_50px_-30px_hsl(var(--black)/0.8)] backdrop-blur-xl"
        aria-label={t('export.label')}
      >
        <div className="border-b border-border/80 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-card-foreground" role="status" aria-live="polite">
                  {t('export.completed')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('export.processed', { processed: processedVideos, total: selectedVideos.length })}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-success">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            aria-label={t('progress.completedLabel')}
            className="mt-4 h-2.5 bg-muted/80"
          />
        </div>

        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <p className="text-sm font-medium text-foreground">{t('export.how')}</p>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button type="button" variant="secondary" onClick={handleCopy} className="min-w-0 flex-1 sm:flex-none">
              {copied ? (
                <CheckCircle2 key="copied" className="h-4 w-4 animate-state-change text-success" aria-hidden="true" />
              ) : (
                <Copy key="copy" className="h-4 w-4 animate-state-change" aria-hidden="true" />
              )}
              {copied ? t('export.copied') : t('export.copy')}
            </Button>
            <Button type="button" variant="secondary" onClick={handleDownloadTxt} className="min-w-0 flex-1 sm:flex-none">
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('export.downloadTxt')}
            </Button>
            <Button type="button" onClick={handleDownloadZip} className="min-w-0 flex-1 sm:flex-none">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {t('export.downloadZip')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
