import { useState } from 'react';
import { useSubtitleStore } from '../store/subtitleStore';
import { detectAvailableLanguages } from '../utils/languageDetector';

export const useLanguageDetect = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const setDetectedLangs = useSubtitleStore(state => state.setDetectedLangs);
  const courseInfo = useSubtitleStore(state => state.courseInfo);
  const videos = useSubtitleStore(state => state.videos);
  const updateVideo = useSubtitleStore(state => state.updateVideo);

  const detectLangs = async () => {
    if (!courseInfo || videos.length === 0) return;
    
    setIsDetecting(true);
    
    try {
      // In a real scenario, we might just check the first video to get the global langs,
      // or check each video individually. Let's check the first one.
      const firstVideo = videos[0];
      const langs = await detectAvailableLanguages(courseInfo.courseSlug, firstVideo.slug);
      
      setDetectedLangs(langs);
      
      // Update all videos to say they have these langs (mock behavior)
      videos.forEach(v => {
        updateVideo(v.id, { availableLangs: langs });
      });
      
    } catch (err) {
      console.error("Error detecting languages", err);
      // Fallback
      setDetectedLangs(['es']);
    } finally {
      setIsDetecting(false);
    }
  };

  return { detectLangs, isDetecting };
};
