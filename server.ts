import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const TMP_DIR = '/tmp/tanzeelati-dl';
const YTDLP_PATH = '/tmp/yt-dlp';
const YTDLP_RELEASE_URL =
  'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

fs.mkdirSync(TMP_DIR, { recursive: true });

interface FormatOption {
  key: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  sizeText: string;
  height?: number;
  directUrl?: string;
  audioUrl?: string;
}

interface MediaInfoResult {
  url: string;
  title: string;
  author: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  platformAr: string;
  platformEn: string;
  engine: 'yt-dlp' | 'piped' | 'tikwm' | 'fxtwitter' | 'direct';
  videoOptions: FormatOption[];
  audioOptions: FormatOption[];
  fallbackStreamUrl?: string;
  fallbackAudioUrl?: string;
}

interface DownloadJob {
  id: string;
  status: 'starting' | 'downloading' | 'extracting' | 'ready' | 'error' | 'cancelled';
  phase: 'downloading' | 'extracting' | 'complete' | 'cancelled' | 'error';
  progress: number;
  speedMBs: string | null;
  etaSec: number | null;
  filePath?: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  error?: string;
  createdAt: number;
  abortController?: AbortController;
  childProcess?: ChildProcess;
}

const jobs = new Map<string, DownloadJob>();

// Periodic cleanup of expired jobs & temp files (> 20 mins)
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 20 * 60 * 1000) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        fsp.unlink(job.filePath).catch(() => {});
      }
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);

let ytDlpInitPromise: Promise<string | null> | null = null;

