export type VideoFormat = 'mp4' | 'mkv' | 'mp3' | 'm4a';

export interface QualityOption {
  id: string;
  label: string;
  resolution?: string;
  fps?: number;
  format: VideoFormat;
  bitrate: string;
  sizeMB: number;
  isAudioOnly?: boolean;
  recommended?: boolean;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  author: string;
  duration: string;
  durationSec: number;
  views: string;
  date: string;
  thumbnailUrl: string;
  platform: 'youtube' | 'vimeo' | 'tiktok' | 'twitter' | 'instagram' | 'facebook' | 'soundcloud' | 'general';
  qualities: QualityOption[];
  videoSrc?: string;
}

export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'cancelled';

export interface DownloadState {
  status: DownloadStatus;
  progress: number; // 0 to 100
  speedMBs: number;
  remainingSec: number;
  downloadedMB: number;
  totalMB: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  author: string;
  duration: string;
  quality: string;
  format: VideoFormat;
  sizeMB: number;
  completedAt: string;
  thumbnailUrl: string;
  savePath: string;
  videoSrc?: string;
}

export interface AppSettings {
  savePath: string;
  autoDownloadOnPaste: boolean;
  notifyOnFinish: boolean;
  simulationSpeed: 'normal' | 'fast' | 'instant';
  theme: 'dark' | 'light';
  preferredFormat: 'mp4' | 'mp3';
}
