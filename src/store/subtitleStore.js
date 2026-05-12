import { create } from 'zustand';

export const useSubtitleStore = create((set, get) => ({
  videos: [], // { id, slug, title, duration, url, status: 'pending'|'extracting'|'ready'|'error', selected: boolean, availableLangs: [], extractedContent: {} }
  isExtracting: false,
  progress: 0,
  detectedLangs: [], // ['es', 'en', ...] available for the current context
  courseInfo: null, // { title, slug }

  setVideos: (videos) => set({ videos }),
  setCourseInfo: (info) => set({ courseInfo: info }),
  setDetectedLangs: (langs) => set({ detectedLangs: langs }),
  
  updateVideo: (id, updates) => set((state) => ({
    videos: state.videos.map(v => v.id === id ? { ...v, ...updates } : v)
  })),

  toggleSelectAll: (selected) => set((state) => ({
    videos: state.videos.map(v => ({ ...v, selected }))
  })),

  startExtraction: () => set({ isExtracting: true, progress: 0 }),
  
  updateProgress: () => set((state) => {
    const selectedVideos = state.videos.filter(v => v.selected);
    const total = selectedVideos.length;
    if (total === 0) return { progress: 0, isExtracting: false };
    
    const completed = selectedVideos.filter(v => v.status === 'ready' || v.status === 'error').length;
    const progress = Math.round((completed / total) * 100);
    return { progress, isExtracting: progress < 100 };
  }),

  stopExtraction: () => set({ isExtracting: false }),
  
  reset: () => set({
    videos: [],
    isExtracting: false,
    progress: 0,
    detectedLangs: [],
    courseInfo: null
  })
}));
