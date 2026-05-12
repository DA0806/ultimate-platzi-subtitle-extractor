import { useState } from 'react';
import { useCourseParser } from '../hooks/useCourseParser';
import { useLanguageDetect } from '../hooks/useLanguageDetect';
import { Search, Loader2 } from 'lucide-react';

export const UrlInput = () => {
  const [url, setUrl] = useState('');
  const { parseUrl, isParsing, error } = useCourseParser();
  const { detectLangs } = useLanguageDetect();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      await parseUrl(url);
      await detectLangs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-neutral-500">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://platzi.com/cursos/..."
          className="w-full bg-white dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-xl pl-12 pr-32 py-4 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-platzi-green/50 focus:border-platzi-green transition-all duration-200 shadow-sm"
          disabled={isParsing}
        />
        <button
          type="submit"
          disabled={isParsing || !url.trim()}
          className="absolute right-2 top-2 bottom-2 bg-platzi-green hover:bg-platzi-green-hover text-black font-semibold rounded-lg px-6 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
        >
          {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Extraer'}
        </button>
      </form>
      {error && (
        <p className="text-red-500 text-sm mt-2 flex items-center gap-1 animate-fade-in">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {error}
        </p>
      )}
    </div>
  );
};
