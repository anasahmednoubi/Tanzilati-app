import React, { useState } from 'react';
import { Link2, Clipboard, X, Search, Sparkles, Youtube, Video, Music } from 'lucide-react';
import { VideoMetadata } from '../types';
import { PRESET_VIDEOS } from '../data/mockVideos';

interface UrlInputSectionProps {
  url: string;
  onChangeUrl: (val: string) => void;
  onFetchMetadata: (url: string) => void;
  isLoading: boolean;
  onSelectPreset: (video: VideoMetadata) => void;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  url,
  onChangeUrl,
  onFetchMetadata,
  isLoading,
  onSelectPreset,
}) => {
  const [pasteNotice, setPasteNotice] = useState(false);

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          onChangeUrl(text);
          onFetchMetadata(text);
          setPasteNotice(true);
          setTimeout(() => setPasteNotice(false), 2000);
          return;
        }
      }
    } catch {
      // Clipboard permissions denied or fallback
    }
    // Fallback: load the primary requested video link
    onChangeUrl(PRESET_VIDEOS[0].url);
    onFetchMetadata(PRESET_VIDEOS[0].url);
    setPasteNotice(true);
    setTimeout(() => setPasteNotice(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && url.trim()) {
      onFetchMetadata(url);
    }
  };

  // Detect platform
  const getPlatformIcon = () => {
    const lower = url.toLowerCase();
    if (lower.includes('youtube') || lower.includes('youtu.be')) {
      return <Youtube className="w-5 h-5 text-red-500" />;
    }
    if (lower.includes('vimeo')) {
      return <Video className="w-5 h-5 text-sky-400" />;
    }
    if (lower.includes('sound') || lower.includes('audio')) {
      return <Music className="w-5 h-5 text-amber-500" />;
    }
    return <Link2 className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="video-url" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          رابط الفيديو
        </label>
        {pasteNotice && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium transition-opacity">
            تم لصق الرابط بنجاح
          </span>
        )}
      </div>

      <div className="relative flex items-center shadow-sm">
        <div className="absolute right-3.5 flex items-center pointer-events-none">
          {getPlatformIcon()}
        </div>

        <input
          id="video-url"
          type="url"
          dir="ltr"
          value={url}
          onChange={(e) => onChangeUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full pl-28 pr-11 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 placeholder:text-right dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-mono"
        />

        <div className="absolute left-2 flex items-center gap-1.5">
          {url && (
            <button
              type="button"
              onClick={() => onChangeUrl('')}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              title="مسح الرابط"
              aria-label="مسح الرابط"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="لصق من الحافظة"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">لصق</span>
          </button>

          <button
            type="button"
            disabled={!url.trim() || isLoading}
            onClick={() => onFetchMetadata(url)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg transition-colors shadow-sm"
          >
            {isLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>تحليل</span>
          </button>
        </div>
      </div>

      {/* Quick Try Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>نماذج سريعة للتجربة:</span>
        </span>
        {PRESET_VIDEOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPreset(item)}
            className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[200px]"
            title={item.title}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
};
