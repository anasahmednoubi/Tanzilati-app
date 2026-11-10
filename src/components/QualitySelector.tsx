import React, { useState } from 'react';
import { Video, Music, Check, Sparkles } from 'lucide-react';
import { QualityOption } from '../types';

interface QualitySelectorProps {
  qualities: QualityOption[];
  selectedQualityId: string;
  onSelectQuality: (quality: QualityOption) => void;
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  qualities,
  selectedQualityId,
  onSelectQuality,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'video' | 'audio'>('all');

  const filteredQualities = qualities.filter((q) => {
    if (activeCategory === 'video') return !q.isAudioOnly;
    if (activeCategory === 'audio') return q.isAudioOnly;
    return true;
  });

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          الجودة
        </label>

        {/* Filter buttons (§1.A: segmented control with click handlers) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-lg border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('video')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === 'video'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            فيديو
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('audio')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === 'audio'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            صوت فقط
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filteredQualities.map((item) => {
          const isSelected = item.id === selectedQualityId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectQuality(item)}
              className={`relative flex items-center justify-between p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                isSelected
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    item.isAudioOnly
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                  }`}
                >
                  {item.isAudioOnly ? <Music className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {item.label}
                    </span>
                    {item.recommended && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-medium">
                        موصى بها
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="uppercase font-mono">{item.format}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.bitrate}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  ~{item.sizeMB.toFixed(1)} MB
                </span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center mt-1 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 dark:border-slate-700 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
