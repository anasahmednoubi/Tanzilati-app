import React, { useState, useEffect, useRef } from 'react';

// Quality options dictionary matching user HTML
const OPTIONS = {
  video: [
    ['best', 'أفضل جودة متاحة', 'MP4 · 1080p / 60fps', '~184 MB'],
    ['1080', '1080p (Full HD)', 'MP4 · عالي الوضوح', '~145 MB'],
    ['720', '720p (HD)', 'MP4 · جودة متوسطة', '~92 MB'],
    ['480', '480p', 'MP4 · موفر للبيانات', '~45 MB'],
    ['360', '360p (أقل حجم)', 'MP4 · حجم صغير جداً', '~22 MB'],
  ],
  audio: [
    ['mp3-320', 'MP3 – جودة عالية (320 kbps)', 'MP3 · أنقى صوت', '~29 MB'],
    ['mp3-192', 'MP3 – جودة متوسطة (192 kbps)', 'MP3 · جودة معيارية', '~18 MB'],
    ['m4a', 'M4A – بدون إعادة ضغط', 'M4A / AAC أصلي', '~16 MB'],
    ['opus', 'Opus – أصغر حجم', 'Opus · فائق الخفة', '~11 MB'],
  ],
};

const HINTS = {
  video: 'يُحفظ الفيديو بصيغة MP4 مع الصوت.',
  audio: 'يُستخرج الصوت فقط ويُحفظ كملف صوتي.',
};

const ACC: Record<string, [string, string]> = {
  green: ['#059669', 'أخضر'],
  violet: ['#7c3aed', 'بنفسجي'],
  orange: ['#ea580c', 'برتقالي'],
  blue: ['#2563eb', 'أزرق'],
  pink: ['#db2777', 'وردي'],
};

