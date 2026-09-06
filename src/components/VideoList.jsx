import { CheckCheck, ListVideo } from 'lucide-react';
import { useSubtitleStore } from '../store/subtitleStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { VideoCard } from './VideoCard';
import { useI18n } from '../i18n';

export const VideoList = () => {
  const videos = useSubtitleStore(state => state.videos);
  const courseInfo = useSubtitleStore(state => state.courseInfo);
  const { t } = useI18n();

  if (!videos || videos.length === 0) return null;

  const allSelected = videos.every(video => video.selected);

  const toggleAll = () => {
    useSubtitleStore.getState().toggleSelectAll(!allSelected);
  };

  return (
    <section className="animate-slide-up" aria-labelledby="video-list-title">
      <Card className="rounded-2xl border-primary/10 bg-card/80 p-2 sm:p-3">
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/30 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ListVideo className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="video-list-title" className="truncate text-lg font-semibold text-card-foreground">
                {courseInfo?.title || t('videoList.detectedClasses')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('videoList.classCount', { count: videos.length })}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={toggleAll}
            aria-pressed={allSelected}
            className="self-start text-primary hover:bg-primary/10 hover:text-primary sm:self-auto"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {allSelected ? t('videoList.deselectAll') : t('videoList.selectAll')}
          </Button>
        </div>

        <div role="list" className="mt-2 space-y-2">
          {videos.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} />
          ))}
        </div>
      </Card>
    </section>
  );
};
