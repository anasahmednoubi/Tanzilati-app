import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  AppLang,
  OPTIONS_I18N,
  ACC_LABELS,
  SZ_I18N,
  TH_LABELS,
  UI_TEXT,
  localizeFeatureLine,
  parseBilingualReleaseNotes,
} from './i18n';

const FG: [string, string[]][] = [
  [
    'arabicFonts',
    [
      'Cairo',
      'Tajawal',
      'Almarai',
      'Noto Naskh Arabic',
      'Noto Kufi Arabic',
      'Noto Sans Arabic',
      'IBM Plex Sans Arabic',
      'Amiri',
      'Amiri Quran',
      'Changa',
      'El Messiri',
      'Harmattan',
      'Lateef',
      'Markazi Text',
      'Mada',
      'Mirza',
      'Reem Kufi',
      'Scheherazade New',
      'Aref Ruqaa',
      'Rakkas',
      'Lalezar',
      'Katibeh',
      'Jomhuria',
      'Readex Pro',
      'Baloo Bhaijaan 2',
      'Lemonada',
      'Kufam',
      'Alexandria',
      'Zain',
      'Vazirmatn',
      'Noto Nastaliq Urdu',
      'Rubik',
      'Marhey',
      'Vibes',
      'Gulzar',
      'Playpen Sans Arabic',
    ],
  ],
  [
    'latinFonts',
    [
      'Inter',
      'Roboto',
      'Open Sans',
      'Lato',
      'Poppins',
      'Montserrat',
      'Nunito',
      'Source Sans 3',
      'Ubuntu',
      'Raleway',
      'Fira Sans',
      'Quicksand',
      'Work Sans',
      'DM Sans',
      'Noto Sans',
      'Comfortaa',
      'Merriweather',
      'Playfair Display',
      'Lora',
      'Noto Serif',
      'Oswald',
      'Caveat',
      'Pacifico',
    ],
  ],
];

const ONE = new Set([
  'Rakkas',
  'Lalezar',
  'Katibeh',
  'Jomhuria',
  'Vibes',
  'Gulzar',
  'Amiri Quran',
  'Pacifico',
]);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface HistoryEntry {
  id: string;
  n: string;
  enName?: string;
  a: boolean;
  fresh?: boolean;
}

const APP_VERSION = '1.1.0';
const APP_BUILD = 2;
const GITHUB_REPO = 'anasahmednoubi/Tanzilati-app';

