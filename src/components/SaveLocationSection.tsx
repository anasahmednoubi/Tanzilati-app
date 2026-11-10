import React, { useState } from 'react';
import { Folder, FolderOpen, Check, Edit2 } from 'lucide-react';

interface SaveLocationSectionProps {
  savePath: string;
  onChangeSavePath: (newPath: string) => void;
}

export const SaveLocationSection: React.FC<SaveLocationSectionProps> = ({
  savePath,
  onChangeSavePath,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempPath, setTempPath] = useState(savePath);

  const presets = [
    '~/Downloads',
    '~/Desktop',
    '~/Videos',
    '~/Music',
    '/Users/Shared/Downloads',
  ];

  const handleSave = () => {
    if (tempPath.trim()) {
      onChangeSavePath(tempPath.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
          <Folder className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
            موقع الحفظ
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              الحفظ في
            </span>
            <code className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
              {savePath}
            </code>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              dir="ltr"
              value={tempPath}
              onChange={(e) => setTempPath(e.target.value)}
              className="text-xs font-mono px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-indigo-400 rounded-lg text-slate-900 dark:text-white focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>حفظ</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTempPath(savePath);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>تغيير المجلد</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="w-full flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-400">مسارات سريعة:</span>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTempPath(preset)}
              className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-mono border border-slate-200 dark:border-slate-700"
            >
              {preset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
