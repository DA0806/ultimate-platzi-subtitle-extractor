import { useState } from 'react';
import { useSubtitleStore } from '../store/subtitleStore';
import { parsePlatziUrl } from '../utils/courseParser';

export const useCourseParser = () => {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);
  
  const setVideos = useSubtitleStore(state => state.setVideos);
  const setCourseInfo = useSubtitleStore(state => state.setCourseInfo);
  const resetStore = useSubtitleStore(state => state.reset);

  const parseUrl = async (url) => {
    if (!url) return;
    
    setIsParsing(true);
    setError(null);
    resetStore();

    try {
      const data = await parsePlatziUrl(url);
      setCourseInfo({ title: data.title, courseSlug: data.courseSlug });
      setVideos(data.videos);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsParsing(false);
    }
  };

  return { parseUrl, isParsing, error };
};
