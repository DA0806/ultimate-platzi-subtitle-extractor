import { AlertCircle, CheckCircle2, CircleDashed, Download, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useSubtitleStore } from '../store/subtitleStore';
import { downloadVideoTxt } from '../utils/downloader';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

export const VideoCard = ({ video, index }) => {
  const preferredLang = useSettingsStore(state => state.preferredLang);
  const updateVideo = useSubtitleStore(state => state.updateVideo);
  const isExtracting = useSubtitleStore(state => state.isExtracting);
  const courseInfo = useSubtitleStore(state => state.courseInfo);
  const { t } = useI18n();

  const statusConfig = {
    pending: {
      variant: 'muted',
      icon: <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />,
      text: t('video.status.pending'),
    },
    extracting: {
      variant: 'warning',
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin-slow" aria-hidden="true" />,
      text: t('video.status.extracting'),
    },
    ready: {
      variant: 'success',
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      text: t('video.status.ready'),
    },
    'no-video': {
      variant: 'default',
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      text: t('video.status.noVideo'),
    },
    error: {
      variant: 'destructive',
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      text: t('video.status.error'),
    },
  };

  const status = statusConfig[video.status] || statusConfig.pending;
  const statusBorder = {
    pending: 'border-l-border',
    extracting: 'border-l-warning',
    ready: 'border-l-success',
    'no-video': 'border-l-primary',
    error: 'border-l-destructive',
  }[video.status] || 'border-l-border';
  const shouldStagger = index < 6;
  const showLangBadge = lang => preferredLang === 'all' || lang === preferredLang;
  const canDownloadSingle =
    video.status === 'ready' &&
    video.extractedContent &&
    Object.keys(video.extractedContent).length > 0;

  return (
    <article
      role="listitem"
      style={shouldStagger ? { animationDelay: `${index * 45}ms` } : undefined}
      className={
        'flex flex-col gap-3 rounded-lg border border-border/70 border-l-2 p-4 transition-[background-color,border-color,box-shadow,opacity,transform] duration-state ease-motion hover:-translate-y-px hover:border-primary/20 hover:shadow-[0_10px_28px_-22px_hsl(var(--black)/0.75)] sm:flex-row sm:items-center sm:gap-4 sm:p-5 ' +
        (shouldStagger ? 'animate-result-reveal ' : '') +
        statusBorder + ' ' +
        (video.selected ? 'bg-primary/[0.04]' : 'bg-card')
      }
    >
      <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent/30">
        <input
          type="checkbox"
          checked={Boolean(video.selected)}
          disabled={isExtracting}
          onChange={event => updateVideo(video.id, { selected: event.target.checked })}
          aria-label={t('video.selectClass', { title: video.title })}
          className="h-5 w-5 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <div className="min-w-0 flex-1">
        <h3
          className={video.selected ? 'break-words font-medium text-card-foreground' : 'break-words font-medium text-muted-foreground'}
          title={video.title}
        >
          {video.title}
        </h3>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{video.duration}</p>
      </div>

      <div className={video.selected ? 'flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end' : 'flex w-full flex-wrap items-center gap-2 opacity-60 sm:w-auto sm:justify-end'}>
        <div className="flex flex-wrap items-center gap-1.5 sm:mr-2">
          {video.availableLangs?.filter(showLangBadge).map(lang => (
            <Badge key={lang} variant="default" className="font-mono uppercase">
              {lang}
            </Badge>
          ))}
          {preferredLang !== 'all' && video.availableLangs?.length > 0 && !video.availableLangs.includes(preferredLang) && (
            <Badge variant="destructive" className="font-mono uppercase">
              {preferredLang} N/A
            </Badge>
          )}
        </div>

        <Badge key={video.status} variant={status.variant} className="animate-status-enter">
          {status.icon}
          {status.text}
        </Badge>

        {canDownloadSingle && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => downloadVideoTxt(video, preferredLang, courseInfo?.courseSlug, index)}
            aria-label={t('video.downloadAria', { title: video.title })}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('video.classTxt')}</span>
            <span className="sm:hidden">TXT</span>
          </Button>
        )}
      </div>
    </article>
  );
};