const compareSemver = (a: string, b: string): number => {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

interface RawManifest {
  version?: string;
  build?: number;
  date?: string;
  title?: string | { ar?: string; en?: string };
  title_ar?: string;
  title_en?: string;
  features?: Array<string | { ar?: string; en?: string }>;
  features_ar?: string[];
  features_en?: string[];
  i18n?: {
    ar?: { title?: string; features?: string[] };
    en?: { title?: string; features?: string[] };
  };
  apkUrl?: string;
  releaseUrl?: string;
}

interface UpdateInfo {
  version: string;
  build?: number;
  date?: string;
  titleAr: string;
  titleEn: string;
  featuresAr: string[];
  featuresEn: string[];
  apkUrl?: string;
  releaseUrl?: string;
  commitSha?: string;
}

interface CaughtVideoInfo {
  url: string;
  title: string;
  author: string;
  duration: string;
  platform: string;
}

export default function App() {
  // Language ('ar' | 'en')
  const [lang, setLang] = useState<AppLang>(() => {
    try {
      return localStorage.getItem('tanzeelati-lang') === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });
  const langRef = useRef<AppLang>(lang);
  langRef.current = lang;

  const t = UI_TEXT[lang];
  const OPTIONS = OPTIONS_I18N[lang];
  const HINTS = {
    video: t.hintVideo,
    audio: t.hintAudio,
  };

  // Sync HTML lang, dir, and title
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'تنزيلاتي' : 'My Downloads';
    try {
      localStorage.setItem('tanzeelati-lang', lang);
    } catch {}
  }, [lang]);

  // Navigation Tabs: 'D' (Download), 'S' (History), 'H' (Settings/More)
  const [curTab, setCurTab] = useState<'D' | 'S' | 'H'>('D');
  const [tabDirection, setTabDirection] = useState<'in-l' | 'in-r' | ''>('');

  // Theme & Accent
  const [theme, setThemeState] = useState<'auto' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('tanzeelati-theme') as any) || 'auto';
  });
  const [accKey, setAccKey] = useState<string>('green');
  const [spinThm, setSpinThm] = useState(false);

  // Fonts
  const [fontFamily, setFontFamily] = useState<string>(() => {
    try {
      const q = JSON.parse(localStorage.getItem('font-v1') || 'null');
      return q?.f || '';
    } catch {
      return '';
    }
  });
  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    try {
      const q = JSON.parse(localStorage.getItem('font-v1') || 'null');
      return +q?.s || 1;
    } catch {
      return 1;
    }
  });
  const [fOpen, setFOpen] = useState(false);
  const [sOpen, setSOpen] = useState(false);

  // Video Fetch & Mode
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isRevealed, setIsRevealed] = useState(true);
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [qv, setQv] = useState<string>(OPTIONS_I18N.ar.video[0][0]);
  const [ddOpen, setDdOpen] = useState(false);
  const [savePath, setSavePath] = useState('~/Downloads');
  const [isChangingPath, setIsChangingPath] = useState(false);

  // Video Details in Main Card (null means sample default)
  const [customVideoMeta, setCustomVideoMeta] = useState<{
    title: string;
    author: string;
    duration: string;
  } | null>(null);

  const currentVideoTitle = customVideoMeta?.title || t.sampleTitle;
  const currentVideoAuthor = customVideoMeta?.author || t.sampleAuthor;
  const currentVideoDuration = customVideoMeta?.duration || '12:48';

  // Simulated Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const [dlPhase, setDlPhase] = useState<'idle' | 'cancelled' | 'downloading' | 'extracting' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [speedVal, setSpeedVal] = useState<string | null>(null);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [showRes, setShowRes] = useState(false);
  const timerRef = useRef<number | null>(null);

  const stateText =
    dlPhase === 'idle'
      ? t.readyToDownload
      : dlPhase === 'cancelled'
        ? t.cancelled
        : dlPhase === 'downloading'
          ? t.downloading
          : dlPhase === 'extracting'
            ? t.extractingAudio
            : t.downloadComplete;
  const speedText = `${t.speedLabel} ${speedVal ? `${speedVal} MB/s` : '—'}`;
  const etaText = `${t.etaLabel} ${etaSec !== null ? `${etaSec} ${t.secUnit}` : '—'}`;

  // History List
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: 'd1',
      n: 'محاضرة الشبكات – الجزء الثاني.mp4',
      enName: 'Computer Networks Lecture – Part 2.mp4',
      a: false,
    },
    {
      id: 'd2',
      n: 'مقطع صوتي للمراجعة.mp3',
      enName: 'Study Review Audio Clip.mp3',
      a: true,
    },
  ]);

  // Settings Sub-Page: null (main settings) | 'font' | 'theme' | 'lang' | 'link' | 'notif'
  const [hSub, setHSub] = useState<'font' | 'theme' | 'lang' | 'link' | 'notif' | null>(null);
  const [wipeArm, setWipeArm] = useState(false);
  const [wipeAllArm, setWipeAllArm] = useState(false);
  const [motOn, setMotOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mot-on') === '1';
    } catch {
      return false;
    }
  });
  const [motMin, setMotMin] = useState<number>(() => {
    try {
      return +(localStorage.getItem('mot-min') || '60') || 60;
    } catch {
      return 60;
    }
  });
  const [devNotifOn, setDevNotifOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dev-notif') === '1';
    } catch {
      return false;
    }
  });
  const [devNotifMsg, setDevNotifMsg] = useState('');
  const [tourStep, setTourStep] = useState<number>(-1);

  // Account & Sync
  const [account, setAccount] = useState<{ g?: string; n?: string; m?: 'g' | 'e' }>(() => {
    try {
      return JSON.parse(localStorage.getItem('link-v1') || '{}') || {};
    } catch {
      return {};
    }
  });
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [toastMsg, setToastMsg] = useState<{ title: string; body: string; icon?: 'check' | 'bell' } | null>(null);

  // --- Clipboard Catcher State ---
  const [caughtVideo, setCaughtVideo] = useState<CaughtVideoInfo | null>(null);
  const [caughtMode, setCaughtMode] = useState<'video' | 'audio'>('video');
  const [caughtQuality, setCaughtQuality] = useState<string>(OPTIONS_I18N.ar.video[0][0]);
  const lastClipboardRef = useRef<string>('');

  // --- GitHub App Update State ---
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'latest' | 'updating' | 'error'
  >('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const updateTimerRef = useRef<number | null>(null);

  const extractManifestBilingual = (manifest: RawManifest, versionFallback: string) => {
    let titleAr =
      manifest.title_ar ||
      manifest.i18n?.ar?.title ||
      (typeof manifest.title === 'object' ? manifest.title?.ar : undefined) ||
      (typeof manifest.title === 'string' ? manifest.title : '');
    let titleEn =
      manifest.title_en ||
      manifest.i18n?.en?.title ||
      (typeof manifest.title === 'object' ? manifest.title?.en : undefined) ||
      (typeof manifest.title === 'string' ? manifest.title : '');

    if (!titleAr && titleEn) titleAr = localizeFeatureLine(titleEn, 'ar');
    if (!titleEn && titleAr) titleEn = localizeFeatureLine(titleAr, 'en');
    if (!titleAr) titleAr = `تحديث جديد للإصدار ${versionFallback}`;
    if (!titleEn) titleEn = `New update to version ${versionFallback}`;

    let featuresAr: string[] = Array.isArray(manifest.features_ar)
      ? manifest.features_ar.filter(Boolean)
      : Array.isArray(manifest.i18n?.ar?.features)
        ? manifest.i18n!.ar!.features!.filter(Boolean)
        : [];
    let featuresEn: string[] = Array.isArray(manifest.features_en)
      ? manifest.features_en.filter(Boolean)
      : Array.isArray(manifest.i18n?.en?.features)
        ? manifest.i18n!.en!.features!.filter(Boolean)
        : [];

    if (Array.isArray(manifest.features) && manifest.features.length > 0) {
      const fromObjsAr: string[] = [];
      const fromObjsEn: string[] = [];
      for (const item of manifest.features) {
        if (typeof item === 'string') {
          if (/[\u0600-\u06FF]/.test(item)) {
            fromObjsAr.push(item);
            fromObjsEn.push(localizeFeatureLine(item, 'en'));
          } else {
            fromObjsEn.push(item);
            fromObjsAr.push(localizeFeatureLine(item, 'ar'));
          }
        } else if (item && typeof item === 'object') {
          if (item.ar) fromObjsAr.push(item.ar);
          if (item.en) fromObjsEn.push(item.en);
        }
      }
      if (featuresAr.length === 0) featuresAr = fromObjsAr;
      if (featuresEn.length === 0) featuresEn = fromObjsEn;
    }

    if (featuresAr.length === 0 && featuresEn.length > 0) {
      featuresAr = featuresEn.map((f) => localizeFeatureLine(f, 'ar'));
    }
    if (featuresEn.length === 0 && featuresAr.length > 0) {
      featuresEn = featuresAr.map((f) => localizeFeatureLine(f, 'en'));
    }
    if (featuresAr.length === 0) featuresAr = ['تحسينات عامة في الأداء وإصلاح الأخطاء'];
    if (featuresEn.length === 0) featuresEn = ['General performance improvements and bug fixes'];

    return { titleAr, titleEn, featuresAr, featuresEn };
  };

  const checkForUpdates = async (manual = false) => {
    if (updateStatus === 'checking' || updateStatus === 'updating') return;
    if (manual) setUpdateDialogOpen(true);
    setUpdateStatus('checking');

    const activeText = UI_TEXT[langRef.current];

    try {
      const cacheBust = Date.now();
      const [manifestRes, releaseRes, commitRes] = await Promise.allSettled([
        fetch(
          `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${cacheBust}`,
          { cache: 'no-store' }
        ),
        fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          cache: 'no-store',
        }),
        fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
          cache: 'no-store',
        }),
      ]);

      let remoteManifest: RawManifest | null = null;
      if (manifestRes.status === 'fulfilled' && manifestRes.value.ok) {
        remoteManifest = await manifestRes.value.json();
      }

      let latestRelease: any = null;
      if (releaseRes.status === 'fulfilled' && releaseRes.value.ok) {
        latestRelease = await releaseRes.value.json();
      }

      let latestCommit: any = null;
      if (commitRes.status === 'fulfilled' && commitRes.value.ok) {
        latestCommit = await commitRes.value.json();
      }

      // 1. Check version.json manifest on GitHub
      if (remoteManifest && remoteManifest.version) {
        const isNewerSemver = compareSemver(remoteManifest.version, APP_VERSION) > 0;
        const isNewerBuild =
          typeof remoteManifest.build === 'number' && remoteManifest.build > APP_BUILD;

        if (isNewerSemver || isNewerBuild) {
          const apkAsset = latestRelease?.assets?.find((a: any) =>
            String(a.name).toLowerCase().endsWith('.apk')
          );
          const localized = extractManifestBilingual(remoteManifest, remoteManifest.version);
          const nextUpdate: UpdateInfo = {
            version: remoteManifest.version,
            build: remoteManifest.build,
            date: remoteManifest.date,
            titleAr: localized.titleAr,
            titleEn: localized.titleEn,
            featuresAr: localized.featuresAr,
            featuresEn: localized.featuresEn,
            apkUrl:
              apkAsset?.browser_download_url ||
              remoteManifest.apkUrl ||
              latestRelease?.html_url ||
              `https://github.com/${GITHUB_REPO}/releases/latest`,
            releaseUrl:
              remoteManifest.releaseUrl ||
              latestRelease?.html_url ||
              `https://github.com/${GITHUB_REPO}/releases`,
            commitSha: latestCommit?.sha,
          };
          setUpdateInfo(nextUpdate);
          setUpdateStatus('available');
          if (!manual) {
            const curT = UI_TEXT[langRef.current];
            triggerToast(curT.updateAvailToastTitle, curT.updateAvailToastBody(nextUpdate.version));
          }
          return;
        }
      }

      // 2. Check GitHub Releases directly if newer than installed APP_VERSION
      if (latestRelease && latestRelease.tag_name) {
        const releaseVer = String(latestRelease.tag_name).replace(/^v/i, '');
        if (compareSemver(releaseVer, APP_VERSION) > 0) {
          const apkAsset = latestRelease.assets?.find((a: any) =>
            String(a.name).toLowerCase().endsWith('.apk')
          );
          const bilingualNotes = parseBilingualReleaseNotes(String(latestRelease.body || ''));
          const rawReleaseName = String(latestRelease.name || `الإصدار ${releaseVer}`);

          const nextUpdate: UpdateInfo = {
            version: releaseVer,
            titleAr: /[\u0600-\u06FF]/.test(rawReleaseName)
              ? rawReleaseName
              : localizeFeatureLine(rawReleaseName, 'ar'),
            titleEn: !/[\u0600-\u06FF]/.test(rawReleaseName)
              ? rawReleaseName
              : `Release ${releaseVer}`,
            featuresAr: bilingualNotes.ar,
            featuresEn: bilingualNotes.en,
            apkUrl: apkAsset?.browser_download_url || latestRelease.html_url,
            releaseUrl: latestRelease.html_url,
            commitSha: latestCommit?.sha,
          };
          setUpdateInfo(nextUpdate);
          setUpdateStatus('available');
          if (!manual) {
            const curT = UI_TEXT[langRef.current];
            triggerToast(curT.updateAvailToastTitle, curT.updateAvailToastBody(nextUpdate.version));
          }
          return;
        }
      }

      // 3. Check latest commit SHA on main branch (catches code pushes even without bumping version.json)
      if (latestCommit && latestCommit.sha) {
        const savedSha = localStorage.getItem('tanzeelati-commit-sha');
        if (!savedSha) {
          try {
            localStorage.setItem('tanzeelati-commit-sha', latestCommit.sha);
          } catch {}
        } else if (savedSha !== latestCommit.sha) {
          const rawMsg = String(latestCommit.commit?.message || 'New code update');
          const msgLines = rawMsg
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
          const apkAsset = latestRelease?.assets?.find((a: any) =>
            String(a.name).toLowerCase().endsWith('.apk')
          );

          const commitAr = msgLines.slice(0, 3).map((l) => localizeFeatureLine(l, 'ar'));
          const commitEn = msgLines.slice(0, 3).map((l) => localizeFeatureLine(l, 'en'));

          const nextUpdate: UpdateInfo = {
            version: `${APP_VERSION} (${latestCommit.sha.slice(0, 7)})`,
            titleAr: 'تحديث جديد متاح على GitHub',
            titleEn: 'New Update Available on GitHub',
            featuresAr: [
              ...(commitAr.length > 0 ? commitAr : ['تحسينات وتعديلات جديدة على الكود']),
              'إصدار APK محدّث جاهز للتنزيل عبر GitHub',
            ],
            featuresEn: [
              ...(commitEn.length > 0 ? commitEn : ['New code improvements and updates']),
              'Updated APK build ready to download via GitHub',
            ],
            apkUrl:
              apkAsset?.browser_download_url ||
              latestRelease?.html_url ||
              `https://github.com/${GITHUB_REPO}/actions`,
            releaseUrl: `https://github.com/${GITHUB_REPO}/commits/main`,
            commitSha: latestCommit.sha,
          };
          setUpdateInfo(nextUpdate);
          setUpdateStatus('available');
          if (!manual) {
            const curT = UI_TEXT[langRef.current];
            triggerToast(
              curT.updateAvailToastTitle,
              langRef.current === 'ar' ? nextUpdate.featuresAr[0] : nextUpdate.featuresEn[0]
            );
          }
          return;
        }
      }

      if (!remoteManifest && !latestRelease && !latestCommit) {
        setUpdateStatus('error');
        return;
      }

      setUpdateInfo(null);
      setUpdateStatus('latest');
      if (manual) {
        const curT = UI_TEXT[langRef.current];
        triggerToast(curT.appName, curT.updateLatestToast(APP_VERSION), 'bell');
      }
    } catch {
      if (activeText) setUpdateStatus('error');
    }
  };

  const applyAppUpdate = () => {
    if (!updateInfo || updateStatus === 'updating') return;
    setUpdateStatus('updating');
    setUpdateProgress(0);

    if (updateTimerRef.current) clearInterval(updateTimerRef.current);
    let p = 0;
    updateTimerRef.current = window.setInterval(() => {
      p = Math.min(100, p + 8 + Math.random() * 14);
      setUpdateProgress(p);
      if (p >= 100) {
        if (updateTimerRef.current) clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;

        if (updateInfo.commitSha) {
          try {
            localStorage.setItem('tanzeelati-commit-sha', updateInfo.commitSha);
          } catch {}
        }

        const isNativeAndroid =
          typeof (window as any).Capacitor !== 'undefined' &&
          (window as any).Capacitor.isNativePlatform?.();

        if (isNativeAndroid && updateInfo.apkUrl) {
          window.location.href = updateInfo.apkUrl;
        } else if (updateInfo.apkUrl && updateInfo.apkUrl.endsWith('.apk')) {
          const a = document.createElement('a');
          a.href = updateInfo.apkUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        const curT = UI_TEXT[langRef.current];
        setUpdateStatus('latest');
        setUpdateInfo(null);
        setUpdateDialogOpen(false);
        triggerToast(curT.updateDoneToastTitle, curT.updateDoneToastBody(updateInfo.version));

        if (!isNativeAndroid) {
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      }
    }, 110);
  };

  useEffect(() => {
    checkForUpdates(false);
    return () => {
      if (updateTimerRef.current) clearInterval(updateTimerRef.current);
    };
  }, []);

  // Helper to resolve realistic metadata for any detected URL
  const parseVideoMetadata = (targetUrl: string, currentLang: AppLang = langRef.current): CaughtVideoInfo => {
    const lower = targetUrl.toLowerCase();
    const isEn = currentLang === 'en';
    let platform = isEn ? 'Video' : 'فيديو';
    let title = isEn ? 'Programming Basics for Beginners' : 'شرح أساسيات البرمجة للمبتدئين';
    let author = isEn ? 'Demo Channel' : 'قناة تجريبية';
    let duration = '12:48';

    if (lower.includes('tiktok.com')) {
      platform = isEn ? 'TikTok' : 'تيك توك';
      title = isEn ? 'AI & Coding Tricks 2026' : 'أسرار وحيل البرمجة والذكاء الاصطناعي 2026';
      author = isEn ? 'Tech TikTok Creator' : 'حساب تيك توك تقني';
      duration = '00:54';
    } else if (lower.includes('instagram.com')) {
      platform = isEn ? 'Instagram' : 'إنستغرام';
      title = isEn ? 'Reels: Quick Tips for Developers' : 'ريلز: نصائح سريعة للمطورين والمصممين';
      author = 'Instagram Creator';
      duration = '01:15';
    } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
      platform = isEn ? 'X Platform' : 'منصة X';
      title = isEn ? 'Tech News Clip on the Web Revolution' : 'مقطع إخباري تقني حول ثورة الويب';
      author = isEn ? 'Tech News' : 'أخبار التقنية';
      duration = '02:30';
    } else if (lower.includes('podcast') || lower.includes('audio') || lower.includes('sound')) {
      platform = isEn ? 'Podcast' : 'صوتيات';
      title = isEn ? 'Podcast: Future of Apps & Software' : 'بودكاست: مستقبل التطبيقات والبرمجيات';
      author = isEn ? 'Knowledge Podcast' : 'بودكاست المعرفة';
      duration = '28:40';
    } else if (lower.includes('vimeo')) {
      platform = 'Vimeo';
      title = isEn ? 'Nature & Oceans 4K Documentary' : 'وثائقي الطبيعة وسحر المحيطات بجودة 4K';
      author = 'Earth Studios';
      duration = '16:20';
    } else if (!lower.includes('demo') && lower.length > 15) {
      platform = isEn ? 'Video Clip' : 'مقطع فيديو';
      title = (isEn ? 'Video: ' : 'فيديو: ') + targetUrl.replace(/https?:\/\/(www\.)?/, '').slice(0, 36) + '...';
      author = isEn ? 'Extracted Media' : 'محتوى مستخرج';
      duration = '09:12';
    }

    return {
      url: targetUrl,
      title,
      author,
      duration,
      platform,
    };
  };

  // Check clipboard
  const checkClipboard = async (silent = true) => {
    const curT = UI_TEXT[langRef.current];
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        if (!silent) triggerToast(curT.warningTitle, curT.clipboardUnsupported);
        return;
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (
        text &&
        (text.startsWith('http://') ||
          text.startsWith('https://') ||
          text.includes('youtube.com') ||
          text.includes('youtu.be') ||
          text.includes('tiktok.com') ||
          text.includes('instagram.com') ||
          text.includes('x.com') ||
          text.includes('vimeo.com'))
      ) {
        if (text !== lastClipboardRef.current) {
          lastClipboardRef.current = text;
          const info = parseVideoMetadata(text, langRef.current);
          setCaughtVideo(info);
          setCaughtMode('video');
          setCaughtQuality(OPTIONS_I18N[langRef.current].video[0][0]);
          triggerToast(curT.linkDetectedToast, curT.linkCaptured(info.title.slice(0, 24)));
        } else if (!silent) {
          const info = parseVideoMetadata(text, langRef.current);
          setCaughtVideo(info);
        }
      } else if (!silent) {
        triggerToast(curT.clipboardTitle, curT.clipboardEmpty);
      }
    } catch {
      if (!silent) {
        const sample = 'https://www.youtube.com/watch?v=prog-basics-2026';
        lastClipboardRef.current = sample;
        const info = parseVideoMetadata(sample, langRef.current);
        setCaughtVideo(info);
        triggerToast(curT.clipboardTitle, curT.clipboardFallback);
      }
    }
  };

  // Monitor window focus for clipboard changes
  useEffect(() => {
    const handleFocus = () => {
      checkClipboard(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Simulate copying sample links for instant testing
  const simulateCopyLink = (sampleUrl: string) => {
    lastClipboardRef.current = sampleUrl;
    const info = parseVideoMetadata(sampleUrl, lang);
    setCaughtVideo(info);
    setCaughtMode('video');
    setCaughtQuality(OPTIONS.video[0][0]);
    triggerToast(t.newLinkToast, t.platformCaptured(info.platform));
  };

  // Load Google fonts dynamically
  const loadedFontsRef = useRef<Record<string, boolean>>({});
  const loadFont = (fontName: string) => {
    if (!fontName || loadedFontsRef.current[fontName]) return;
    loadedFontsRef.current[fontName] = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=' +
      fontName.replace(/ /g, '+') +
      (ONE.has(fontName) ? '' : ':wght@400;700') +
      '&display=swap';
    document.head.appendChild(link);
  };

  // Sync fonts to root CSS variables
  useEffect(() => {
    if (fontFamily) {
      loadFont(fontFamily);
      document.documentElement.style.setProperty(
        '--ff',
        `"${fontFamily}", system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif`
      );
    } else {
      document.documentElement.style.removeProperty('--ff');
    }
    document.documentElement.style.setProperty('--zs', String(fontSizeScale));
    try {
      localStorage.setItem('font-v1', JSON.stringify({ f: fontFamily, s: fontSizeScale }));
    } catch {}
  }, [fontFamily, fontSizeScale]);

  // Sync Theme
  const isDarkNow = () => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    try {
      localStorage.setItem('tanzeelati-theme', theme);
    } catch {}
  }, [theme]);

  // Sync Accent Color
  useEffect(() => {
    const root = document.documentElement;
    if (accKey === 'violet') {
      delete root.dataset.acc;
      root.style.removeProperty('--ab');
    } else {
      root.dataset.acc = accKey;
      root.style.setProperty('--ab', ACC_LABELS[accKey].color);
    }
  }, [accKey]);

  // Tab Switcher with Direction
  const switchTab = (nextTab: 'D' | 'S' | 'H') => {
    if (nextTab === curTab) return;
    const tabOrder = ['D', 'S', 'H'];
    const isForward = tabOrder.indexOf(nextTab) > tabOrder.indexOf(curTab);
    const dir = lang === 'ar' ? (isForward ? 'in-l' : 'in-r') : isForward ? 'in-r' : 'in-l';
    setTabDirection(dir);
    setCurTab(nextTab);
    if (nextTab === 'H') setHSub(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Document-level Swipe Navigation (RTL & LTR aware)
  const curTabRef = useRef(curTab);
  curTabRef.current = curTab;
  const switchTabRef = useRef(switchTab);
  switchTabRef.current = switchTab;

  useEffect(() => {
    let sx: number | null = null;
    let sy = 0;
    let ok = true;
    const hScroll = (start: Element | null) => {
      let cur = start as HTMLElement | null;
      while (cur && cur !== document.body) {
        const cs = window.getComputedStyle(cur);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cur.scrollWidth > cur.clientWidth + 2) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      const targetEl = e.target as HTMLElement;
      ok =
        !(
          targetEl.closest &&
          targetEl.closest('input,textarea,select,.sheet-container,.sheet-backdrop,.dlg-backdrop,.upd-sheet')
        ) && !hScroll(targetEl);
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (!ok || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      const order = ['D', 'S', 'H'] as const;
      const i = order.indexOf(curTabRef.current);
      const forward = langRef.current === 'en' ? dx < 0 : dx > 0;
      const next = order[i + (forward ? 1 : -1)];
      if (next) switchTabRef.current(next);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Quality label lookup
  const getQualityLabel = (val: string) => {
    const opts = OPTIONS[mode];
    const found = opts.find((o) => o[0] === val);
    return found ? found[1] : opts[0][1];
  };

  // Mode Change
  const handleModeChange = (newMode: 'video' | 'audio') => {
    setMode(newMode);
    const newOpts = OPTIONS[newMode];
    setQv(newOpts[0][0]);
    setDdOpen(false);
  };

  // Handle URL fetch
  const handleFetch = () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setTimeout(() => {
      const parsed = parseVideoMetadata(url, langRef.current);
      setCustomVideoMeta({
        title: parsed.title,
        author: parsed.author,
        duration: parsed.duration,
      });
      setIsRevealed(true);
      setIsFetching(false);
    }, 700);
  };

  // Download simulation
  const startDownloadSimulation = (fileTitle: string, isAudio: boolean, formatKey: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowRes(false);
    setIsDownloading(true);
    setDlPhase(isAudio ? 'extracting' : 'downloading');
    let p = 0;

    timerRef.current = window.setInterval(() => {
      p = Math.min(100, p + 0.8 + Math.random() * 2.2);
      setProgress(p);
      setSpeedVal((3 + Math.random() * 2).toFixed(1));
      setEtaSec(Math.max(1, Math.round((100 - p) / 7)));

      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsDownloading(false);
        setDlPhase('complete');
        setEtaSec(0);
        setShowRes(true);

        const curT = UI_TEXT[langRef.current];
        const ext = isAudio ? formatKey.split('-')[0] : 'mp4';
        const newEntry: HistoryEntry = {
          id: uid(),
          n: `${fileTitle.slice(0, 30)}.${ext}`,
          a: isAudio,
          fresh: true,
        };
        setHistory((prev) => [newEntry, ...prev]);
        triggerToast(curT.completedToastTitle, curT.completedToastBody(fileTitle.slice(0, 20)));
      }
    }, 120);
  };

  const handleDownloadToggle = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsDownloading(false);
      setDlPhase('cancelled');
      setSpeedVal(null);
      setEtaSec(null);
      return;
    }
    startDownloadSimulation(currentVideoTitle, mode === 'audio', qv);
  };

  // Apply and start download directly from Caught Video Sheet
  const handleDownloadFromCaught = () => {
    if (!caughtVideo) return;
    setUrl(caughtVideo.url);
    setCustomVideoMeta({
      title: caughtVideo.title,
      author: caughtVideo.author,
      duration: caughtVideo.duration,
    });
    setIsRevealed(true);
    setMode(caughtMode);
    setQv(caughtQuality);
    setCaughtVideo(null);
    switchTab('D');
    startDownloadSimulation(caughtVideo.title, caughtMode === 'audio', caughtQuality);
  };

  // Just load the caught video into the input
  const handleOpenCaughtInApp = () => {
    if (!caughtVideo) return;
    setUrl(caughtVideo.url);
    setCustomVideoMeta({
      title: caughtVideo.title,
      author: caughtVideo.author,
      duration: caughtVideo.duration,
    });
    setIsRevealed(true);
    setMode(caughtMode);
    setQv(caughtQuality);
    setCaughtVideo(null);
    switchTab('D');
  };

  const triggerToast = (title: string, body: string, icon: 'check' | 'bell' = 'check') => {
    setToastMsg({ title, body, icon });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.title === title ? null : prev));
    }, 3500);
  };

  // Motivational Notifications Scheduler
  useEffect(() => {
    try {
      localStorage.setItem('mot-on', motOn ? '1' : '0');
      localStorage.setItem('mot-min', String(motMin));
    } catch {}
    if (!motOn) return;
    let i = 0;
    const id = window.setInterval(() => {
      const curT = UI_TEXT[langRef.current];
      const msg = curT.motMsgs[i++ % curT.motMsgs.length];
      triggerToast(curT.motReminderTitle, msg, 'bell');
      try {
        if (devNotifOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(curT.appName, { body: msg });
        }
      } catch {}
    }, motMin * 60000);
    return () => window.clearInterval(id);
  }, [motOn, motMin, devNotifOn]);

  const toggleDevNotif = async () => {
    const curT = UI_TEXT[langRef.current];
    if (devNotifOn) {
      setDevNotifOn(false);
      try {
        localStorage.setItem('dev-notif', '0');
      } catch {}
      setDevNotifMsg('');
      return;
    }
    try {
      if (typeof Notification === 'undefined') {
        setDevNotifMsg(curT.notifUnsupported);
        return;
      }
      const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (p === 'granted') {
        setDevNotifOn(true);
        try {
          localStorage.setItem('dev-notif', '1');
        } catch {}
        setDevNotifMsg('');
        new Notification(curT.appName, { body: curT.notifActivated });
      } else {
        setDevNotifMsg(curT.notifDenied);
      }
    } catch {
      setDevNotifMsg(curT.notifError);
    }
  };

  const handleThemeToggle = (e?: React.MouseEvent) => {
    setSpinThm(true);
    setTimeout(() => setSpinThm(false), 700);
    const next: 'light' | 'dark' = isDarkNow() ? 'light' : 'dark';
    const apply = () => {
      setThemeState(next);
      document.documentElement.dataset.theme = next;
    };
    const doc = document as any;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (doc.startViewTransition && !reduced) {
      try {
        const r = e && e.currentTarget ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null;
        const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const y = r ? r.top + r.height / 2 : 0;
        const rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        const vt = doc.startViewTransition(() => {
          flushSync(apply);
        });
        vt.ready
          .then(() => {
            document.documentElement.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
              { duration: 700, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
            );
          })
          .catch(() => {});
        return;
      } catch {}
    }
    apply();
  };

  const handleLanguageSwitch = (nextLang: AppLang) => {
    if (nextLang === lang) return;
    setLang(nextLang);
  };

  // Account handlers
  const handleAuthSubmit = () => {
    const e = authEmail.trim();
    setAuthInfo('');
    if (!EMAIL_RE.test(e)) {
      setAuthError(t.invalidEmail);
      return;
    }
    if (authPassword.length < 6) {
      setAuthError(t.shortPassword);
      return;
    }
    const accObj = {
      g: e,
      n: authMode === 'up' ? authName.trim() : '',
      m: 'e' as const,
    };
    setAccount(accObj);
    try {
      localStorage.setItem('link-v1', JSON.stringify(accObj));
    } catch {}
    setAuthPassword('');
    setAuthError('');
    setAuthInfo('');
    triggerToast(t.accountToastTitle, authMode === 'up' ? t.accountCreated : t.signedIn);
  };

  const handleGoogleAuth = () => {
    const accObj = { g: 'Google User', n: t.googleUser, m: 'g' as const };
    setAccount(accObj);
    try {
      localStorage.setItem('link-v1', JSON.stringify(accObj));
    } catch {}
    triggerToast(t.accountToastTitle, t.googleLinked);
  };

  const handleUnlink = () => {
    setAccount({});
    try {
      localStorage.removeItem('link-v1');
    } catch {}
    triggerToast(t.accountToastTitle, t.signOutToast);
  };

  const isLinked = Boolean(account.g);
  const linkedDisplayName =
    account.n || (account.g && account.g.includes('@') ? account.g.split('@')[0] : account.g) || '';

  // Close dropdown on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#dd')) setDdOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const backArrowTransform = lang === 'en' ? 'rotate(90deg)' : 'rotate(-90deg)';
  const rowChevronTransform = lang === 'en' ? 'rotate(-90deg)' : 'rotate(90deg)';

  const activeUpdateTitle = updateInfo
    ? lang === 'ar'
      ? updateInfo.titleAr
      : updateInfo.titleEn
    : '';
  const activeUpdateFeatures = updateInfo
    ? lang === 'ar'
      ? updateInfo.featuresAr
      : updateInfo.featuresEn
    : [];

  return (
    <div className="min-h-screen">
      <main>
        {/* Header with new brand logo + quick language toggle + circular ripple theme button */}
        <div className="hd">
          <div className="brand">
            <svg className="logo" width="42" height="37" viewBox="0 3 48 42" aria-hidden="true">
              <rect
                x="2"
                y="5"
                width="44"
                height="38"
                rx="13"
                fill="var(--card)"
                stroke="var(--lbd)"
                strokeWidth="1.2"
              />
              <rect x="6" y="9" width="36" height="30" rx="9" fill="var(--ab, #059669)" />
              <path
                className="arrow"
                d="M24 14.5v12M18 21.5l6 6 6-6"
                fill="none"
                stroke="var(--lar)"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="tray"
                d="M18 33h12"
                fill="none"
                stroke="var(--lar)"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1>{t.appName}</h1>
          </div>
          <button
            id="thm"
            className={spinThm ? 'spin' : ''}
            onClick={handleThemeToggle}
            aria-label={t.toggleThemeAria}
          >
            {isDarkNow() ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
              </svg>
            )}
          </button>
        </div>

        <p className="sub lead">{t.tagline}</p>

        {/* Quick Clipboard Detection Bar & Touch indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            className="clip-chip"
            onClick={() => checkClipboard(false)}
            title={t.checkClipboardTitle}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <span>{t.checkClipboardBtn}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-[var(--mute)]">
            <span style={{ fontSize: '12px' }}>{t.simulateCopy}</span>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://tiktok.com/@tech/video/1029384756')}
            >
              {t.tiktok}
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://youtube.com/watch?v=ai-web-2026')}
            >
              {t.youtube}
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://podcast.fm/tech-future-sound')}
            >
              {t.audioSample}
            </button>
          </div>
        </div>

        {/* Touch Swipe Dots Navigation Indicator */}
        <div className="swipe-dots" aria-label={t.swipeIndicatorAria}>
          <div className={`swipe-dot ${curTab === 'D' ? 'on' : ''}`} onClick={() => switchTab('D')}></div>
          <div className={`swipe-dot ${curTab === 'S' ? 'on' : ''}`} onClick={() => switchTab('S')}></div>
          <div className={`swipe-dot ${curTab === 'H' ? 'on' : ''}`} onClick={() => switchTab('H')}></div>
        </div>

        {/* Tab: Download (#pD) */}
        <div id="pD" className={`${curTab === 'D' ? '' : 'hide'} ${tabDirection}`}>
          <section className="card">
            <label className="t" htmlFor="url">
              {t.videoUrlLabel}
            </label>
            <div className="row">
              <input
                type="text"
                id="url"
                placeholder="https://"
                inputMode="url"
                autoComplete="off"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              />
              <button id="fetch" disabled={isFetching} onClick={handleFetch}>
                {isFetching ? t.fetching : t.fetch}
              </button>
            </div>
            <div className={`reveal ${isRevealed ? 'open' : ''}`} id="rv">
              <div>
                <div className="prev">
                  <div className="thumb" aria-hidden="true"></div>
                  <div className="pm">
                    <b>{currentVideoTitle}</b>
                    <span>
                      {currentVideoAuthor} · {currentVideoDuration}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            {/* Segmented control with animated sliding pill */}
            <div className="mt" id="mt" data-m={mode} role="tablist">
              <span className="pill"></span>
              <button
                className={mode === 'video' ? 'on' : ''}
                data-m="video"
                role="tab"
                onClick={() => handleModeChange('video')}
              >
                {t.videoTab}
              </button>
              <button
                className={mode === 'audio' ? 'on' : ''}
                data-m="audio"
                role="tab"
                onClick={() => handleModeChange('audio')}
              >
                {t.audioTab}
              </button>
            </div>

            <label className="t" id="qLbl">
              {t.qualityLabel}
            </label>
            <div className={`dd ${ddOpen ? 'open' : ''}`} id="dd">
              <button
                className="dd-btn"
                id="ddBtn"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={ddOpen}
                aria-labelledby="qLbl ddVal"
                onClick={() => setDdOpen(!ddOpen)}
              >
                <span id="ddVal">{getQualityLabel(qv)}</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className="dd-list">
                <ul id="ddList" role="listbox" aria-labelledby="qLbl">
                  {OPTIONS[mode].map(([v, labelText]) => (
                    <li
                      key={v}
                      role="option"
                      tabIndex={0}
                      data-v={v}
                      aria-selected={v === qv}
                      onClick={() => {
                        setQv(v);
                        setDdOpen(false);
                      }}
                    >
                      <span>{labelText}</span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="hint" id="hint">
              {HINTS[mode]}
            </p>

            <div className="dir">
              {isChangingPath ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    value={savePath}
                    onChange={(e) => setSavePath(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsChangingPath(false)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    {t.save}
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    {t.saveIn} <code>{savePath}</code>
                  </span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setIsChangingPath(true)}
                  >
                    {t.change}
                  </button>
                </>
              )}
            </div>
          </section>

          <button
            className={`go ${isDownloading ? 'ghost' : ''}`}
            id="go"
            onClick={handleDownloadToggle}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
            </svg>
            <span id="goT">{isDownloading ? t.cancel : t.download}</span>
          </button>

          <section className="card" aria-live="polite">
            <div className="top">
              <span id="state">{stateText}</span>
              <b id="pct">{Math.floor(progress)}%</b>
            </div>
            <div className="bar">
              <div
                className={`fill ${isDownloading ? 'run' : ''}`}
                id="bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="meta">
              <span id="speed">{speedText}</span>
              <span id="eta">{etaText}</span>
            </div>
            <div className={`result ${showRes ? 'show' : ''}`} id="res">
              {t.savedResult}
            </div>
          </section>
        </div>

        {/* Tab: History (#pS) */}
        <div id="pS" className={`${curTab === 'S' ? '' : 'hide'} ${tabDirection}`}>
          <section className="card">
            <b style={{ fontSize: '18px' }}>{t.historyTitle}</b>
            <div className="sub" style={{ margin: '2px 0 6px' }}>
              {t.filesCount(history.length)}
            </div>
            {history.length ? (
              history.map((h, i) => (
                <div key={h.id} className={`q ${h.fresh && i === 0 ? 'new' : ''}`}>
                  <div className="n">
                    <div className="ic">{h.a ? '♪' : '▶'}</div>
                    <span>{lang === 'en' && h.enName ? h.enName : h.n}</span>
                  </div>
                  <span className="s">{t.completedBadge}</span>
                </div>
              ))
            ) : (
              <div className="empty">{t.emptyHistory}</div>
            )}
          </section>
        </div>

        {/* Tab: Settings/More (#pH) */}
        <div id="pH" className={`${curTab === 'H' ? '' : 'hide'} ${tabDirection}`}>
          {hSub ? (
            /* Settings Sub-Pages */
            <div>
              <div className="back">
                <button onClick={() => setHSub(null)} aria-label={t.backAria}>
                  <span style={{ display: 'inline-flex', transform: backArrowTransform }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <b>{t.subTitles[hSub]}</b>
              </div>

              {/* Sub-page: Language */}
              {hSub === 'lang' && (
                <div className="card">
                  <b>{t.appLanguage}</b>
                  <div className="chips" style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      className={`chip ${lang === 'ar' ? 'on' : ''}`}
                      onClick={() => handleLanguageSwitch('ar')}
                    >
                      {t.langArabic}
                    </button>
                    <button
                      type="button"
                      className={`chip ${lang === 'en' ? 'on' : ''}`}
                      onClick={() => handleLanguageSwitch('en')}
                    >
                      {t.langEnglish}
                    </button>
                  </div>
                  <p className="hint" style={{ marginTop: '10px' }}>
                    {t.languageHint}
                  </p>
                </div>
              )}

              {/* Sub-page: Theme */}
              {hSub === 'theme' && (
                <>
                  <div className="card">
                    <div className="chips">
                      {(['auto', 'light', 'dark'] as const).map((k) => (
                        <button
                          key={k}
                          className={`chip ${theme === k ? 'on' : ''}`}
                          onClick={() => setThemeState(k)}
                        >
                          {TH_LABELS[lang][k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <b>{t.appColor}</b>
                    <div className="sw" role="radiogroup" aria-label={t.appColor}>
                      {Object.keys(ACC_LABELS).map((c) => (
                        <button
                          key={c}
                          className="dot"
                          style={{ '--c': ACC_LABELS[c].color } as React.CSSProperties}
                          role="radio"
                          aria-checked={accKey === c}
                          aria-label={lang === 'ar' ? ACC_LABELS[c].ar : ACC_LABELS[c].en}
                          onClick={() => setAccKey(c)}
                        ></button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Sub-page: Font */}
              {hSub === 'font' && (
                <div className="card">
                  <div className="sub" style={{ margin: '0 0 8px' }}>
                    {t.fontStyle}
                  </div>
                  <button
                    className="fdd"
                    aria-expanded={fOpen}
                    onClick={() => {
                      setFOpen(!fOpen);
                      if (!fOpen) {
                        setSOpen(false);
                        FG.forEach((g) => g[1].forEach(loadFont));
                      }
                    }}
                  >
                    <span style={fontFamily ? { fontFamily: `'${fontFamily}', sans-serif` } : {}}>
                      {fontFamily || t.defaultLabel}
                    </span>
                    <span style={{ display: 'inline-flex' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {fOpen && (
                    <div className="fpanel">
                      <button
                        className={`fi ${!fontFamily ? 'on' : ''}`}
                        onClick={() => {
                          setFontFamily('');
                          setFOpen(false);
                        }}
                      >
                        <span>{t.defaultLabel}</span>
                      </button>
                      {FG.map((g, gi) => (
                        <React.Fragment key={g[0]}>
                          <div className="fg">
                            {g[0] === 'arabicFonts' ? t.arabicFonts : t.latinFonts}
                          </div>
                          {g[1].map((fontName) => (
                            <button
                              key={fontName}
                              className={`fi ${fontFamily === fontName ? 'on' : ''}`}
                              style={{ fontFamily: `'${fontName}', sans-serif` }}
                              onClick={() => {
                                setFontFamily(fontName);
                                setFOpen(false);
                              }}
                            >
                              <span>{fontName}</span>
                              {gi === 0 && <span dir="rtl">أبجد هوز</span>}
                            </button>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <div className="sub" style={{ margin: '12px 0 8px' }}>
                    {t.fontSize}
                  </div>
                  <button
                    className="fdd"
                    aria-expanded={sOpen}
                    onClick={() => {
                      setSOpen(!sOpen);
                      if (!sOpen) setFOpen(false);
                    }}
                  >
                    <span style={{ fontSize: `${16 * fontSizeScale}px` }}>
                      {lang === 'ar'
                        ? (SZ_I18N.find((x) => x[0] === fontSizeScale) || SZ_I18N[2])[1]
                        : (SZ_I18N.find((x) => x[0] === fontSizeScale) || SZ_I18N[2])[2]}{' '}
                      · {Math.round(fontSizeScale * 100)}%
                    </span>
                    <span style={{ display: 'inline-flex' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {sOpen && (
                    <div className="fpanel">
                      {SZ_I18N.map((x) => (
                        <button
                          key={x[0]}
                          className={`fi ${fontSizeScale === x[0] ? 'on' : ''}`}
                          style={{ fontSize: `${16 * x[0]}px` }}
                          onClick={() => {
                            setFontSizeScale(x[0]);
                            setSOpen(false);
                          }}
                        >
                          <span>{lang === 'ar' ? x[1] : x[2]}</span>
                          <span>{Math.round(x[0] * 100)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-page: Notifications */}
              {hSub === 'notif' && (
                <>
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <b>{t.motivationalNotifications}</b>
                      <button
                        type="button"
                        className={`swt ${motOn ? 'on' : ''}`}
                        role="switch"
                        aria-checked={motOn}
                        onClick={() => setMotOn((v) => !v)}
                      >
                        <i></i>
                      </button>
                    </div>
                    <div className="sub" style={{ marginTop: '6px' }}>
                      {t.motivationalDesc}
                    </div>
                    {motOn && (
                      <>
                        <div className="sub" style={{ marginTop: '12px' }}>
                          {t.notifInterval}
                        </div>
                        <div className="chips" style={{ margin: '8px 0 0' }}>
                          {t.motIntervals.map(([m, label]) => (
                            <button
                              key={m}
                              type="button"
                              className={`chip ${motMin === m ? 'on' : ''}`}
                              onClick={() => setMotMin(m)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <b>{t.showDeviceNotif}</b>
                      <button
                        type="button"
                        className={`swt ${devNotifOn ? 'on' : ''}`}
                        role="switch"
                        aria-checked={devNotifOn}
                        onClick={toggleDevNotif}
                      >
                        <i></i>
                      </button>
                    </div>
                    {devNotifMsg && (
                      <div className="sub" style={{ marginTop: '8px' }}>
                        {devNotifMsg}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Sub-page: Link Account */}
              {hSub === 'link' && (
                <div className="card">
                  {isLinked ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="badge"
                          style={{
                            width: '44px',
                            height: '44px',
                            fontSize: '22px',
                            background: account.m === 'g' ? '#fff' : 'var(--accbg)',
                            color: account.m === 'g' ? '#4285f4' : 'var(--acc)',
                            borderColor: account.m === 'g' ? 'var(--line)' : 'transparent',
                          }}
                        >
                          {account.m === 'g' ? 'G' : Array.from(linkedDisplayName || '?')[0]}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">
                            {account.g}
                          </div>
                          <div style={{ color: 'var(--ok)', fontSize: '13px', marginTop: '2px' }}>
                            {t.linked}
                          </div>
                        </div>
                      </div>

                      <div className="sync">
                        <span className="sub">{t.synced}</span>
                        <button
                          className="chip"
                          style={{ flex: 'none' }}
                          onClick={() => triggerToast(t.syncToastTitle, t.syncToastBody)}
                        >
                          {t.syncNow}
                        </button>
                      </div>

                      <button
                        className="ghost danger"
                        style={{ width: '100%', marginTop: '14px' }}
                        onClick={handleUnlink}
                      >
                        {t.signOut}
                      </button>
                      <div className="sub" style={{ marginTop: '12px' }}>
                        {t.linkNoteSignedIn}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="chips">
                        {[
                          ['in', t.signIn],
                          ['up', t.newAccount],
                        ].map(([modeVal, label]) => (
                          <button
                            key={modeVal}
                            className={`chip ${authMode === modeVal ? 'on' : ''}`}
                            onClick={() => {
                              setAuthMode(modeVal as any);
                              setAuthError('');
                              setAuthInfo('');
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {authMode === 'up' && (
                        <div className="row" style={{ marginTop: '10px' }}>
                          <input
                            type="text"
                            placeholder={t.namePlaceholder}
                            autoComplete="name"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr', textAlign: 'start' }}
                          />
                        </div>
                      )}

                      <div className="row" style={{ marginTop: '10px' }}>
                        <input
                          type="email"
                          placeholder={t.emailPlaceholder}
                          autoComplete="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                        />
                      </div>

                      <div className="row" style={{ marginTop: '10px' }}>
                        <input
                          type="password"
                          placeholder={t.passwordPlaceholder}
                          autoComplete={authMode === 'up' ? 'new-password' : 'current-password'}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                        />
                      </div>

                      {authError && (
                        <div className="danger" style={{ fontSize: '13px', marginTop: '8px' }}>
                          {authError}
                        </div>
                      )}

                      {authInfo && (
                        <div style={{ color: 'var(--ok)', fontSize: '13px', marginTop: '8px' }}>
                          {authInfo}
                        </div>
                      )}

                      <button style={{ width: '100%', marginTop: '12px' }} onClick={handleAuthSubmit}>
                        {authMode === 'up' ? t.createAccountBtn : t.signIn}
                      </button>

                      {authMode === 'in' && (
                        <button
                          className="linkbtn"
                          onClick={() => {
                            if (!EMAIL_RE.test(authEmail.trim())) {
                              setAuthError(t.invalidEmail);
                            } else {
                              setAuthError('');
                              setAuthInfo(t.previewResetNote);
                            }
                          }}
                        >
                          {t.forgotPassword}
                        </button>
                      )}

                      <div className="or">{t.or}</div>

                      <button className="ghost gbtn" onClick={handleGoogleAuth}>
                        <span
                          className="badge"
                          style={{
                            width: '24px',
                            height: '24px',
                            fontSize: '13px',
                            background: '#fff',
                            color: '#4285f4',
                          }}
                        >
                          G
                        </span>
                        <span>{t.continueWithGoogle}</span>
                      </button>

                      <div className="sub" style={{ marginTop: '12px' }}>
                        {t.previewAuthNote}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Main Settings Overview */
            <>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="av">
                    {linkedDisplayName ? (
                      Array.from(linkedDisplayName)[0]
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {linkedDisplayName && (
                      <div
                        style={{
                          fontSize: '17px',
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.hello}{' '}
                        <span style={{ color: 'var(--acc)' }} dir="auto">
                          {linkedDisplayName}
                        </span>
                      </div>
                    )}
                    <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                      {t.accountLabel}
                      {isLinked ? (
                        <>
                          :{' '}
                          <span dir="auto" style={{ color: 'var(--text)' }}>
                            {account.g}
                          </span>
                        </>
                      ) : (
                        ''
                      )}
                    </div>
                  </div>
                </div>
                <div className="sub" style={{ marginTop: '10px' }}>
                  {isLinked
                    ? t.deviceAndAccountSaved(history.length)
                    : t.deviceOnlySaved(history.length)}
                </div>
              </div>

              <div className="card">
                <b>{t.settingsTitle}</b>

                {/* 1. Font Row */}
                <button
                  className="srow ghost"
                  onClick={() => {
                    setHSub('font');
                    setFOpen(false);
                    setSOpen(false);
                  }}
                >
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7" />
                      <line x1="9" y1="20" x2="15" y2="20" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                    <span>{t.subTitles.font}</span>
                  </span>
                  <span className="v">
                    {fontFamily || t.defaultLabel}
                    <span style={{ display: 'inline-flex', transform: rowChevronTransform }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* 2. Theme Row */}
                <button className="srow ghost" onClick={() => setHSub('theme')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r="1" />
                      <circle cx="17.5" cy="10.5" r="1" />
                      <circle cx="8.5" cy="7.5" r="1" />
                      <circle cx="6.5" cy="12.5" r="1" />
                      <path d="M12 2a10 10 0 100 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2H18a4 4 0 004-4c0-5-4.5-9-10-9z" />
                    </svg>
                    <span>{t.subTitles.theme}</span>
                  </span>
                  <span className="v">
                    {TH_LABELS[lang][theme]}
                    <span style={{ display: 'inline-flex', transform: rowChevronTransform }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* 3. Notifications Row */}
                <button className="srow ghost" onClick={() => setHSub('notif')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.7 21a2 2 0 01-3.4 0" />
                    </svg>
                    <span>{t.notificationsTitle}</span>
                  </span>
                  <span className="v">
                    {motOn ? <span style={{ color: 'var(--ok)' }}>{t.notifOnBadge}</span> : ''}
                    <span style={{ display: 'inline-flex', transform: rowChevronTransform }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* 4. Link Row */}
                <button className="srow ghost" onClick={() => setHSub('link')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span>{t.subTitles.link}</span>
                  </span>
                  <span className="v">
                    {isLinked ? <span style={{ color: 'var(--ok)' }}>{t.linked}</span> : ''}
                    <span style={{ display: 'inline-flex', transform: rowChevronTransform }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* 5. Language Row */}
                <button className="srow ghost" onClick={() => setHSub('lang')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>{t.subTitles.lang}</span>
                  </span>
                  <span className="v">
                    {lang === 'ar' ? 'العربية' : 'English'}
                    <span style={{ display: 'inline-flex', transform: rowChevronTransform }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className="ghost"
                    style={{ width: '100%' }}
                    onClick={() => setTourStep(0)}
                  >
                    {t.replayTour}
                  </button>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <button
                    className="ghost danger"
                    id="wipe"
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (!wipeArm) {
                        setWipeArm(true);
                        setTimeout(() => setWipeArm(false), 3000);
                      } else {
                        setWipeArm(false);
                        setHistory([]);
                        triggerToast(t.historyLabel, t.historyCleared);
                      }
                    }}
                  >
                    {wipeArm ? t.confirmClearHistory : t.clearHistory}
                  </button>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="ghost danger"
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (!wipeAllArm) {
                        setWipeAllArm(true);
                        setTimeout(() => setWipeAllArm(false), 3000);
                      } else {
                        setWipeAllArm(false);
                        try {
                          [
                            'tanzeelati-theme',
                            'font-v1',
                            'link-v1',
                            'tanzeelati-commit-sha',
                            'tanzeelati-lang',
                            'lang-v1',
                            'mot-on',
                            'mot-min',
                            'dev-notif',
                          ].forEach((k) => localStorage.removeItem(k));
                        } catch {}
                        setHistory([]);
                        triggerToast(t.erasedToastTitle, t.erasedToastBody);
                        setTimeout(() => window.location.reload(), 800);
                      }
                    }}
                  >
                    {wipeAllArm ? t.confirmClearHistory : t.eraseAllData}
                  </button>
                </div>
              </div>

              <div className="card">
                <b>{t.aboutTitle}</b>
                <div className="sub" style={{ marginTop: '8px' }}>
                  {t.aboutDesc}
                </div>
                <div className="about-foot">
                  <span className="sub">{t.versionLabel(APP_VERSION)}</span>
                  <button
                    type="button"
                    className="upd-btn"
                    onClick={() => checkForUpdates(true)}
                  >
                    <svg
                      className={updateStatus === 'checking' ? 'upd-spin' : ''}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                    <span>{t.checkUpdatesBtn}</span>
                    {updateStatus === 'available' && <span className="upd-btn-dot" aria-hidden="true"></span>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="note">{t.previewNote}</p>
      </main>

      {/* Floating Bottom Dock (#dock) */}
      <div id="dock">
        <div id="nav" role="tablist">
          <button
            id="tD"
            className={curTab === 'D' ? 'on' : ''}
            aria-label={t.navDownload}
            role="tab"
            aria-selected={curTab === 'D'}
            onClick={() => switchTab('D')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
            </svg>
            <span className="tn">{t.navDownload}</span>
          </button>

          <button
            id="tS"
            className={curTab === 'S' ? 'on' : ''}
            aria-label={t.navHistory}
            role="tab"
            aria-selected={curTab === 'S'}
            onClick={() => switchTab('S')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
              <path d="M3 3v5h5M12 7v5l3 2" />
            </svg>
            <span className="tn">{t.navHistory}</span>
          </button>
        </div>

        <button
          id="tH"
          className={curTab === 'H' ? 'on' : ''}
          aria-label={t.navMore}
          onClick={() => switchTab('H')}
        >
          {updateStatus === 'available' && <span className="tH-dot" aria-label={t.updateAvailableAria}></span>}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      {/* --- Clipboard Link Caught Drawer / Sheet --- */}
      {caughtVideo && (
        <div
          className="sheet-backdrop"
          onClick={() => setCaughtVideo(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="sheet-container"
            onClick={(e) => e.stopPropagation()}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="sheet-handle"></div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    background: 'var(--accbg)',
                    color: 'var(--acc)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {caughtVideo.platform}
                </span>
                <b style={{ fontSize: '17px', color: 'var(--text)' }}>
                  {t.caughtTitle}
                </b>
              </div>
              <button
                type="button"
                className="ghost"
                style={{ padding: '6px 10px', fontSize: '13px' }}
                onClick={() => setCaughtVideo(null)}
              >
                {t.close}
              </button>
            </div>

            {/* Video preview card */}
            <div className="card" style={{ padding: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="thumb" style={{ width: '90px', height: '52px' }} aria-hidden="true"></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: '14px', display: 'block', lineHeight: '1.3' }}>
                    {caughtVideo.title}
                  </b>
                  <span className="sub" style={{ fontSize: '12px', marginTop: '2px', display: 'block' }}>
                    {caughtVideo.author} · {caughtVideo.duration}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--line)',
                  fontSize: '12px',
                  color: 'var(--mute)',
                  direction: 'ltr',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <code>{caughtVideo.url}</code>
              </div>
            </div>

            {/* Selection: Video or Audio */}
            <div style={{ marginBottom: '12px' }}>
              <label className="t" style={{ fontSize: '14px', marginBottom: '6px' }}>
                {t.howToDownload}
              </label>
              <div className="mt" data-m={caughtMode} role="tablist">
                <span className="pill"></span>
                <button
                  className={caughtMode === 'video' ? 'on' : ''}
                  type="button"
                  onClick={() => {
                    setCaughtMode('video');
                    setCaughtQuality(OPTIONS.video[0][0]);
                  }}
                >
                  {t.fullVideo}
                </button>
                <button
                  className={caughtMode === 'audio' ? 'on' : ''}
                  type="button"
                  onClick={() => {
                    setCaughtMode('audio');
                    setCaughtQuality(OPTIONS.audio[0][0]);
                  }}
                >
                  {t.audioExtractOnly}
                </button>
              </div>
            </div>

            {/* Selection: Quality Picker Grid */}
            <div>
              <label className="t" style={{ fontSize: '14px', marginBottom: '6px' }}>
                {t.whichQuality}
              </label>
              <div className="q-grid">
                {OPTIONS[caughtMode].map(([keyVal, label, desc, size]) => (
                  <div
                    key={keyVal}
                    className={`q-opt ${caughtQuality === keyVal ? 'on' : ''}`}
                    onClick={() => setCaughtQuality(keyVal)}
                  >
                    <b>{label}</b>
                    <span>{desc}</span>
                    <span style={{ fontWeight: 600, color: 'var(--acc)', marginTop: '4px' }}>
                      {size}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="go"
                style={{ margin: 0, padding: '13px' }}
                onClick={handleDownloadFromCaught}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
                </svg>
                <span>{t.downloadNowQuality}</span>
              </button>

              <button
                type="button"
                className="ghost"
                style={{ width: '100%', padding: '10px' }}
                onClick={handleOpenCaughtInApp}
              >
                {t.openInDownloadTab}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- App Update Bottom Sheet (bilingual ar/en + exact match to إنجازاتي) --- */}
      {updateDialogOpen && (
        <div
          className="sheet-backdrop"
          style={{ zIndex: 200 }}
          onClick={() => {
            if (updateStatus !== 'updating') setUpdateDialogOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="upd-sheet" onClick={(e) => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {updateStatus === 'checking' && (
              <>
                <div className="upd-glow" aria-hidden="true">
                  <svg
                    className="upd-spin"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </div>
                <div className="upd-pill">{t.updateCheckingPill}</div>
                <h3>{t.updateCheckingTitle}</h3>
                <p style={{ marginBottom: 0 }}>{t.updateCheckingDesc}</p>
              </>
            )}

            {updateStatus === 'latest' && (
              <>
                <div className="upd-glow ok" aria-hidden="true">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </div>
                <div className="upd-pill ok">{t.updateLatestPill}</div>
                <h3>{t.updateLatestTitle}</h3>
                <p>
                  {t.updateLatestDescBefore}
                  <span style={{ color: 'var(--acc)', fontWeight: 700 }}>{APP_VERSION}</span>
                  {t.updateLatestDescAfter}
                </p>
                <div className="upd-sheet-actions">
                  <button
                    type="button"
                    className="go"
                    onClick={() => setUpdateDialogOpen(false)}
                  >
                    {t.updateLatestBtn}
                  </button>
                </div>
              </>
            )}

            {updateStatus === 'available' && updateInfo && (
              <>
                <div className="upd-glow" aria-hidden="true">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
                  </svg>
                </div>
                <div className="upd-pill">{t.updateAvailPill}</div>
                <h3>{t.updateAvailTitle}</h3>
                <p style={{ marginBottom: '14px' }}>
                  {t.updateAvailVersionPrefix}
                  <span style={{ color: 'var(--acc)', fontWeight: 700 }}>{updateInfo.version}</span>
                  ) — {activeUpdateTitle}
                </p>

                <div className="dlg-features">
                  <div className="dlg-features-h">{t.updateFeaturesHeading}</div>
                  <ul>
                    {activeUpdateFeatures.map((feat, idx) => (
                      <li key={idx}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="upd-sheet-actions">
                  <button type="button" className="go" onClick={applyAppUpdate}>
                    {t.updateNowBtn}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    style={{ width: '100%', padding: '11px' }}
                    onClick={() => setUpdateDialogOpen(false)}
                  >
                    {t.laterBtn}
                  </button>
                </div>
              </>
            )}

            {updateStatus === 'updating' && (
              <>
                <div className="upd-glow" aria-hidden="true">
                  <svg
                    className="upd-spin"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </div>
                <div className="upd-pill">{t.updateUpdatingPill(Math.floor(updateProgress))}</div>
                <h3>{t.updateUpdatingTitle}</h3>
                <div className="bar" style={{ height: '12px', margin: '6px 0 14px' }}>
                  <div className="fill run" style={{ width: `${updateProgress}%` }}></div>
                </div>
                <p style={{ marginBottom: 0 }}>{t.updateUpdatingDesc}</p>
              </>
            )}

            {updateStatus === 'error' && (
              <>
                <div className="upd-glow err" aria-hidden="true">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="upd-pill err">{t.updateErrorPill}</div>
                <h3>{t.updateErrorTitle}</h3>
                <p>{t.updateErrorDesc}</p>
                <div className="upd-sheet-actions">
                  <button type="button" className="go" onClick={() => checkForUpdates(true)}>
                    {t.retryBtn}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    style={{ width: '100%', padding: '11px' }}
                    onClick={() => setUpdateDialogOpen(false)}
                  >
                    {t.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- Replayable Intro Tour Dialog --- */}
      {tourStep >= 0 && (
        <div className="dlg-backdrop" onClick={() => setTourStep(-1)} role="dialog" aria-modal="true">
          <div className="dlg-card" onClick={(e) => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <h3 className="dlg-title">{t.tourSteps[tourStep][0]}</h3>
            <span className="dlg-ver">
              {tourStep + 1} / {t.tourSteps.length}
            </span>
            <p className="dlg-desc">{t.tourSteps[tourStep][1]}</p>
            <div className="dlg-actions">
              <button
                type="button"
                onClick={() => (tourStep >= t.tourSteps.length - 1 ? setTourStep(-1) : setTourStep(tourStep + 1))}
              >
                {tourStep >= t.tourSteps.length - 1 ? t.tourStart : t.tourNext}
              </button>
              {tourStep < t.tourSteps.length - 1 && (
                <button type="button" className="ghost" onClick={() => setTourStep(-1)}>
                  {t.tourSkip}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification (.nbn) */}
      {toastMsg && (
        <div className="nbn">
          <div className="ni">
            {toastMsg.icon === 'bell' ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <b>{toastMsg.title}</b>
            <span className="t">{toastMsg.body}</span>
          </div>
        </div>
      )}
    </div>
  );
}
