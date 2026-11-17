import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (Number.isFinite(p) && p > 0) return p;
    } else if (argv[i].startsWith('--port=')) {
      const p = Number(argv[i].slice('--port='.length));
      if (Number.isFinite(p) && p > 0) return p;
    }
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0 && envPort !== 8080) return envPort;
  return Number(process.env.DEFAULT_APP_PORT) || 3000;
}

const PORT = resolvePort();
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
  sizeBytes?: number;
  height?: number;
  directUrl?: string;
  audioUrl?: string;
  userAgent?: string;
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
  engine: 'yt-dlp' | 'piped' | 'tikwm' | 'fxtwitter' | 'direct' | 'innertube';
  videoOptions: FormatOption[];
  audioOptions: FormatOption[];
  fallbackStreamUrl?: string;
  fallbackAudioUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  userAgent?: string;
}

interface PreviewEntry {
  url: string;
  userAgent?: string;
  createdAt: number;
}

const previewStreams = new Map<string, PreviewEntry>();

function registerPreviewStream(url?: string, userAgent?: string): string | undefined {
  if (!url) return undefined;
  const id = `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  previewStreams.set(id, { url, userAgent, createdAt: Date.now() });
  return `/api/preview/${id}`;
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

// Periodic cleanup of expired jobs, preview tokens & temp files (> 20 mins)
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
  for (const [pid, pv] of previewStreams.entries()) {
    if (now - pv.createdAt > 20 * 60 * 1000) {
      previewStreams.delete(pid);
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
      await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmpPart));
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

function formatBytes(bytes?: number | null, exact = false): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const prefix = exact ? '' : '~';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${prefix}${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  const kb = bytes / 1024;
  return `${prefix}${Math.max(1, Math.round(kb))} KB`;
}

async function probeContentLength(streamUrl?: string, customUa?: string): Promise<number | undefined> {
  if (!streamUrl) return undefined;
  const ua =
    customUa ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  try {
    const head = await fetch(streamUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(3000),
    });
    if (head.ok) {
      const cl = Number(head.headers.get('content-length')) || 0;
      if (cl > 0) return cl;
    }
    const rng = await fetch(streamUrl, {
      headers: { Range: 'bytes=0-0', 'User-Agent': ua },
      signal: AbortSignal.timeout(3000),
    });
    if (rng.ok || rng.status === 206) {
      const cr = rng.headers.get('content-range') || '';
      const totalMatch = cr.match(/\/(\d+)$/);
      if (totalMatch) {
        const total = Number(totalMatch[1]);
        if (total > 0) return total;
      }
      const cl = Number(rng.headers.get('content-length')) || 0;
      if (cl > 1) return cl;
    }
  } catch {}
  return undefined;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/(https?:\/\/[^\s<>"'{}|\\^`]+[^\s<>"'{}|\\^`.,;:!?)\]])/i);
  if (match) return match[1];
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

function defaultAudioOptions(durationSec = 0, exactM4aBytes?: number): FormatOption[] {
  const hasDur = Number.isFinite(durationSec) && durationSec > 0;
  const est = (kbps: number) =>
    hasDur ? formatBytes((kbps * 1000 * durationSec) / 8, false) : '—';
  const estBytes = (kbps: number) =>
    hasDur ? Math.round((kbps * 1000 * durationSec) / 8) : undefined;
  return [
    {
      key: 'mp3-320',
      labelAr: 'MP3 – جودة عالية (320 kbps)',
      labelEn: 'MP3 – High Quality (320 kbps)',
      descAr: 'MP3 · أنقى صوت',
      descEn: 'MP3 · Purest Audio',
      sizeText: est(320),
      sizeBytes: estBytes(320),
    },
    {
      key: 'mp3-192',
      labelAr: 'MP3 – جودة متوسطة (192 kbps)',
      labelEn: 'MP3 – Medium Quality (192 kbps)',
      descAr: 'MP3 · جودة معيارية',
      descEn: 'MP3 · Standard Quality',
      sizeText: est(192),
      sizeBytes: estBytes(192),
    },
    {
      key: 'm4a',
      labelAr: 'M4A – صوت AAC أصلي',
      labelEn: 'M4A – Original AAC Audio',
      descAr: 'M4A / AAC',
      descEn: 'M4A / AAC',
      sizeText:
        exactM4aBytes && exactM4aBytes > 0
          ? formatBytes(exactM4aBytes, true)
          : est(128),
      sizeBytes: exactM4aBytes && exactM4aBytes > 0 ? exactM4aBytes : estBytes(128),
    },
    {
      key: 'opus',
      labelAr: 'Opus – أصغر حجم',
      labelEn: 'Opus – Smallest Size',
      descAr: 'Opus · فائق الخفة',
      descEn: 'Opus · Ultra Light',
      sizeText: est(128),
      sizeBytes: estBytes(128),
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
            sizeText: totalBytes > 0 ? formatBytes(totalBytes, true) : '—',
            sizeBytes: totalBytes > 0 ? totalBytes : undefined,
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
        const pBytes = workingProgressive.size || workingProgressive.stream.contentLength || 0;
        if (!seenHeight.has(h)) {
          seenHeight.add(h);
          usableOptions.push({
            key: String(h),
            labelAr: `${h}p (MP4 مباشر)`,
            labelEn: `${h}p (Direct MP4)`,
            descAr: 'MP4 · صوت وصورة مدمجين',
            descEn: 'MP4 · Video + Audio',
            sizeText: pBytes > 0 ? formatBytes(pBytes, true) : '—',
            sizeBytes: pBytes > 0 ? pBytes : undefined,
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
          sizeBytes: bestOpt.sizeBytes,
          height: bestOpt.height,
          directUrl: bestOpt.directUrl,
          audioUrl: bestOpt.audioUrl,
        },
        ...usableOptions,
      ];

      const fallbackStreamUrl = workingProgressive?.stream.url || bestOpt.directUrl;
      const fallbackAudioUrl = audioOk && bestAudio ? bestAudio.url : workingProgressive?.stream.url;
      const previewUrl = workingProgressive?.stream.url || bestOpt.directUrl;

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
        audioOptions: defaultAudioOptions(Number(data.duration) || 0, Number(bestAudio?.contentLength) || undefined),
        fallbackStreamUrl,
        fallbackAudioUrl,
        previewUrl,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`,
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

    const dur = Number(d.duration) || 0;
    const [hdSize, sdSize, musicSize] = await Promise.all([
      Number(d.hd_size) > 0 ? Promise.resolve(Number(d.hd_size)) : probeContentLength(hdUrl),
      Number(d.size) > 0 ? Promise.resolve(Number(d.size)) : sdUrl && sdUrl !== hdUrl ? probeContentLength(sdUrl) : Promise.resolve(undefined),
      d.music ? probeContentLength(d.music) : Promise.resolve(undefined),
    ]);

    const videoOptions: FormatOption[] = [
      {
        key: 'best',
        labelAr: 'أفضل جودة بدون علامة مائية',
        labelEn: 'Best Quality (No Watermark)',
        descAr: 'MP4 · HD أصلي',
        descEn: 'MP4 · Original HD',
        sizeText: hdSize ? formatBytes(hdSize, true) : sdSize ? formatBytes(sdSize, true) : '—',
        sizeBytes: hdSize || sdSize,
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
        sizeText: sdSize ? formatBytes(sdSize, true) : '—',
        sizeBytes: sdSize,
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
      audioOptions: defaultAudioOptions(dur, musicSize),
      fallbackStreamUrl: hdUrl,
      fallbackAudioUrl: d.music || hdUrl,
      previewUrl: sdUrl || hdUrl,
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

    const dur = Number(v.duration) || 0;
    const topVariants = variants.slice(0, 3);
    const probedSizes = await Promise.all(topVariants.map((vr) => probeContentLength(vr.url)));
    const bestBytes = probedSizes[0] ?? (await probeContentLength(bestUrl));

    const videoOptions: FormatOption[] = [
      {
        key: 'best',
        labelAr: 'أفضل جودة متاحة',
        labelEn: 'Best Available Quality',
        descAr: 'MP4 · أعلى دقة',
        descEn: 'MP4 · Highest Resolution',
        sizeText: bestBytes ? formatBytes(bestBytes, true) : '—',
        sizeBytes: bestBytes,
        height: 1080,
        directUrl: bestUrl,
      },
      ...topVariants.map((vr, idx) => {
        const bytes = probedSizes[idx];
        return {
          key: idx === 0 ? '720' : idx === 1 ? '480' : '360',
          labelAr: idx === 0 ? 'جودة عالية (HD)' : idx === 1 ? 'جودة متوسطة' : 'حجم أصغر',
          labelEn: idx === 0 ? 'High Quality (HD)' : idx === 1 ? 'Medium Quality' : 'Compact Size',
          descAr: vr.bitrate ? `MP4 · ${Math.round(vr.bitrate / 1000)} kbps` : 'MP4',
          descEn: vr.bitrate ? `MP4 · ${Math.round(vr.bitrate / 1000)} kbps` : 'MP4',
          sizeText: bytes ? formatBytes(bytes, true) : '—',
          sizeBytes: bytes,
          height: idx === 0 ? 720 : idx === 1 ? 480 : 360,
          directUrl: vr.url,
        };
      }),
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
      previewUrl: topVariants[topVariants.length - 1]?.url || bestUrl,
    };
  } catch {
    return null;
  }
}

function buildYtDlpMediaInfo(targetUrl: string, raw: any): MediaInfoResult {
  const extractor = String(raw.extractor_key || raw.extractor || 'Video');
  const dur = Number(raw.duration) || 0;
  const formats: any[] = Array.isArray(raw.formats) ? raw.formats : [];

  const bestAudioFmt = formats
    .filter((f) => (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none')
    .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];

  const exactAudioBytes = Number(bestAudioFmt?.filesize || bestAudioFmt?.filesize_approx || 0);
  const approxAudioBytes =
    exactAudioBytes > 0
      ? exactAudioBytes
      : dur > 0 && bestAudioFmt?.tbr
        ? Math.round((Number(bestAudioFmt.tbr) * 1000 * dur) / 8)
        : 0;

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

  const estimateForHeight = (h: number): { sizeText: string; sizeBytes?: number } => {
    const f = pickNearest(h);
    if (!f) return { sizeText: '—' };
    const hasAudioBuiltIn = f.acodec && f.acodec !== 'none';
    const rawSize = Number(f.filesize || 0);
    const approxSize = Number(f.filesize_approx || 0);
    if (rawSize > 0) {
      const total = hasAudioBuiltIn ? rawSize : rawSize + (exactAudioBytes || approxAudioBytes);
      return { sizeText: formatBytes(total, hasAudioBuiltIn || exactAudioBytes > 0), sizeBytes: total };
    }
    if (approxSize > 0) {
      const total = hasAudioBuiltIn ? approxSize : approxSize + approxAudioBytes;
      return { sizeText: formatBytes(total, false), sizeBytes: total };
    }
    const vTbr = Number(f.vbr || f.tbr || 0);
    if (dur > 0 && vTbr > 0) {
      const aTbr = hasAudioBuiltIn ? 0 : Number(bestAudioFmt?.abr || bestAudioFmt?.tbr || 128);
      const calcBytes = Math.round(((vTbr + aTbr) * 1000 * dur) / 8);
      return { sizeText: formatBytes(calcBytes, false), sizeBytes: calcBytes };
    }
    return { sizeText: '—' };
  };

  const targetHeights = heights.length
    ? [1080, 720, 480, 360].filter((th) => heights.some((h) => h >= th - 60))
    : [720, 480, 360];

  const bestEst = estimateForHeight(heights[0] || 1080);

  const videoOptions: FormatOption[] = [
    {
      key: 'best',
      labelAr: `أفضل جودة متاحة${heights[0] ? ` (${heights[0]}p)` : ''}`,
      labelEn: `Best Available Quality${heights[0] ? ` (${heights[0]}p)` : ''}`,
      descAr: 'MP4 · أعلى جودة صوت وصورة',
      descEn: 'MP4 · Highest Audio & Video',
      sizeText: bestEst.sizeText,
      sizeBytes: bestEst.sizeBytes,
      height: heights[0] || 1080,
    },
    ...(targetHeights.length ? targetHeights : [720, 480, 360]).map((h) => {
      const est = estimateForHeight(h);
      return {
        key: String(h),
        labelAr: h >= 1080 ? '1080p (Full HD)' : h === 720 ? '720p (HD)' : `${h}p`,
        labelEn: h >= 1080 ? '1080p (Full HD)' : h === 720 ? '720p (HD)' : `${h}p`,
        descAr: h >= 720 ? 'MP4 · عالي الوضوح' : 'MP4 · موفر للبيانات',
        descEn: h >= 720 ? 'MP4 · High Definition' : 'MP4 · Data Saver',
        sizeText: est.sizeText,
        sizeBytes: est.sizeBytes,
        height: h,
      };
    }),
  ];

  const progressivePreview = formats
    .filter(
      (f) =>
        f.url &&
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.acodec &&
        f.acodec !== 'none' &&
        (f.ext === 'mp4' || String(f.protocol || '').startsWith('http'))
    )
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

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

  const ytId = extractYouTubeId(targetUrl);

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
    audioOptions: defaultAudioOptions(dur, exactAudioBytes > 0 ? exactAudioBytes : approxAudioBytes || undefined),
    previewUrl: progressivePreview?.url,
    embedUrl: ytId ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1` : undefined,
    userAgent: progressivePreview?.http_headers?.['User-Agent'],
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

    const len = (Number(res.headers.get('content-length')) || 0) || (await probeContentLength(targetUrl)) || 0;
    const pathname = new URL(targetUrl).pathname;
    const fileTitle = decodeURIComponent(path.basename(pathname) || 'media-file').replace(/\.[^.]+$/, '');

    return {
      url: targetUrl,
      title: fileTitle || 'Media File',
      author: new URL(targetUrl).hostname.replace(/^www\./, ''),
      duration: '—',
      durationSec: 0,
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
          sizeText: len > 0 ? formatBytes(len, true) : '—',
          sizeBytes: len > 0 ? len : undefined,
          directUrl: targetUrl,
        },
      ],
      audioOptions: defaultAudioOptions(0, ct.startsWith('audio/') && len > 0 ? len : undefined),
      fallbackStreamUrl: targetUrl,
      fallbackAudioUrl: targetUrl,
      previewUrl: ct.startsWith('video/') ? targetUrl : undefined,
    };
  } catch {
    return null;
  }
}

const INNERTUBE_VR_UA =
  'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';

async function resolveYouTubeViaInnerTube(
  videoId: string,
  originalUrl: string
): Promise<MediaInfoResult | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_VR_UA,
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.60.19',
            androidSdkVersion: 32,
            osName: 'Android',
            osVersion: '12L',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.playabilityStatus?.status !== 'OK' || !data?.streamingData) return null;

    const details = data.videoDetails || {};
    const durSec = Number(details.lengthSeconds) || 120;
    const thumbs: any[] = details.thumbnail?.thumbnails || [];
    const thumb =
      thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const progFormats: any[] = (data.streamingData.formats || []).filter(
      (f: any) => f?.url && String(f.mimeType || '').includes('video/mp4')
    );
    const adapFormats: any[] = data.streamingData.adaptiveFormats || [];

    const bestAudio =
      adapFormats
        .filter((f: any) => f?.url && String(f.mimeType || '').startsWith('audio/mp4'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;

    const bestProg = progFormats[progFormats.length - 1] || null;
    const videoOptions: FormatOption[] = [];
    const seenHeights = new Set<number>();

    if (bestAudio) {
      const h264Adaptive = adapFormats
        .filter(
          (f: any) =>
            f?.url &&
            String(f.mimeType || '').startsWith('video/mp4') &&
            (String(f.mimeType).includes('avc1') || String(f.mimeType).includes('mp4v'))
        )
        .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

      for (const f of h264Adaptive) {
        const h = Number(f.height) || 0;
        if (![1080, 720, 480, 360].includes(h) || seenHeights.has(h)) continue;
        seenHeights.add(h);
        const totalBytes =
          (Number(f.contentLength) || 0) + (Number(bestAudio.contentLength) || 0);
        videoOptions.push({
          key: String(h),
          labelAr: h >= 1080 ? `${h}p (Full HD)` : h === 720 ? `${h}p (HD)` : `${h}p`,
          labelEn: h >= 1080 ? `${h}p (Full HD)` : h === 720 ? `${h}p (HD)` : `${h}p`,
          descAr: h >= 720 ? 'MP4 · عالي الوضوح' : 'MP4 · موفر للبيانات',
          descEn: h >= 720 ? 'MP4 · High Definition' : 'MP4 · Data Saver',
          sizeText: totalBytes > 0 ? formatBytes(totalBytes, true) : '—',
          sizeBytes: totalBytes > 0 ? totalBytes : undefined,
          height: h,
          directUrl: f.url,
          audioUrl: bestAudio.url,
          userAgent: INNERTUBE_VR_UA,
        });
      }
    }

    if (bestProg) {
      const ph = Number(bestProg.height) || 360;
      const progBytes = Number(bestProg.contentLength) || 0;
      if (!seenHeights.has(ph)) {
        seenHeights.add(ph);
        videoOptions.push({
          key: String(ph),
          labelAr: `${ph}p (MP4 مباشر)`,
          labelEn: `${ph}p (Direct MP4)`,
          descAr: 'MP4 · صوت وصورة مدمجين',
          descEn: 'MP4 · Video + Audio',
          sizeText: progBytes > 0 ? formatBytes(progBytes, true) : '—',
          sizeBytes: progBytes > 0 ? progBytes : undefined,
          height: ph,
          directUrl: bestProg.url,
          userAgent: INNERTUBE_VR_UA,
        });
      }
    }

    if (videoOptions.length === 0) return null;

    videoOptions.sort((a, b) => (b.height || 0) - (a.height || 0));
    const top = videoOptions[0];
    const finalOptions: FormatOption[] = [
      {
        key: 'best',
        labelAr: `أفضل جودة متاحة (${top.height || 360}p)`,
        labelEn: `Best Available (${top.height || 360}p)`,
        descAr: top.descAr,
        descEn: top.descEn,
        sizeText: top.sizeText,
        sizeBytes: top.sizeBytes,
        height: top.height,
        directUrl: top.directUrl,
        audioUrl: top.audioUrl,
        userAgent: INNERTUBE_VR_UA,
      },
      ...videoOptions,
    ];

    const audioBytes = Number(bestAudio?.contentLength) || undefined;

    return {
      url: originalUrl,
      title: String(details.title || 'YouTube Video'),
      author: String(details.author || 'YouTube'),
      duration: formatDuration(durSec),
      durationSec: durSec,
      thumbnail: thumb,
      platformAr: 'يوتيوب',
      platformEn: 'YouTube',
      engine: 'innertube',
      videoOptions: finalOptions,
      audioOptions: defaultAudioOptions(durSec, audioBytes),
      fallbackStreamUrl: bestProg?.url || top.directUrl,
      fallbackAudioUrl: bestAudio?.url || bestProg?.url,
      previewUrl: bestProg?.url || top.directUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`,
      userAgent: INNERTUBE_VR_UA,
    };
  } catch {
    return null;
  }
}

async function resolveSocialHtmlFallback(targetUrl: string): Promise<MediaInfoResult | null> {
  try {
    const mobileUA =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': mobileUA },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(
      /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']|"playable_url_quality_hd"\s*:\s*"([^"]+)"|"playable_url"\s*:\s*"([^"]+)"|"video_url"\s*:\s*"([^"]+)"/i
    );
    const rawStream = match?.[1] || match?.[2] || match?.[3] || match?.[4];
    if (!rawStream) return null;
    const cleanStream = rawStream
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/&amp;/g, '&');
    if (!cleanStream.startsWith('http')) return null;

    const probedSize = await probeContentLength(cleanStream, mobileUA);

    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const thumbMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const lower = targetUrl.toLowerCase();
    const platAr = lower.includes('instagram.com')
      ? 'إنستغرام'
      : lower.includes('facebook.com') || lower.includes('fb.watch')
        ? 'فيسبوك'
        : 'فيديو';
    const platEn = lower.includes('instagram.com')
      ? 'Instagram'
      : lower.includes('facebook.com') || lower.includes('fb.watch')
        ? 'Facebook'
        : 'Video';

    return {
      url: targetUrl,
      title: (titleMatch?.[1] || `${platEn} Video`).slice(0, 80),
      author: platEn,
      duration: '—',
      durationSec: 0,
      thumbnail: thumbMatch?.[1]?.replace(/&amp;/g, '&') || '',
      platformAr: platAr,
      platformEn: platEn,
      engine: 'direct',
      videoOptions: [
        {
          key: 'best',
          labelAr: 'أفضل جودة متاحة (MP4)',
          labelEn: 'Best Available Quality (MP4)',
          descAr: 'MP4 · حفظ مباشر',
          descEn: 'MP4 · Direct Save',
          sizeText: probedSize ? formatBytes(probedSize, true) : '—',
          sizeBytes: probedSize,
          directUrl: cleanStream,
          userAgent: mobileUA,
        },
      ],
      audioOptions: defaultAudioOptions(0),
      fallbackStreamUrl: cleanStream,
      fallbackAudioUrl: cleanStream,
      previewUrl: cleanStream,
      userAgent: mobileUA,
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

  // 4. YouTube fast InnerTube resolver first (direct playable MP4/M4A URLs)
  if (ytId) {
    const inner = await resolveYouTubeViaInnerTube(ytId, targetUrl);
    if (inner) return inner;
  }

  // 5. Try yt-dlp (supports 1000+ platforms including Instagram, Facebook, Reddit, SoundCloud, Vimeo, YouTube)
  const ytDlpBin = await ensureYtDlp();
  if (ytDlpBin) {
    const raw = await runYtDlpJson(ytDlpBin, targetUrl);
    if (raw) {
      return buildYtDlpMediaInfo(targetUrl, raw);
    }
  }

  // 6. YouTube fallback via healthy Piped APIs
  if (ytId) {
    const piped = await resolveYouTubeViaPiped(ytId, targetUrl);
    if (piped) return piped;
  }

  // 7. Social HTML OG video extractor (Instagram / Facebook / Reddit)
  const htmlSocial = await resolveSocialHtmlFallback(targetUrl);
  if (htmlSocial) return htmlSocial;

  // 8. Direct media probe fallback for non-extension URLs
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
  endPct: number,
  customUserAgent?: string
): Promise<void> {
  const controller = new AbortController();
  job.abortController = controller;

  const res = await fetch(streamUrl, {
    headers: {
      'User-Agent':
        customUserAgent ||
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

        const ua = chosen?.userAgent || info.userAgent;

        if (chosen?.audioUrl && chosen.audioUrl !== videoStreamUrl) {
          // Adaptive separate video + audio -> download both & mux via ffmpeg
          const vTmp = path.join(workDir, 'video.mp4');
          const aTmp = path.join(workDir, 'audio.m4a');
          await downloadStreamToFile(videoStreamUrl, vTmp, job, 2, 70, ua);
          await downloadStreamToFile(chosen.audioUrl, aTmp, job, 70, 90, ua);
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
          await downloadStreamToFile(videoStreamUrl, finalPath, job, 2, 99, ua);
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
        await downloadStreamToFile(sourceUrl, rawTmp, job, 2, 78, info.userAgent);

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
      const previewProxy = registerPreviewStream(info.previewUrl, info.userAgent);
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
        previewUrl: previewProxy || info.previewUrl,
        embedUrl: info.embedUrl,
        videoOptions: info.videoOptions.map(({ key, labelAr, labelEn, descAr, descEn, sizeText, sizeBytes, height }) => ({
          key,
          labelAr,
          labelEn,
          descAr,
          descEn,
          sizeText,
          sizeBytes,
          height,
        })),
        audioOptions: info.audioOptions.map(({ key, labelAr, labelEn, descAr, descEn, sizeText, sizeBytes }) => ({
          key,
          labelAr,
          labelEn,
          descAr,
          descEn,
          sizeText,
          sizeBytes,
        })),
      });
    } catch (err: any) {
      res.status(422).json({
        error: err?.message || 'EXTRACTION_FAILED',
      });
    }
  });

  // 1b. Byte-Range Video Preview Proxy (enables smooth seeking & playback in <video> without CORS/UA blocks)
  app.get('/api/preview/:previewId', async (req, res) => {
    const entry = previewStreams.get(req.params.previewId);
    if (!entry) {
      res.status(404).end();
      return;
    }
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          entry.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      };
      if (req.headers.range) {
        headers.Range = String(req.headers.range);
      }
      const upstream = await fetch(entry.url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).end();
        return;
      }
      res.status(upstream.status);
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      if (!upstream.headers.get('content-type')) {
        res.setHeader('Content-Type', 'video/mp4');
      }
      if (!upstream.body) {
        res.end();
        return;
      }
      const nodeStream = Readable.fromWeb(upstream.body as any);
      req.on('close', () => {
        nodeStream.destroy();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).end();
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
    const viteReadyPromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        },
        appType: 'spa',
      })
    );
    viteReadyPromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });
    app.use((req, res, next) => {
      viteReadyPromise
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tanzeelati server running on http://0.0.0.0:${PORT}`);
    // Warm up yt-dlp binary after server is ready so boot stays fast
    setTimeout(() => {
      ensureYtDlp().catch(() => {});
    }, 4000);
  });
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

startServer().catch((err) => {
  console.error('Failed to start Tanzeelati server:', err);
  process.exit(1);
});
