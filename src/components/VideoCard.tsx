import React from 'react';
import { Play, Eye, Calendar, Film } from 'lucide-react';
import { VideoMetadata } from '../types';

interface VideoCardProps {
  video: VideoMetadata;
  onPreview: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onPreview }) => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center">
        {/* Thumbnail with hover play preview */}
        <div
          onClick={onPreview}
          className="group relative w-full sm:w-56 h-36 sm:h-32 rounded-xl overflow-hidden bg-slate-950 shrink-0 cursor-pointer shadow-inner"
        >
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Graceful SVG fallback
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {/* Subtle gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:bg-black/40 transition-colors flex items-center justify-center" />
          
          {/* Play button indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-white/90 text-slate-950 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>

          {/* Duration overlay bottom-left */}
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono font-medium">
            {video.duration}
          </div>
        </div>

        {/* Video Info: Complies with user markdown: **شرح أساسيات البرمجة للمبتدئين** قناة تجريبية · 12:48 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <Film className="w-3.5 h-3.5" />
            <span>فيديو تم التعرف عليه</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
            {video.title}
          </h3>

          {/* Zero-Pill Metadata Discipline (§1.A): Channel · Duration */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
            <span className="text-slate-900 dark:text-slate-200 font-semibold">{video.author}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-mono tabular-nums">{video.duration}</span>
            {video.views && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>{video.views}</span>
                </span>
              </>
            )}
            {video.date && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{video.date}</span>
                </span>
              </>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={onPreview}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              <span>مشاهدة معاينة سريعة للفيديو</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
