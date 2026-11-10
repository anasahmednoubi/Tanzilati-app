import React from 'react';
import { X, Film, Volume2, Maximize2 } from 'lucide-react';
import { VideoMetadata } from '../types';

interface VideoPreviewModalProps {
  video: VideoMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Film className="w-4 h-4 text-indigo-400" />
            <span className="truncate max-w-[320px] sm:max-w-md">{video.title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {video.videoSrc ? (
            <video
              src={video.videoSrc}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover opacity-60"
            />
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3.5 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-medium">{video.author}</span>
            <span>·</span>
            <span className="font-mono">{video.duration}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            تمت المشاهدة
          </button>
        </div>
      </div>
    </div>
  );
};
