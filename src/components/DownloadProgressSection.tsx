import React from 'react';
import { Download, Pause, Play, RotateCcw, CheckCircle2, FileDown, ArrowRight } from 'lucide-react';
import { DownloadState, QualityOption } from '../types';

interface DownloadProgressSectionProps {
  downloadState: DownloadState;
  selectedQuality: QualityOption;
  onStartDownload: () => void;
  onPauseDownload: () => void;
  onResumeDownload: () => void;
  onCancelDownload: () => void;
  onSaveFileLocally: () => void;
}

export const DownloadProgressSection: React.FC<DownloadProgressSectionProps> = ({
  downloadState,
  selectedQuality,
  onStartDownload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onSaveFileLocally,
}) => {
  const { status, progress, speedMBs, remainingSec, downloadedMB, totalMB } = downloadState;

  // Format remaining time nicely
  const formatRemaining = (seconds: number) => {
    if (status === 'idle' || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'idle':
        return 'جاهز للتحميل';
      case 'downloading':
        return 'جارٍ التحميل الآن...';
      case 'paused':
        return 'متوقف مؤقتاً';
      case 'completed':
        return 'اكتمل التحميل بنجاح';
      case 'cancelled':
        return 'تم الإلغاء';
      default:
        return 'جاهز للتحميل';
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Top Status Line: جاهز للتحميل **0%** */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : status === 'downloading' ? (
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          )}
          <span className="text-base font-bold text-slate-900 dark:text-white">
            {getStatusLabel()}
          </span>
        </div>

        {/* Tabular Percentage Display */}
        <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
          {Math.round(progress)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ease-out rounded-full ${
            status === 'completed'
              ? 'bg-emerald-500'
              : status === 'paused'
              ? 'bg-amber-500'
              : 'bg-indigo-600 dark:bg-indigo-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats Line: السرعة: —  المتبقي: — */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
        <div>
          <span className="text-slate-400 dark:text-slate-500 ml-1">السرعة:</span>
          <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
            {status === 'downloading' ? `${speedMBs.toFixed(1)} MB/s` : '—'}
          </span>
        </div>

        <div>
          <span className="text-slate-400 dark:text-slate-500 ml-1">المتبقي:</span>
          <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
            {status === 'downloading' ? formatRemaining(remainingSec) : '—'}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 text-left sm:text-left">
          <span className="text-slate-400 dark:text-slate-500 ml-1">الحجم:</span>
          <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
            {status === 'idle'
              ? `${selectedQuality.sizeMB.toFixed(1)} MB`
              : `${downloadedMB.toFixed(1)} / ${totalMB.toFixed(1)} MB`}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center gap-3">
        {status === 'idle' && (
          <button
            type="button"
            onClick={onStartDownload}
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] transition-all shadow-md shadow-indigo-600/20"
          >
            <Download className="w-5 h-5" />
            <span>بدء التحميل الآن</span>
          </button>
        )}

        {status === 'downloading' && (
          <>
            <button
              type="button"
              onClick={onPauseDownload}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Pause className="w-4 h-4" />
              <span>إيقاف مؤقت</span>
            </button>
            <button
              type="button"
              onClick={onCancelDownload}
              className="px-4 py-3 rounded-xl font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              إلغاء
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              type="button"
              onClick={onResumeDownload}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>استئناف التحميل</span>
            </button>
            <button
              type="button"
              onClick={onCancelDownload}
              className="px-4 py-3 rounded-xl font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              إلغاء
            </button>
          </>
        )}

        {status === 'completed' && (
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={onSaveFileLocally}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
              title="تنزيل الملف الفعلي في جهازك الآن"
            >
              <FileDown className="w-5 h-5" />
              <span>حفظ الملف في جهازك (تنزيل حقيقي)</span>
            </button>

            <button
              type="button"
              onClick={onStartDownload}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة التحميل</span>
            </button>
          </div>
        )}

        {status === 'cancelled' && (
          <button
            type="button"
            onClick={onStartDownload}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            <span>إعادة المحاولة</span>
          </button>
        )}
      </div>
    </div>
  );
};