async function ensureYtDlp(): Promise<string | null> {
  if (ytDlpInitPromise) return ytDlpInitPromise;

  ytDlpInitPromise = (async () => {
    try {
      if (fs.existsSync(YTDLP_PATH)) {
        await fsp.chmod(YTDLP_PATH, 0o755);
        return YTDLP_PATH;
      }
      const res = await fetch(YTDLP_RELEASE_URL, {
        headers: { 'User-Agent': 'Tanzeelati-Downloader/1.1' },
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok || !res.body) return null;
      const tmpPart = `${YTDLP_PATH}.part`;
      const buf = Buffer.from(await res.arrayBuffer());
      await fsp.writeFile(tmpPart, buf);
      await fsp.chmod(tmpPart, 0o755);
      await fsp.rename(tmpPart, YTDLP_PATH);
      return YTDLP_PATH;
    } catch {
      ytDlpInitPromise = null;
      return null;
    }
  })();

  return ytDlpInitPromise;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `~${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  const kb = bytes / 1024;
  return `~${Math.max(1, Math.round(kb))} KB`;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function sanitizeFilename(title: string, ext: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const base = cleaned || 'tanzeelati-media';
  return `${base}.${ext}`;
}

function extractYouTubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && id.length >= 6 ? id : null;
    }
    if (host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && parts[1]) {
        return parts[1];
      }
    }
  } catch {}
  return null;
}

function defaultAudioOptions(durationSec = 120): FormatOption[] {
  const est = (kbps: number) =>
    durationSec > 0 ? formatBytes((kbps * 1000 * durationSec) / 8) : '~8 MB';
  return [
    {
      key: 'mp3-320',
      labelAr: 'MP3 – جودة عالية (320 kbps)',
      labelEn: 'MP3 – High Quality (320 kbps)',
      descAr: 'MP3 · أنقى صوت',
      descEn: 'MP3 · Purest Audio',
      sizeText: est(320),
    },
    {
      key: 'mp3-192',
      labelAr: 'MP3 – جودة متوسطة (192 kbps)',
      labelEn: 'MP3 – Medium Quality (192 kbps)',
      descAr: 'MP3 · جودة معيارية',
      descEn: 'MP3 · Standard Quality',
      sizeText: est(192),
    },
    {
      key: 'm4a',
      labelAr: 'M4A – صوت AAC عالي الكفاءة',
      labelEn: 'M4A – High Efficiency AAC',
      descAr: 'M4A / AAC',
      descEn: 'M4A / AAC',
      sizeText: est(160),
    },
    {
      key: 'opus',
      labelAr: 'Opus – أصغر حجم',
      labelEn: 'Opus – Smallest Size',
      descAr: 'Opus · فائق الخفة',
      descEn: 'Opus · Ultra Light',
      sizeText: est(112),
    },
  ];
}

function runYtDlpJson(bin: string, targetUrl: string): Promise<any | null> {
  return new Promise((resolve) => {
    const args = [
      '-J',
      '--no-playlist',
      '--no-warnings',
      '--js-runtimes',
      'node',
      targetUrl,
    ];
    if (process.env.YT_COOKIES_FILE && fs.existsSync(process.env.YT_COOKIES_FILE)) {
      args.unshift('--cookies', process.env.YT_COOKIES_FILE);
    }

    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        resolve(null);
      }
    }, 18000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0 || !stdout.trim()) return resolve(null);
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed && parsed.title ? parsed : null);
      } catch {
        resolve(null);
      }
    });

    child.on('error', () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
  });
}

const PIPED_INSTANCES = [
  'https://pipedapi.ducks.party',
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
];

async function verifyStreamReachable(streamUrl: string): Promise<{ ok: boolean; size?: number }> {
  try {
    const res = await fetch(streamUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const len = Number(res.headers.get('content-length')) || 0;
      return { ok: true, size: len > 0 ? len : undefined };
    }
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(streamUrl, {
        headers: {
          Range: 'bytes=0-1023',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4500),
      });
      return { ok: getRes.ok || getRes.status === 206 };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function resolveYouTubeViaPiped(videoId: string, originalUrl: string): Promise<MediaInfoResult | null> {
  for (const host of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${host}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6500),
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      if (!data || !data.title || !Array.isArray(data.videoStreams)) continue;

      // Pick progressive MP4 streams or usable adaptive streams
      const rawVideos: any[] = data.videoStreams.filter(
        (v: any) =>
          v?.url &&
          v.format !== 'HLS' &&
          !String(v.quality || '').toUpperCase().includes('LBRY')
      );
      const audioStreams: any[] = Array.isArray(data.audioStreams)
        ? data.audioStreams.filter((a: any) => a?.url)
        : [];

      const bestAudio =
        audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;

      // Prefer progressive first and verify reachability on candidate streams
      const progressive = rawVideos.filter((v) => !v.videoOnly);
      const adaptive = rawVideos.filter((v) => v.videoOnly && bestAudio);

      let workingProgressive: { stream: any; size?: number } | null = null;
      for (const cand of progressive) {
        const check = await verifyStreamReachable(cand.url);
        if (check.ok) {
          workingProgressive = { stream: cand, size: check.size };
          break;
        }
      }

      const usableOptions: FormatOption[] = [];
      const seenHeight = new Set<number>();

      // Check top adaptive resolutions if audio is also reachable
      let audioOk = false;
      if (bestAudio) {
        const aCheck = await verifyStreamReachable(bestAudio.url);
        audioOk = aCheck.ok;
      }

      if (audioOk && adaptive.length > 0) {
        const sortedAdaptive = adaptive
          .filter((v) => v.mimeType?.includes('mp4') || v.format === 'MPEG_4')
          .sort((a, b) => (b.height || parseInt(b.quality, 10) || 0) - (a.height || parseInt(a.quality, 10) || 0));

        for (const v of sortedAdaptive) {
          const h = v.height || parseInt(String(v.quality || ''), 10) || 0;
          if (!h || seenHeight.has(h) || ![1080, 720, 480, 360].includes(h)) continue;
          const vCheck = await verifyStreamReachable(v.url);
          if (!vCheck.ok) continue;
          seenHeight.add(h);
          const totalBytes = (vCheck.size || 0) + (bestAudio.contentLength || 0);
          usableOptions.push({
            key: String(h),
            labelAr: h >= 1080 ? `${h}p (Full HD)` : h === 720 ? `${h}p (HD)` : `${h}p`,
            labelEn: h >= 1080 ? `${h}p (Full HD)` : h === 720 ? `${h}p (HD)` : `${h}p`,
            descAr: `MP4 · ${h >= 720 ? 'عالي الوضوح' : 'جودة قياسية'}`,
            descEn: `MP4 · ${h >= 720 ? 'High Definition' : 'Standard'}`,
            sizeText: totalBytes > 0 ? formatBytes(totalBytes) : 'MP4',
            height: h,
            directUrl: v.url,
            audioUrl: bestAudio.url,
          });
        }
      }

      if (workingProgressive) {
        const h =
          workingProgressive.stream.height ||
          parseInt(String(workingProgressive.stream.quality || '360'), 10) ||
          360;
        if (!seenHeight.has(h)) {
          seenHeight.add(h);
          usableOptions.push({
            key: String(h),
            labelAr: `${h}p (MP4 مباشر)`,
            labelEn: `${h}p (Direct MP4)`,
            descAr: 'MP4 · صوت وصورة مدمجين',
            descEn: 'MP4 · Video + Audio',
            sizeText: formatBytes(workingProgressive.size || workingProgressive.stream.contentLength),
            height: h,
            directUrl: workingProgressive.stream.url,
          });
        }
      }

      if (usableOptions.length === 0) continue;

      usableOptions.sort((a, b) => (b.height || 0) - (a.height || 0));
      const bestOpt = usableOptions[0];
      const videoOptions: FormatOption[] = [
        {
          key: 'best',
          labelAr: `أفضل جودة متاحة (${bestOpt.height || 360}p)`,
          labelEn: `Best Available (${bestOpt.height || 360}p)`,
          descAr: bestOpt.descAr,
          descEn: bestOpt.descEn,
          sizeText: bestOpt.sizeText,
          height: bestOpt.height,
          directUrl: bestOpt.directUrl,
          audioUrl: bestOpt.audioUrl,
        },
        ...usableOptions,
      ];

      const fallbackStreamUrl = workingProgressive?.stream.url || bestOpt.directUrl;
      const fallbackAudioUrl = audioOk && bestAudio ? bestAudio.url : workingProgressive?.stream.url;

      return {
        url: originalUrl,
        title: String(data.title),
        author: String(data.uploader || 'YouTube'),
        duration: formatDuration(data.duration),
        durationSec: Number(data.duration) || 0,
        thumbnail: String(data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
        platformAr: 'يوتيوب',
        platformEn: 'YouTube',
        engine: 'piped',
        videoOptions,
        audioOptions: defaultAudioOptions(Number(data.duration) || 120),
        fallbackStreamUrl,
        fallbackAudioUrl,
      };
    } catch {}
  }
  return null;
}

async function resolveTikTok(targetUrl: string): Promise<MediaInfoResult | null> {
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
    const res = await fetch(api, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    if (json?.code !== 0 || !json?.data) return null;
    const d = json.data;
    const hdUrl = d.hdplay || d.play;
    const sdUrl = d.play || d.hdplay;
    if (!hdUrl && !sdUrl) return null;

    const dur = Number(d.duration) || 30;
    const videoOptions: FormatOption[] = [
      {
        key: 'best',
        labelAr: 'أفضل جودة بدون علامة مائية',
        labelEn: 'Best Quality (No Watermark)',
        descAr: 'MP4 · HD أصلي',
        descEn: 'MP4 · Original HD',
        sizeText: formatBytes(d.hd_size || d.size),
        height: 1080,
        directUrl: hdUrl,
      },
    ];
    if (sdUrl && sdUrl !== hdUrl) {
      videoOptions.push({
        key: '480',
        labelAr: 'جودة قياسية (موفر للبيانات)',
        labelEn: 'Standard Quality (Compact)',
        descAr: 'MP4 · بدون علامة مائية',
        descEn: 'MP4 · No Watermark',
        sizeText: formatBytes(d.size),
        height: 480,
        directUrl: sdUrl,
      });
    }

    return {
      url: targetUrl,
      title: String(d.title || 'TikTok Video').trim() || 'TikTok Video',
      author: String(d.author?.nickname || d.author?.unique_id || 'TikTok'),
      duration: formatDuration(dur),
      durationSec: dur,
      thumbnail: String(d.cover || d.origin_cover || ''),
      platformAr: 'تيك توك',
      platformEn: 'TikTok',
      engine: 'tikwm',
      videoOptions,
      audioOptions: defaultAudioOptions(dur),
      fallbackStreamUrl: hdUrl,
      fallbackAudioUrl: d.music || hdUrl,
    };
  } catch {
    return null;
  }
}

async function resolveFxTwitter(targetUrl: string): Promise<MediaInfoResult | null> {
  try {
    const u = new URL(targetUrl);
    const m = u.pathname.match(/\/([^/]+)\/status\/(\d+)/i);
    if (!m) return null;
    const apiUrl = `https://api.fxtwitter.com/${m[1]}/status/${m[2]}`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const tweet = json?.tweet;
    const videos: any[] = tweet?.media?.videos || [];
    if (!videos.length) return null;

    const v = videos[0];
    const variants: any[] = (v.variants || [])
      .filter((x: any) => x?.content_type === 'video/mp4' && x?.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

    const bestUrl = variants[0]?.url || v.url;
    if (!bestUrl) return null;

    const dur = Number(v.duration) || 30;
    const videoOptions: FormatOption[] = [
      {
        key: 'best',
        labelAr: 'أفضل جودة متاحة',
        labelEn: 'Best Available Quality',
        descAr: 'MP4 · أعلى دقة',
        descEn: 'MP4 · Highest Resolution',
        sizeText: 'MP4',
        height: 1080,
        directUrl: bestUrl,
      },
      ...variants.slice(0, 3).map((vr, idx) => ({
        key: idx === 0 ? '720' : idx === 1 ? '480' : '360',
        labelAr: idx === 0 ? 'جودة عالية (HD)' : idx === 1 ? 'جودة متوسطة' : 'حجم أصغر',
        labelEn: idx === 0 ? 'High Quality (HD)' : idx === 1 ? 'Medium Quality' : 'Compact Size',
        descAr: vr.bitrate ? `MP4 · ${Math.round(vr.bitrate / 1000)} kbps` : 'MP4',
        descEn: vr.bitrate ? `MP4 · ${Math.round(vr.bitrate / 1000)} kbps` : 'MP4',
        sizeText: 'MP4',
        height: idx === 0 ? 720 : idx === 1 ? 480 : 360,
        directUrl: vr.url,
      })),
    ];

    return {
      url: targetUrl,
      title: String(tweet.text || `X Video ${m[2]}`).slice(0, 90),
      author: String(tweet.author?.name || tweet.author?.screen_name || 'X'),
      duration: formatDuration(dur),
      durationSec: dur,
      thumbnail: String(v.thumbnail_url || ''),
      platformAr: 'منصة X',
      platformEn: 'X Platform',
      engine: 'fxtwitter',
      videoOptions,
      audioOptions: defaultAudioOptions(dur),
      fallbackStreamUrl: bestUrl,
      fallbackAudioUrl: bestUrl,
    };
  } catch {
    return null;
  }
}

function buildYtDlpMediaInfo(targetUrl: string, raw: any): MediaInfoResult {
  const extractor = String(raw.extractor_key || raw.extractor || 'Video');
  const dur = Number(raw.duration) || 120;
  const formats: any[] = Array.isArray(raw.formats) ? raw.formats : [];

  const heights = Array.from(
    new Set(
      formats
        .filter((f) => f.vcodec && f.vcodec !== 'none' && typeof f.height === 'number' && f.height >= 240)
        .map((f) => Number(f.height))
    )
  ).sort((a, b) => b - a);

  const pickNearest = (maxH: number) =>
    formats
      .filter((f) => f.vcodec && f.vcodec !== 'none' && (f.height || 0) <= maxH)
      .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0))[0];

  const estimateForHeight = (h: number) => {
    const f = pickNearest(h);
    const sz = f?.filesize || f?.filesize_approx;
    return sz ? formatBytes(sz) : `≤${h}p`;
  };

  const targetHeights = heights.length
    ? [1080, 720, 480, 360].filter((th) => heights.some((h) => h >= th - 60))
    : [720, 480, 360];

  const videoOptions: FormatOption[] = [
    {
      key: 'best',
      labelAr: `أفضل جودة متاحة${heights[0] ? ` (${heights[0]}p)` : ''}`,
      labelEn: `Best Available Quality${heights[0] ? ` (${heights[0]}p)` : ''}`,
      descAr: 'MP4 · أعلى جودة صوت وصورة',
      descEn: 'MP4 · Highest Audio & Video',
      sizeText: estimateForHeight(heights[0] || 1080),
      height: heights[0] || 1080,
    },
    ...(targetHeights.length ? targetHeights : [720, 480, 360]).map((h) => ({
      key: String(h),
      labelAr: h >= 1080 ? '1080p (Full HD)' : h === 720 ? '720p (HD)' : `${h}p`,
      labelEn: h >= 1080 ? '1080p (Full HD)' : h === 720 ? '720p (HD)' : `${h}p`,
      descAr: h >= 720 ? 'MP4 · عالي الوضوح' : 'MP4 · موفر للبيانات',
      descEn: h >= 720 ? 'MP4 · High Definition' : 'MP4 · Data Saver',
      sizeText: estimateForHeight(h),
      height: h,
    })),
  ];

  const isArabicPlatform: Record<string, string> = {
    Youtube: 'يوتيوب',
    TikTok: 'تيك توك',
    Instagram: 'إنستغرام',
    Twitter: 'منصة X',
    Facebook: 'فيسبوك',
    Reddit: 'ريديت',
    Soundcloud: 'ساوند كلاود',
    Vimeo: 'فيميو',
  };

  return {
    url: targetUrl,
    title: String(raw.title || 'Media'),
    author: String(raw.uploader || raw.channel || extractor),
    duration: formatDuration(dur),
    durationSec: dur,
    thumbnail: String(raw.thumbnail || ''),
    platformAr: isArabicPlatform[extractor] || extractor,
    platformEn: extractor,
    engine: 'yt-dlp',
    videoOptions,
    audioOptions: defaultAudioOptions(dur),
  };
}