const FG: [string, string[]][] = [
  [
    'خطوط عربية',
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
    'خطوط لاتينية',
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

const SZ: [number, string][] = [
  [0.8, 'صغير جدًا'],
  [0.9, 'صغير'],
  [1, 'متوسط'],
  [1.15, 'كبير'],
  [1.3, 'كبير جدًا'],
  [1.5, 'ضخم'],
];

const TH_L: Record<string, string> = {
  auto: 'تلقائي',
  light: 'فاتح',
  dark: 'داكن',
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface HistoryEntry {
  id: string;
  n: string;
  a: boolean;
  fresh?: boolean;
}

interface CaughtVideoInfo {
  url: string;
  title: string;
  author: string;
  duration: string;
  platform: string;
}

export default function App() {
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
  const [defMode, setDefMode] = useState<'video' | 'audio'>('video');
  const [qv, setQv] = useState<string>(OPTIONS.video[0][0]);
  const [ddOpen, setDdOpen] = useState(false);
  const [savePath, setSavePath] = useState('~/Downloads');
  const [isChangingPath, setIsChangingPath] = useState(false);

  // Video Details in Main Card
  const [currentVideoTitle, setCurrentVideoTitle] = useState('شرح أساسيات البرمجة للمبتدئين');
  const [currentVideoAuthor, setCurrentVideoAuthor] = useState('قناة تجريبية');
  const [currentVideoDuration, setCurrentVideoDuration] = useState('12:48');

  // Simulated Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedText, setSpeedText] = useState('السرعة: —');
  const [etaText, setEtaText] = useState('المتبقي: —');
  const [stateText, setStateText] = useState('جاهز للتحميل');
  const [resText, setResText] = useState('');
  const [showRes, setShowRes] = useState(false);
  const timerRef = useRef<number | null>(null);

  // History List
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: 'd1', n: 'محاضرة الشبكات – الجزء الثاني.mp4', a: false },
    { id: 'd2', n: 'مقطع صوتي للمراجعة.mp3', a: true },
  ]);

  // Settings Sub-Page: null (main settings) | 'font' | 'theme' | 'dl' | 'link'
  const [hSub, setHSub] = useState<'font' | 'theme' | 'dl' | 'link' | null>(null);
  const [wipeArm, setWipeArm] = useState(false);

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
  const [toastMsg, setToastMsg] = useState<{ title: string; body: string } | null>(null);

  // --- Clipboard Catcher State ---
  const [caughtVideo, setCaughtVideo] = useState<CaughtVideoInfo | null>(null);
  const [caughtMode, setCaughtMode] = useState<'video' | 'audio'>('video');
  const [caughtQuality, setCaughtQuality] = useState<string>(OPTIONS.video[0][0]);
  const lastClipboardRef = useRef<string>('');

  // --- Touch Swipe State ---
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Helper to resolve realistic metadata for any detected URL
  const parseVideoMetadata = (targetUrl: string): CaughtVideoInfo => {
    const lower = targetUrl.toLowerCase();
    let platform = 'فيديو';
    let title = 'شرح أساسيات البرمجة للمبتدئين';
    let author = 'قناة تجريبية';
    let duration = '12:48';

    if (lower.includes('tiktok.com')) {
      platform = 'تيك توك';
      title = 'أسرار وحيل البرمجة والذكاء الاصطناعي 2026';
      author = 'حساب تيك توك تقني';
      duration = '00:54';
    } else if (lower.includes('instagram.com')) {
      platform = 'إنستغرام';
      title = 'ريلز: نصائح سريعة للمطورين والمصممين';
      author = 'Instagram Creator';
      duration = '01:15';
    } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
      platform = 'منصة X';
      title = 'مقطع إخباري تقني حول ثورة الويب';
      author = 'أخبار التقنية';
      duration = '02:30';
    } else if (lower.includes('podcast') || lower.includes('audio') || lower.includes('sound')) {
      platform = 'صوتيات';
      title = 'بودكاست: مستقبل التطبيقات والبرمجيات';
      author = 'بودكاست المعرفة';
      duration = '28:40';
    } else if (lower.includes('vimeo')) {
      platform = 'Vimeo';
      title = 'وثائقي الطبيعة وسحر المحيطات بجودة 4K';
      author = 'Earth Studios';
      duration = '16:20';
    } else if (!lower.includes('demo') && lower.length > 15) {
      platform = 'مقطع فيديو';
      title = 'فيديو: ' + targetUrl.replace(/https?:\/\/(www\.)?/, '').slice(0, 36) + '...';
      author = 'محتوى مستخرج';
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
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        if (!silent) triggerToast('تنبيه', 'خاصية قراءة الحافظة غير مفعلة في هذا المتصفح.');
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
          const info = parseVideoMetadata(text);
          setCaughtVideo(info);
          setCaughtMode('video');
          setCaughtQuality(OPTIONS.video[0][0]);
          triggerToast('تم رصد رابط!', `تم التقاط: ${info.title.slice(0, 24)}...`);
        } else if (!silent) {
          const info = parseVideoMetadata(text);
          setCaughtVideo(info);
        }
      } else if (!silent) {
        triggerToast('الحافظة', 'لم يتم العثور على رابط فيديو في الحافظة حالياً.');
      }
    } catch {
      if (!silent) {
        // Fallback for sandboxed iframe
        const sample = 'https://www.youtube.com/watch?v=prog-basics-2026';
        lastClipboardRef.current = sample;
        const info = parseVideoMetadata(sample);
        setCaughtVideo(info);
        triggerToast('الحافظة', 'تم فحص الحافظة وعرض الفيديو المكتشف.');
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
    const info = parseVideoMetadata(sampleUrl);
    setCaughtVideo(info);
    setCaughtMode('video');
    setCaughtQuality(OPTIONS.video[0][0]);
    triggerToast('📋 رصد رابط جديد', `تم التقاط رابط ${info.platform} من الحافظة!`);
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
      root.style.setProperty('--ab', ACC[accKey][0]);
    }
  }, [accKey]);

  // Tab Switcher with Direction
  const switchTab = (nextTab: 'D' | 'S' | 'H') => {
    if (nextTab === curTab) return;
    const tabOrder = ['D', 'S', 'H'];
    const dir = tabOrder.indexOf(nextTab) > tabOrder.indexOf(curTab) ? 'in-l' : 'in-r';
    setTabDirection(dir);
    setCurTab(nextTab);
    if (nextTab === 'H') setHSub(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Touch Swipe Handlers (RTL aware)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Ignore swipe if inside input or if modal open
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('.sheet-container')) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Minimum distance & horizontal bias
    if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      // In RTL:
      // deltaX < 0: finger dragged left -> advance to next tab (D -> S -> H)
      // deltaX > 0: finger dragged right -> return to previous tab (H -> S -> D)
      if (deltaX < 0) {
        if (curTab === 'D') switchTab('S');
        else if (curTab === 'S') switchTab('H');
      } else {
        if (curTab === 'H') switchTab('S');
        else if (curTab === 'S') switchTab('D');
      }
    }
  };

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
      const parsed = parseVideoMetadata(url);
      setCurrentVideoTitle(parsed.title);
      setCurrentVideoAuthor(parsed.author);
      setCurrentVideoDuration(parsed.duration);
      setIsRevealed(true);
      setIsFetching(false);
    }, 700);
  };

  // Download simulation
  const startDownloadSimulation = (fileTitle: string, isAudio: boolean, formatKey: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowRes(false);
    setIsDownloading(true);
    setStateText(isAudio ? 'جاري استخراج الصوت…' : 'جاري التحميل…');
    let p = 0;

    timerRef.current = window.setInterval(() => {
      p = Math.min(100, p + 0.8 + Math.random() * 2.2);
      setProgress(p);
      setSpeedText(`السرعة: ${(3 + Math.random() * 2).toFixed(1)} MB/s`);
      setEtaText(`المتبقي: ${Math.max(1, Math.round((100 - p) / 7))} ث`);

      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsDownloading(false);
        setStateText('اكتمل التحميل');
        setEtaText('المتبقي: 0 ث');
        setResText('تم حفظ الملف في Downloads ✅');
        setShowRes(true);

        const ext = isAudio ? formatKey.split('-')[0] : 'mp4';
        const newEntry: HistoryEntry = {
          id: uid(),
          n: `${fileTitle.slice(0, 30)}.${ext}`,
          a: isAudio,
          fresh: true,
        };
        setHistory((prev) => [newEntry, ...prev]);
        triggerToast('اكتمل التحميل', `تم حفظ ${fileTitle.slice(0, 20)} بنجاح`);
      }
    }, 120);
  };

  const handleDownloadToggle = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsDownloading(false);
      setStateText('تم الإلغاء');
      setSpeedText('السرعة: —');
      setEtaText('المتبقي: —');
      return;
    }
    startDownloadSimulation(currentVideoTitle, mode === 'audio', qv);
  };

  // Apply and start download directly from Caught Video Sheet
  const handleDownloadFromCaught = () => {
    if (!caughtVideo) return;
    setUrl(caughtVideo.url);
    setCurrentVideoTitle(caughtVideo.title);
    setCurrentVideoAuthor(caughtVideo.author);
    setCurrentVideoDuration(caughtVideo.duration);
    setIsRevealed(true);
    setMode(caughtMode);
    setQv(caughtQuality);
    setCaughtVideo(null);
    switchTab('D');
    // Launch download immediately
    startDownloadSimulation(caughtVideo.title, caughtMode === 'audio', caughtQuality);
  };

  // Just load the caught video into the input
  const handleOpenCaughtInApp = () => {
    if (!caughtVideo) return;
    setUrl(caughtVideo.url);
    setCurrentVideoTitle(caughtVideo.title);
    setCurrentVideoAuthor(caughtVideo.author);
    setCurrentVideoDuration(caughtVideo.duration);
    setIsRevealed(true);
    setMode(caughtMode);
    setQv(caughtQuality);
    setCaughtVideo(null);
    switchTab('D');
  };

  const triggerToast = (title: string, body: string) => {
    setToastMsg({ title, body });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.title === title ? null : prev));
    }, 3500);
  };

  const handleThemeToggle = () => {
    setSpinThm(true);
    setTimeout(() => setSpinThm(false), 550);
    setThemeState((prev) => {
      const isDark = prev === 'dark' || (prev === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      return isDark ? 'light' : 'dark';
    });
  };

  // Account handlers
  const handleAuthSubmit = () => {
    const e = authEmail.trim();
    setAuthInfo('');
    if (!EMAIL_RE.test(e)) {
      setAuthError('اكتب بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('كلمة المرور 6 أحرف على الأقل.');
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
    triggerToast('الحساب', authMode === 'up' ? 'تم إنشاء الحساب' : 'تم تسجيل الدخول');
  };

  const handleGoogleAuth = () => {
    const accObj = { g: 'Google User', n: 'مستخدم جوجل', m: 'g' as const };
    setAccount(accObj);
    try {
      localStorage.setItem('link-v1', JSON.stringify(accObj));
    } catch {}
    triggerToast('الحساب', 'تم الربط بجوجل');
  };

  const handleUnlink = () => {
    setAccount({});
    try {
      localStorage.removeItem('link-v1');
    } catch {}
    triggerToast('الحساب', 'تم تسجيل الخروج');
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

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-screen">
      <main>
        {/* Header matching exact HTML */}
        <div className="hd">
          <div className="brand">
            <svg className="logo" width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="44"
                height="44"
                rx="13"
                fill="var(--lbg)"
                stroke="var(--lbd)"
                strokeWidth="1.2"
              />
              <circle
                cx="24"
                cy="25"
                r="13"
                fill="none"
                stroke="var(--lfg)"
                strokeOpacity=".28"
                strokeWidth="4"
              />
              <circle
                className="arc"
                cx="24"
                cy="25"
                r="13"
                fill="none"
                stroke="var(--lfg)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="61 82"
                transform="rotate(-90 24 25)"
              />
              <path
                d="M24 18v11M19.5 25l4.5 4.5 4.5-4.5"
                fill="none"
                stroke="var(--lfg)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1>تنزيلاتي</h1>
          </div>
          <button
            id="thm"
            className={spinThm ? 'spin' : ''}
            onClick={handleThemeToggle}
            aria-label="تبديل الوضع الليلي"
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

        <p className="sub lead">الصق الرابط، اختر الجودة، وحمّل.</p>

        {/* Quick Clipboard Detection Bar & Touch indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            className="clip-chip"
            onClick={() => checkClipboard(false)}
            title="فحص الحافظة تلقائياً لالتقاط روابط الفيديو"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <span>فحص رابط من الحافظة</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-[var(--mute)]">
            <span style={{ fontSize: '12px' }}>محاكاة نسخ:</span>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://tiktok.com/@tech/video/1029384756')}
            >
              تيك توك
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://youtube.com/watch?v=ai-web-2026')}
            >
              يوتيوب
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => simulateCopyLink('https://podcast.fm/tech-future-sound')}
            >
              صوت MP3
            </button>
          </div>
        </div>

        {/* Touch Swipe Dots Navigation Indicator */}
        <div className="swipe-dots" aria-label="مؤشر التبويب النشط (اسحب بالتاتش للتنقل)">
          <div className={`swipe-dot ${curTab === 'D' ? 'on' : ''}`} onClick={() => switchTab('D')}></div>
          <div className={`swipe-dot ${curTab === 'S' ? 'on' : ''}`} onClick={() => switchTab('S')}></div>
          <div className={`swipe-dot ${curTab === 'H' ? 'on' : ''}`} onClick={() => switchTab('H')}></div>
        </div>

        {/* Tab: Download (#pD) */}
        <div id="pD" className={`${curTab === 'D' ? '' : 'hide'} ${tabDirection}`}>
          <section className="card">
            <label className="t" htmlFor="url">
              رابط الفيديو
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
                {isFetching ? 'جاري الجلب…' : 'جلب'}
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
                فيديو
              </button>
              <button
                className={mode === 'audio' ? 'on' : ''}
                data-m="audio"
                role="tab"
                onClick={() => handleModeChange('audio')}
              >
                صوت فقط
              </button>
            </div>

            <label className="t" id="qLbl">
              الجودة
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
                  {OPTIONS[mode].map(([v, t]) => (
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
                      <span>{t}</span>
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
                    حفظ
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    الحفظ في <code>{savePath}</code>
                  </span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setIsChangingPath(true)}
                  >
                    تغيير
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
            <span id="goT">{isDownloading ? 'إلغاء' : 'تحميل'}</span>
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
              {resText}
            </div>
          </section>
        </div>

        {/* Tab: History (#pS) */}
        <div id="pS" className={`${curTab === 'S' ? '' : 'hide'} ${tabDirection}`}>
          <section className="card">
            <b style={{ fontSize: '18px' }}>التحميلات السابقة</b>
            <div className="sub" style={{ margin: '2px 0 6px' }}>
              {history.length} ملف
            </div>
            {history.length ? (
              history.map((h, i) => (
                <div key={h.id} className={`q ${h.fresh && i === 0 ? 'new' : ''}`}>
                  <div className="n">
                    <div className="ic">{h.a ? '♪' : '▶'}</div>
                    <span>{h.n}</span>
                  </div>
                  <span className="s">اكتمل</span>
                </div>
              ))
            ) : (
              <div className="empty">لا توجد تحميلات بعد. الصق رابطاً وابدأ.</div>
            )}
          </section>
        </div>

        {/* Tab: Settings/More (#pH) */}
        <div id="pH" className={`${curTab === 'H' ? '' : 'hide'} ${tabDirection}`}>
          {hSub ? (
            /* Settings Sub-Pages */
            <div>
              <div className="back">
                <button onClick={() => setHSub(null)} aria-label="رجوع">
                  <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <b>
                  {hSub === 'font' && 'الخط'}
                  {hSub === 'theme' && 'المظهر'}
                  {hSub === 'dl' && 'التحميل'}
                  {hSub === 'link' && 'ربط'}
                </b>
              </div>

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
                          {TH_L[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <b>لون التطبيق</b>
                    <div className="sw" role="radiogroup" aria-label="لون التطبيق">
                      {Object.keys(ACC).map((c) => (
                        <button
                          key={c}
                          className="dot"
                          style={{ '--c': ACC[c][0] } as React.CSSProperties}
                          role="radio"
                          aria-checked={accKey === c}
                          aria-label={ACC[c][1]}
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
                    شكل الخط
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
                      {fontFamily || 'الافتراضي'}
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
                        <span>الافتراضي</span>
                      </button>
                      {FG.map((g, gi) => (
                        <React.Fragment key={g[0]}>
                          <div className="fg">{g[0]}</div>
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
                    حجم الخط
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
                      {(SZ.find((x) => x[0] === fontSizeScale) || SZ[2])[1]} ·{' '}
                      {Math.round(fontSizeScale * 100)}%
                    </span>
                    <span style={{ display: 'inline-flex' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {sOpen && (
                    <div className="fpanel">
                      {SZ.map((x) => (
                        <button
                          key={x[0]}
                          className={`fi ${fontSizeScale === x[0] ? 'on' : ''}`}
                          style={{ fontSize: `${16 * x[0]}px` }}
                          onClick={() => {
                            setFontSizeScale(x[0]);
                            setSOpen(false);
                          }}
                        >
                          <span>{x[1]}</span>
                          <span>{Math.round(x[0] * 100)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-page: Download Mode */}
              {hSub === 'dl' && (
                <>
                  <div className="card">
                    <b>النوع الافتراضي</b>
                    <div className="chips" style={{ margin: '10px 0 0' }}>
                      {(['video', 'audio'] as const).map((m) => (
                        <button
                          key={m}
                          className={`chip ${defMode === m ? 'on' : ''}`}
                          onClick={() => {
                            setDefMode(m);
                            handleModeChange(m);
                          }}
                        >
                          {m === 'video' ? 'فيديو' : 'صوت فقط'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <b>مكان الحفظ</b>
                    <div className="dir" style={{ border: 0, paddingTop: '6px', marginTop: '6px' }}>
                      <span>
                        <code>{savePath}</code>
                      </span>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => setIsChangingPath(!isChangingPath)}
                      >
                        تغيير
                      </button>
                    </div>
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
                            مرتبط
                          </div>
                        </div>
                      </div>

                      <div className="sync">
                        <span className="sub">تمت المزامنة</span>
                        <button
                          className="chip"
                          style={{ flex: 'none' }}
                          onClick={() => triggerToast('المزامنة', 'تمت مزامنة البيانات')}
                        >
                          مزامنة الآن
                        </button>
                      </div>

                      <button
                        className="ghost danger"
                        style={{ width: '100%', marginTop: '14px' }}
                        onClick={handleUnlink}
                      >
                        تسجيل الخروج
                      </button>
                      <div className="sub" style={{ marginTop: '12px' }}>
                        يُحفظ سجل تنزيلاتك على حسابك، فيظهر على أي جهاز تفتح منه التطبيق بنفس الحساب.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="chips">
                        {[
                          ['in', 'تسجيل الدخول'],
                          ['up', 'حساب جديد'],
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
                            placeholder="الاسم (اختياري)"
                            autoComplete="name"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            style={{ direction: 'rtl', textAlign: 'start' }}
                          />
                        </div>
                      )}

                      <div className="row" style={{ marginTop: '10px' }}>
                        <input
                          type="email"
                          placeholder="البريد الإلكتروني"
                          autoComplete="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                        />
                      </div>

                      <div className="row" style={{ marginTop: '10px' }}>
                        <input
                          type="password"
                          placeholder="كلمة المرور"
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
                        {authMode === 'up' ? 'إنشاء الحساب' : 'تسجيل الدخول'}
                      </button>

                      {authMode === 'in' && (
                        <button
                          className="linkbtn"
                          onClick={() => {
                            if (!EMAIL_RE.test(authEmail.trim())) {
                              setAuthError('اكتب بريدًا إلكترونيًا صحيحًا.');
                            } else {
                              setAuthError('');
                              setAuthInfo('هذه معاينة: لا يُرسل بريد فعلي هنا.');
                            }
                          }}
                        >
                          نسيت كلمة المرور؟
                        </button>
                      )}

                      <div className="or">أو</div>

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
                        <span>المتابعة مع جوجل</span>
                      </button>

                      <div className="sub" style={{ marginTop: '12px' }}>
                        هذه معاينة: لا يتم التحقق من كلمة المرور هنا ولا تُحفظ، ويُحفظ البريد فقط لربط سجلّك.
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
                        أهلاً،{' '}
                        <span style={{ color: 'var(--acc)' }} dir="auto">
                          {linkedDisplayName}
                        </span>
                      </div>
                    )}
                    <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                      الحساب
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
                  {history.length} ملف —{' '}
                  {isLinked
                    ? 'سجلّك محفوظ على جهازك وعلى حسابك.'
                    : 'بياناتك محفوظة على جهازك فقط.'}
                </div>
              </div>

              <div className="card">
                <b>الإعدادات</b>

                {/* Font Row */}
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
                    <span>الخط</span>
                  </span>
                  <span className="v">
                    {fontFamily || 'الافتراضي'}
                    <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* Theme Row */}
                <button className="srow ghost" onClick={() => setHSub('theme')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r="1" />
                      <circle cx="17.5" cy="10.5" r="1" />
                      <circle cx="8.5" cy="7.5" r="1" />
                      <circle cx="6.5" cy="12.5" r="1" />
                      <path d="M12 2a10 10 0 100 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2H18a4 4 0 004-4c0-5-4.5-9-10-9z" />
                    </svg>
                    <span>المظهر</span>
                  </span>
                  <span className="v">
                    {TH_L[theme]}
                    <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* Download Row */}
                <button className="srow ghost" onClick={() => setHSub('dl')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
                    </svg>
                    <span>التحميل</span>
                  </span>
                  <span className="v">
                    {defMode === 'audio' ? 'صوت فقط' : 'فيديو'}
                    <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                {/* Link Row */}
                <button className="srow ghost" onClick={() => setHSub('link')}>
                  <span className="l">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span>ربط</span>
                  </span>
                  <span className="v">
                    {isLinked ? <span style={{ color: 'var(--ok)' }}>مرتبط</span> : ''}
                    <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </span>
                </button>

                <div style={{ marginTop: '14px' }}>
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
                        triggerToast('السجل', 'تم مسح سجل التحميلات بالكامل');
                      }
                    }}
                  >
                    {wipeArm ? 'اضغط مرة أخرى للتأكيد' : 'مسح سجل التحميلات'}
                  </button>
                </div>
              </div>

              <div className="card">
                <b>عن التطبيق</b>
                <div className="sub" style={{ marginTop: '8px' }}>
                  تنزيلاتي — أداة بسيطة لتحميل الفيديوهات أو استخراج الصوت منها.
                </div>
                <div className="sub" style={{ marginTop: '4px' }}>
                  الإصدار 1.0 · يدعم السحب بالتاتش ورصد الحافظة
                </div>
              </div>
            </>
          )}
        </div>

        <p className="note">نسخة لعرض الشكل فقط، والتقدم فيها محاكاة.</p>
      </main>

      {/* Floating Bottom Dock (#dock) */}
      <div id="dock">
        <div id="nav" role="tablist">
          <button
            id="tD"
            className={curTab === 'D' ? 'on' : ''}
            aria-label="تحميل"
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
            <span className="tn">تحميل</span>
          </button>

          <button
            id="tS"
            className={curTab === 'S' ? 'on' : ''}
            aria-label="السجل"
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
            <span className="tn">السجل</span>
          </button>
        </div>

        <button
          id="tH"
          className={curTab === 'H' ? 'on' : ''}
          aria-label="المزيد"
          onClick={() => switchTab('H')}
        >
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

      {/* --- Clipboard Link Caught Drawer / Sheet ("تبويب بالفيديو واحمله ازاي وبانهي جودة") --- */}
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
            dir="rtl"
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
                  رابط مكتشف في الحافظة 📋
                </b>
              </div>
              <button
                type="button"
                className="ghost"
                style={{ padding: '6px 10px', fontSize: '13px' }}
                onClick={() => setCaughtVideo(null)}
              >
                إغلاق
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

            {/* Selection: كيف أحمله؟ (فيديو أو صوت فقط) */}
            <div style={{ marginBottom: '12px' }}>
              <label className="t" style={{ fontSize: '14px', marginBottom: '6px' }}>
                كيف ترغب في تحميله؟
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
                  فيديو كامل
                </button>
                <button
                  className={caughtMode === 'audio' ? 'on' : ''}
                  type="button"
                  onClick={() => {
                    setCaughtMode('audio');
                    setCaughtQuality(OPTIONS.audio[0][0]);
                  }}
                >
                  استخراج صوت فقط
                </button>
              </div>
            </div>

            {/* Selection: بأي جودة؟ (Quality Picker Grid) */}
            <div>
              <label className="t" style={{ fontSize: '14px', marginBottom: '6px' }}>
                بأي جودة تريد الحفظ؟
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
                <span>تحميل الآن بهذه الجودة مباشرة</span>
              </button>

              <button
                type="button"
                className="ghost"
                style={{ width: '100%', padding: '10px' }}
                onClick={handleOpenCaughtInApp}
              >
                فتح ومراجعة في صفحة التحميل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification (.nbn) */}
      {toastMsg && (
        <div className="nbn">
          <div className="ni">
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
