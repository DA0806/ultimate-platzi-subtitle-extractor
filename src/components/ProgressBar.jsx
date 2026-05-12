import { useSubtitleStore } from '../store/subtitleStore';

export const ProgressBar = () => {
  const { progress, isExtracting, videos } = useSubtitleStore();

  if (videos.length === 0 || (!isExtracting && progress === 0)) return null;

  return (
    <div className="fixed top-[64px] left-0 right-0 z-40">
      <div className="w-full bg-neutral-200 dark:bg-dark-700 h-1.5 relative overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-platzi-green rounded-r-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Glow effect */}
        <div 
          className="absolute top-0 left-0 h-full bg-platzi-green/50 blur-[2px] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
