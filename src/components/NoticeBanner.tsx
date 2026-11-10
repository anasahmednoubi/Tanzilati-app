import React from 'react';
import { Info, Zap, ShieldCheck } from 'lucide-react';

interface NoticeBannerProps {
  simulationSpeed: 'normal' | 'fast' | 'instant';
  onChangeSpeed: (speed: 'normal' | 'fast' | 'instant') => void;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  simulationSpeed,
  onChangeSpeed,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="font-medium text-slate-700 dark:text-slate-300">
          نسخة لعرض الشكل فقط، والتقدم فيها محاكاة.
        </span>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-center">
        <span className="text-[11px] text-slate-400">سرعة المحاكاة:</span>
        <div className="flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => onChangeSpeed('normal')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              simulationSpeed === 'normal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            عادي (1x)
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed('fast')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              simulationSpeed === 'fast'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            سريع (3x)
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed('instant')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              simulationSpeed === 'instant'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            فوري
          </button>
        </div>
      </div>
    </div>
  );
};
