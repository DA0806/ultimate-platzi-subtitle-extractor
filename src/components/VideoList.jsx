import { useSubtitleStore } from '../store/subtitleStore';
import { VideoCard } from './VideoCard';

export const VideoList = () => {
  const videos = useSubtitleStore(state => state.videos);
  const courseInfo = useSubtitleStore(state => state.courseInfo);

  if (!videos || videos.length === 0) return null;

  return (
    <div className="mt-8 animate-slide-up">
      {courseInfo && (
        <div className="mb-6 pb-4 border-b border-neutral-200 dark:border-dark-600 flex justify-between items-end">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              {courseInfo.title}
            </h2>
            <p className="text-neutral-500 text-sm mt-1">
              {videos.length} clases detectadas
            </p>
          </div>
          <button
            onClick={() => {
              const allSelected = videos.every(v => v.selected);
              useSubtitleStore.getState().toggleSelectAll(!allSelected);
            }}
            className="text-sm text-platzi-green hover:text-platzi-green-hover transition-colors"
          >
            {videos.every(v => v.selected) ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        </div>
      )}
      
      <div className="flex flex-col gap-3">
        {videos.map((video, index) => (
          <VideoCard key={video.id} video={video} index={index} />
        ))}
      </div>
    </div>
  );
};
