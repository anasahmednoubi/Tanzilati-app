import React from 'react';
import { HistoryItem } from '../types';
import { Trash2, Play, Download, Folder, CheckCircle, Clock, ArrowRight } from 'lucide-react';

interface DownloadsHistoryProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onRemoveItem: (id: string) => void;
  onRedownload: (item: HistoryItem) => void;
  onPreview: (videoSrc?: string, title?: string, thumb?: string) => void;
  onBackToDownload: () => void;
}

export const DownloadsHistory: React.FC<DownloadsHistoryProps> = ({
  history,
  onClearHistory,
  onRemoveItem,
  onRedownload,
  onPreview,
  onBackToDownload,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            سجل التنزيلات
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            قائمة الملفات التي تم تنزيلها واكتمالها على هذا الجهاز
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح السجل</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBackToDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
          >
            <span>تنزيل جديد</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            لا توجد تنزيلات سابقة حتى الآن
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            قم بلصق أي رابط وابدأ التحميل وستظهر جميع الملفات المكتملة هنا تلقائياً.
          </p>
          <button
            type="button"
            onClick={onBackToDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>بدء تنزيل ملف الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  onClick={() => onPreview(item.videoSrc, item.title, item.thumbnailUrl)}
                  className="group relative w-20 h-14 rounded-lg overflow-hidden bg-slate-950 shrink-0 cursor-pointer shadow-inner"
                >
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-current" />
                  </div>
                </div>

                <div className="min-w-0 space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>{item.author}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.quality}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold uppercase">{item.format}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.sizeMB.toFixed(1)} MB</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    <span className="font-mono truncate max-w-[240px]">{item.savePath}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.completedAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => onPreview(item.videoSrc, item.title, item.thumbnailUrl)}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="تشغيل"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRedownload(item)}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="تحميل مجدداً"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="حذف من السجل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