async function resolveDirectMedia(targetUrl: string): Promise<MediaInfoResult | null> {
  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('video/') && !ct.startsWith('audio/')) return null;

    const len = Number(res.headers.get('content-length')) || 0;
    const pathname = new URL(targetUrl).pathname;
    const fileTitle = decodeURIComponent(path.basename(pathname) || 'media-file').replace(/\.[^.]+$/, '');

    return {
      url: targetUrl,
      title: fileTitle || 'Media File',
      author: new URL(targetUrl).hostname.replace(/^www\./, ''),
      duration: '—',
      durationSec: 60,
      thumbnail: '',
      platformAr: 'رابط مباشر',
      platformEn: 'Direct Media',
      engine: 'direct',
      videoOptions: [
        {
          key: 'best',
          labelAr: 'الجودة الأصلية (ملف مباشر)',
          labelEn: 'Original Quality (Direct File)',
          descAr: ct.toUpperCase(),
          descEn: ct.toUpperCase(),
          sizeText: formatBytes(len),
          directUrl: targetUrl,
        },
      ],
      audioOptions: defaultAudioOptions(60),
      fallbackStreamUrl: targetUrl,
      fallbackAudioUrl: targetUrl,
    };
  } catch {
    return null;
  }
}

async function resolveMediaInfo(rawUrl: string): Promise<MediaInfoResult> {
  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) throw new Error('EMPTY_URL');

  const lower = targetUrl.toLowerCase();
  const ytId = extractYouTubeId(targetUrl);

  // 1. TikTok fast no-watermark resolver first, fallback to yt-dlp
  if (lower.includes('tiktok.com')) {
    const tik = await resolveTikTok(targetUrl);
    if (tik) return tik;
  }

  // 2. X / Twitter fast resolver first, fallback to yt-dlp
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    const tw = await resolveFxTwitter(targetUrl);
    if (tw) return tw;
  }

  // 3. Direct .mp4 / .mp3 / video/* / audio/* links
  if (/\.(mp4|webm|mov|mp3|m4a|opus|ogg|wav)(\?|$)/i.test(lower)) {
    const direct = await resolveDirectMedia(targetUrl);
    if (direct) return direct;
  }

  // 4. Try yt-dlp (supports 1000+ platforms including Instagram, Facebook, Reddit, SoundCloud, Vimeo, YouTube)
  const ytDlpBin = await ensureYtDlp();
  if (ytDlpBin) {
    const raw = await runYtDlpJson(ytDlpBin, targetUrl);
    if (raw) {
      return buildYtDlpMediaInfo(targetUrl, raw);
    }
  }

  // 5. YouTube fallback via healthy Piped APIs when running on datacenter IP
  if (ytId) {
    const piped = await resolveYouTubeViaPiped(ytId, targetUrl);
    if (piped) return piped;
  }

  // 6. Direct media probe fallback for non-extension URLs
  const direct = await resolveDirectMedia(targetUrl);
  if (direct) return direct;

  throw new Error('EXTRACTION_FAILED');
}

