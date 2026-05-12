import { useState } from 'react';
import { useSubtitleStore } from '../store/subtitleStore';
import { detectAvailableLanguages } from '../utils/languageDetector';

export const useLanguageDetect = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const setDetectedLangs = useSubtitleStore(state => state.setDetectedLangs);
  const updateVideo = useSubtitleStore(state => state.updateVideo);

  const detectLangs = async () => {
    // Leer el estado actualizado directamente del store para evitar el problema de stale closure
    const { courseInfo, videos } = useSubtitleStore.getState();
    
    if (!courseInfo || videos.length === 0) return;
    
    setIsDetecting(true);
    
    try {
      const firstVideo = videos[0];
      const langs = await detectAvailableLanguages(firstVideo.url);
      
      setDetectedLangs(langs);
      
      videos.forEach(v => {
        updateVideo(v.id, { availableLangs: langs });
      });
      
    } catch (err) {
      console.error("Error detecting languages", err);
      setDetectedLangs(['es']);
    } finally {
      setIsDetecting(false);
    }
  };

  return { detectLangs, isDetecting };
};
