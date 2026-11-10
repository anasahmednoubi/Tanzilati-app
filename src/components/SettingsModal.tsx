import React from 'react';
import { X, Settings as SettingsIcon, Folder, Bell, Zap, Check } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">إعدادات التطبيق</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Default save folder */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              مجلد الحفظ الافتراضي
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={settings.savePath}
                onChange={(e) => onUpdateSettings({ savePath: e.target.value })}
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              المسار الذي يتم توجيه التنزيلات إليه افتراضياً على جهازك.
            </p>
          </div>

          {/* Simulation speed */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              سرعة محاكاة التنزيل
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'عادي (واقعي)' },
                { id: 'fast', label: 'سريع (3x)' },
                { id: 'instant', label: 'فوري (مباشر)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ simulationSpeed: opt.id as any })}
                  className={`py-2 px-3 text-xs rounded-lg font-medium border text-center transition-colors ${
                    settings.simulationSpeed === opt.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                إشعار صوتي عند اكتمال التنزيل
              </span>
              <input
                type="checkbox"
                checked={settings.notifyOnFinish}
                onChange={(e) => onUpdateSettings({ notifyOnFinish: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                البدء التلقائي في التحليل عند اللصق
              </span>
              <input
                type="checkbox"
                checked={settings.autoDownloadOnPaste}
                onChange={(e) => onUpdateSettings({ autoDownloadOnPaste: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