function runFfmpeg(args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errText = '';
    const onAbort = () => {
      child.kill('SIGKILL');
      reject(new Error('CANCELLED'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stderr.on('data', (c) => {
      errText += c.toString();
    });
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else reject(new Error(errText.slice(-300) || `ffmpeg exited with code ${code}`));
    });
    child.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });
  });
}

async function downloadStreamToFile(
  streamUrl: string,
  destPath: string,
  job: DownloadJob,
  startPct: number,
  endPct: number
): Promise<void> {
  const controller = new AbortController();
  job.abortController = controller;

  const res = await fetch(streamUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    signal: controller.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const totalBytes = Number(res.headers.get('content-length')) || 0;
  let downloaded = 0;
  const startedAt = Date.now();
  let lastTick = startedAt;
  let lastBytes = 0;

  const outStream = fs.createWriteStream(destPath);
  const reader = res.body.getReader();

  try {
    while (true) {
      if (job.status === 'cancelled') {
        throw new Error('CANCELLED');
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await new Promise<void>((resolve, reject) => {
          const ok = outStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
          if (!ok) outStream.once('drain', resolve);
        });
        downloaded += value.byteLength;

        const now = Date.now();
        if (now - lastTick >= 200) {
          const dt = (now - lastTick) / 1000;
          const bytesDelta = downloaded - lastBytes;
          const speedBps = dt > 0 ? bytesDelta / dt : 0;
          const speedMBs = (speedBps / (1024 * 1024)).toFixed(1);
          job.speedMBs = Number(speedMBs) > 0 ? speedMBs : '0.1';

          if (totalBytes > 0) {
            const ratio = Math.min(1, downloaded / totalBytes);
            job.progress = Math.min(endPct, startPct + ratio * (endPct - startPct));
            const remainingBytes = Math.max(0, totalBytes - downloaded);
            job.etaSec = speedBps > 0 ? Math.max(1, Math.round(remainingBytes / speedBps)) : null;
          } else {
            job.progress = Math.min(endPct - 5, job.progress + 2);
            job.etaSec = null;
          }
          lastTick = now;
          lastBytes = downloaded;
        }
      }
    }
    await new Promise<void>((resolve) => outStream.end(resolve));
    job.progress = endPct;
  } catch (err) {
    outStream.destroy();
    if (fs.existsSync(destPath)) {
      await fsp.unlink(destPath).catch(() => {});
    }
    throw err;
  }
}

async function processDownloadJob(
  job: DownloadJob,
  info: MediaInfoResult,
  mode: 'video' | 'audio',
  qualityKey: string
) {
  const workDir = path.join(TMP_DIR, job.id);
  await fsp.mkdir(workDir, { recursive: true });

  try {
    // Direct / Piped / TikWM / FxTwitter direct-stream engines
    if (info.engine !== 'yt-dlp') {
      if (mode === 'video') {
        const chosen =
          info.videoOptions.find((v) => v.key === qualityKey) || info.videoOptions[0];
        const videoStreamUrl = chosen?.directUrl || info.fallbackStreamUrl;
        if (!videoStreamUrl) throw new Error('NO_STREAM');

        const finalPath = path.join(workDir, job.filename);
        job.status = 'downloading';
        job.phase = 'downloading';

        if (chosen?.audioUrl && chosen.audioUrl !== videoStreamUrl) {
          // Adaptive separate video + audio -> download both & mux via ffmpeg
          const vTmp = path.join(workDir, 'video.mp4');
          const aTmp = path.join(workDir, 'audio.m4a');
          await downloadStreamToFile(videoStreamUrl, vTmp, job, 2, 70);
          await downloadStreamToFile(chosen.audioUrl, aTmp, job, 70, 90);
          job.status = 'extracting';
          job.phase = 'extracting';
          job.etaSec = 2;
          await runFfmpeg(
            ['-y', '-i', vTmp, '-i', aTmp, '-c', 'copy', '-movflags', '+faststart', finalPath],
            job.abortController?.signal
          );
          await fsp.unlink(vTmp).catch(() => {});
          await fsp.unlink(aTmp).catch(() => {});
        } else {
          await downloadStreamToFile(videoStreamUrl, finalPath, job, 2, 99);
        }

        const stat = await fsp.stat(finalPath);
        job.filePath = finalPath;
        job.fileSize = stat.size;
        job.progress = 100;
        job.etaSec = 0;
        job.status = 'ready';
        job.phase = 'complete';
        return;
      } else {
        // Audio extraction via ffmpeg
        const sourceUrl = info.fallbackAudioUrl || info.fallbackStreamUrl || info.videoOptions[0]?.directUrl;
        if (!sourceUrl) throw new Error('NO_AUDIO_STREAM');

        const rawTmp = path.join(workDir, 'source.media');
        const finalPath = path.join(workDir, job.filename);

        job.status = 'downloading';
        job.phase = 'downloading';
        await downloadStreamToFile(sourceUrl, rawTmp, job, 2, 78);

        job.status = 'extracting';
        job.phase = 'extracting';
        job.progress = 84;
        job.etaSec = 2;

        const ffmpegAudioArgs: Record<string, string[]> = {
          'mp3-320': ['-vn', '-c:a', 'libmp3lame', '-b:a', '320k', finalPath],
          'mp3-192': ['-vn', '-c:a', 'libmp3lame', '-b:a', '192k', finalPath],
          m4a: ['-vn', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalPath],
          opus: ['-vn', '-c:a', 'libopus', '-b:a', '128k', finalPath],
        };

        const codecArgs = ffmpegAudioArgs[qualityKey] || ffmpegAudioArgs['mp3-192'];
        await runFfmpeg(['-y', '-i', rawTmp, ...codecArgs], job.abortController?.signal);
        await fsp.unlink(rawTmp).catch(() => {});

        const stat = await fsp.stat(finalPath);
        job.filePath = finalPath;
        job.fileSize = stat.size;
        job.progress = 100;
        job.etaSec = 0;
        job.status = 'ready';
        job.phase = 'complete';
        return;
      }
    }

    // Engine: yt-dlp
    const ytDlpBin = await ensureYtDlp();
    if (!ytDlpBin) throw new Error('YTDLP_UNAVAILABLE');

    const outTemplate = path.join(workDir, 'output.%(ext)s');
    const args: string[] = [
      '--newline',
      '--progress',
      '--no-playlist',
      '--no-warnings',
      '--js-runtimes',
      'node',
      '-o',
      outTemplate,
    ];

    if (process.env.YT_COOKIES_FILE && fs.existsSync(process.env.YT_COOKIES_FILE)) {
      args.push('--cookies', process.env.YT_COOKIES_FILE);
    }

    if (mode === 'video') {
      const h = parseInt(qualityKey, 10);
      if (Number.isFinite(h) && h > 0) {
        args.push(
          '-f',
          `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/bv*[height<=${h}]+ba/b`
        );
      } else {
        args.push('-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b');
      }
      args.push('--merge-output-format', 'mp4');
    } else {
      const audioFmt =
        qualityKey === 'm4a' ? 'm4a' : qualityKey === 'opus' ? 'opus' : 'mp3';
      const audioQ = qualityKey === 'mp3-320' ? '320K' : qualityKey === 'mp3-192' ? '192K' : '0';
      args.push('-x', '--audio-format', audioFmt, '--audio-quality', audioQ);
    }
    args.push(info.url);

    job.status = 'downloading';
    job.phase = mode === 'audio' ? 'extracting' : 'downloading';

    await new Promise<void>((resolve, reject) => {
      const child = spawn(ytDlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      job.childProcess = child;
      let errBuf = '';

      const parseLine = (line: string) => {
        const dlMatch = line.match(
          /\[download\]\s+(\d+(?:\.\d+)?)%.*?at\s+([\d.]+)(\w+\/s)(?:.*?ETA\s+(\d+:\d+))?/i
        );
        if (dlMatch) {
          const pct = parseFloat(dlMatch[1]);
          const val = parseFloat(dlMatch[2]);
          const unit = dlMatch[3].toLowerCase();
          const mbps = unit.startsWith('k')
            ? (val / 1024).toFixed(1)
            : unit.startsWith('g')
              ? (val * 1024).toFixed(1)
              : val.toFixed(1);
          job.progress = mode === 'audio' ? Math.min(85, pct * 0.85) : Math.min(96, pct * 0.96);
          job.speedMBs = mbps;
          if (dlMatch[4]) {
            const [mm, ss] = dlMatch[4].split(':').map(Number);
            job.etaSec = (mm || 0) * 60 + (ss || 0);
          }
        }
        if (/\[ExtractAudio\]|\[Merger\]|\[VideoConvertor\]/i.test(line)) {
          job.status = 'extracting';
          job.phase = 'extracting';
          job.progress = Math.max(job.progress, 90);
        }
      };

      child.stdout.on('data', (chunk) => {
        chunk
          .toString()
          .split('\n')
          .forEach((l: string) => parseLine(l));
      });
      child.stderr.on('data', (chunk) => {
        errBuf += chunk.toString();
      });

      child.on('close', (code) => {
        if (job.status === 'cancelled') return reject(new Error('CANCELLED'));
        if (code === 0) resolve();
        else reject(new Error(errBuf.slice(-300) || `yt-dlp exit ${code}`));
      });
      child.on('error', reject);
    });

    const files = await fsp.readdir(workDir);
    const targetFile = files.find((f) => f.startsWith('output.') && !f.endsWith('.part'));
    if (!targetFile) throw new Error('OUTPUT_NOT_FOUND');

    const producedPath = path.join(workDir, targetFile);
    const finalPath = path.join(workDir, job.filename);
    if (producedPath !== finalPath) {
      await fsp.rename(producedPath, finalPath).catch(async () => {
        job.filePath = producedPath;
      });
    }
    if (!job.filePath) job.filePath = finalPath;

    const stat = await fsp.stat(job.filePath);
    job.fileSize = stat.size;
    job.progress = 100;
    job.etaSec = 0;
    job.status = 'ready';
    job.phase = 'complete';
  } catch (err: any) {
    if (job.status === 'cancelled' || err?.message === 'CANCELLED') {
      job.status = 'cancelled';
      job.phase = 'cancelled';
    } else {
      job.status = 'error';
      job.phase = 'error';
      job.error = err?.message || 'Download failed';
    }
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Allow CORS for Capacitor / Android WebView
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. Resolve Media Info & Real Formats
  app.post('/api/info', async (req, res) => {
    try {
      const rawUrl = String(req.body?.url || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'EMPTY_URL' });
        return;
      }
      const info = await resolveMediaInfo(rawUrl);
      res.json({
        url: info.url,
        title: info.title,
        author: info.author,
        duration: info.duration,
        durationSec: info.durationSec,
        thumbnail: info.thumbnail,
        platformAr: info.platformAr,
        platformEn: info.platformEn,
        engine: info.engine,
        videoOptions: info.videoOptions.map(({ key, labelAr, labelEn, descAr, descEn, sizeText, height }) => ({
          key,
          labelAr,
          labelEn,
          descAr,
          descEn,
          sizeText,
          height,
        })),
        audioOptions: info.audioOptions,
      });
    } catch (err: any) {
      res.status(422).json({
        error: err?.message || 'EXTRACTION_FAILED',
      });
    }
  });

  // 2. Start Real Download Job
  app.post('/api/download/start', async (req, res) => {
    try {
      const rawUrl = String(req.body?.url || '').trim();
      const rawMode = req.body?.mode ?? req.body?.kind;
      const mode: 'video' | 'audio' = rawMode === 'audio' ? 'audio' : 'video';
      const qualityKey = String(req.body?.quality ?? req.body?.qualityKey ?? 'best');

      if (!rawUrl) {
        res.status(400).json({ error: 'EMPTY_URL' });
        return;
      }

      const info = await resolveMediaInfo(rawUrl);
      const ext =
        mode === 'audio'
          ? qualityKey === 'm4a'
            ? 'm4a'
            : qualityKey === 'opus'
              ? 'opus'
              : 'mp3'
          : 'mp4';

      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        opus: 'audio/ogg',
      };

      const jobId = `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const filename = sanitizeFilename(info.title, ext);

      const job: DownloadJob = {
        id: jobId,
        status: 'starting',
        phase: mode === 'audio' ? 'extracting' : 'downloading',
        progress: 1,
        speedMBs: null,
        etaSec: null,
        filename,
        mimeType: mimeMap[ext] || 'application/octet-stream',
        createdAt: Date.now(),
      };
      jobs.set(jobId, job);

      // Run in background
      processDownloadJob(job, info, mode, qualityKey).catch(() => {});

      res.json({
        jobId,
        filename,
        title: info.title,
        isAudio: mode === 'audio',
      });
    } catch (err: any) {
      res.status(422).json({ error: err?.message || 'DOWNLOAD_START_FAILED' });
    }
  });

  // 3. Poll Job Status
  app.get('/api/download/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'JOB_NOT_FOUND' });
      return;
    }
    res.json({
      id: job.id,
      status: job.status,
      phase: job.phase,
      progress: Math.round(job.progress * 10) / 10,
      speedMBs: job.speedMBs,
      etaSec: job.etaSec,
      filename: job.filename,
      fileSize: job.fileSize,
      error: job.error,
    });
  });

  // 4. Cancel Running Job
  app.post('/api/download/cancel/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      res.json({ ok: true });
      return;
    }
    job.status = 'cancelled';
    job.phase = 'cancelled';
    try {
      job.abortController?.abort();
    } catch {}
    try {
      job.childProcess?.kill('SIGKILL');
    } catch {}
    res.json({ ok: true });
  });

  // 5. Stream Completed Real File to User's Device (Browser Save Dialog / Downloads Folder)
  app.get('/api/download/file/:jobId', async (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== 'ready' || !job.filePath || !fs.existsSync(job.filePath)) {
      res.status(404).json({ error: 'FILE_NOT_READY' });
      return;
    }

    const stat = await fsp.stat(job.filePath);
    const asciiFallback = job.filename.replace(/[^\x20-\x7E]/g, '_') || 'download.mp4';
    const encodedName = encodeURIComponent(job.filename);

    res.setHeader('Content-Type', job.mimeType);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
    );

    const stream = fs.createReadStream(job.filePath);
    stream.pipe(res);

    res.on('finish', () => {
      // Clean up after short grace period in case browser retries range
      setTimeout(() => {
        const dir = path.dirname(job.filePath!);
        fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
        jobs.delete(job.id);
      }, 60 * 1000);
    });
  });

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ytdlpReady: fs.existsSync(YTDLP_PATH) });
  });

  // Dev Vite middleware or Prod static assets
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Warm up yt-dlp binary quietly in background
  ensureYtDlp().catch(() => {});

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tanzeelati server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
