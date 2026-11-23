export type AppLang = 'ar' | 'en';

export const OPTIONS_I18N: Record<
  AppLang,
  {
    video: [string, string, string, string][];
    audio: [string, string, string, string][];
  }
> = {
  ar: {
    video: [
      ['best', 'أفضل جودة متاحة', 'MP4 · أعلى دقة', '—'],
      ['1080', '1080p (Full HD)', 'MP4 · عالي الوضوح', '—'],
      ['720', '720p (HD)', 'MP4 · جودة متوسطة', '—'],
      ['480', '480p', 'MP4 · موفر للبيانات', '—'],
      ['360', '360p (أقل حجم)', 'MP4 · حجم صغير جداً', '—'],
    ],
    audio: [
      ['mp3-320', 'MP3 – جودة عالية \u200E(320 kbps)\u200E', 'MP3 · أنقى صوت', '—'],
      ['mp3-192', 'MP3 – جودة متوسطة \u200E(192 kbps)\u200E', 'MP3 · جودة معيارية', '—'],
      ['m4a', 'M4A – بدون إعادة ضغط', 'M4A / AAC أصلي', '—'],
      ['opus', 'Opus – أصغر حجم', 'Opus · فائق الخفة', '—'],
    ],
  },
  en: {
    video: [
      ['best', 'Best Available Quality', 'MP4 · Highest Resolution', '—'],
      ['1080', '1080p (Full HD)', 'MP4 · High Definition', '—'],
      ['720', '720p (HD)', 'MP4 · Standard Quality', '—'],
      ['480', '480p', 'MP4 · Data Saver', '—'],
      ['360', '360p (Smallest Size)', 'MP4 · Very Compact', '—'],
    ],
    audio: [
      ['mp3-320', 'MP3 – High Quality (320 kbps)', 'MP3 · Purest Audio', '—'],
      ['mp3-192', 'MP3 – Medium Quality (192 kbps)', 'MP3 · Standard Quality', '—'],
      ['m4a', 'M4A – Lossless Container', 'Original M4A / AAC', '—'],
      ['opus', 'Opus – Smallest Size', 'Opus · Ultra Light', '—'],
    ],
  },
};

export const ACC_LABELS: Record<string, { color: string; ar: string; en: string }> = {
  green: { color: '#059669', ar: 'أخضر', en: 'Green' },
  violet: { color: '#7c3aed', ar: 'بنفسجي', en: 'Violet' },
  orange: { color: '#ea580c', ar: 'برتقالي', en: 'Orange' },
  blue: { color: '#2563eb', ar: 'أزرق', en: 'Blue' },
  pink: { color: '#db2777', ar: 'وردي', en: 'Pink' },
};

export const SZ_I18N: [number, string, string][] = [
  [0.8, 'صغير جدًا', 'Extra Small'],
  [0.9, 'صغير', 'Small'],
  [1, 'متوسط', 'Medium'],
  [1.15, 'كبير', 'Large'],
  [1.3, 'كبير جدًا', 'Extra Large'],
  [1.5, 'ضخم', 'Huge'],
];

export const TH_LABELS: Record<AppLang, Record<'auto' | 'light' | 'dark', string>> = {
  ar: { auto: 'تلقائي', light: 'فاتح', dark: 'داكن' },
  en: { auto: 'Auto', light: 'Light', dark: 'Dark' },
};

export const UI_TEXT = {
  ar: {
    appName: 'تنزيلاتي',
    tagline: 'الصق الرابط، اختر الجودة، وحمّل.',
    toggleThemeAria: 'تبديل الوضع الليلي',
    checkClipboardBtn: 'فحص الحافظة',
    checkClipboardTitle: 'فحص الحافظة تلقائياً لالتقاط روابط الفيديو',
    pasteBtnLabel: 'لصق',
    clearUrlLabel: 'مسح الرابط',
    simulateCopy: 'جرّب:',
    tiktok: 'تيك توك',
    youtube: 'يوتيوب',
    audioSample: 'صوت MP3',
    swipeIndicatorAria: 'مؤشر التبويب النشط (اسحب بالتاتش للتنقل)',
    videoUrlLabel: 'رابط الفيديو',
    fetch: 'جلب',
    fetching: 'جاري الجلب…',
    sampleTitle: 'الصق أي رابط من يوتيوب أو تيك توك أو فيسبوك أو إنستغرام أو X',
    sampleAuthor: 'يدعم التنزيل الفعلي بصيغ MP4 و MP3',
    videoTab: 'فيديو',
    audioTab: 'صوت فقط',
    qualityLabel: 'الجودة',
    hintVideo: 'يُحفظ الفيديو بصيغة MP4 مع الصوت.',
    hintAudio: 'يُستخرج الصوت فقط ويُحفظ كملف صوتي.',
    saveIn: 'الحفظ في',
    change: 'تغيير',
    save: 'حفظ',
    download: 'تحميل',
    cancel: 'إلغاء',
    readyToDownload: 'جاهز للتحميل',
    cancelled: 'تم الإلغاء',
    downloading: 'جاري التحميل…',
    extractingAudio: 'جاري استخراج الصوت…',
    downloadComplete: 'اكتمل التحميل',
    speedLabel: 'السرعة:',
    etaLabel: 'المتبقي:',
    secUnit: 'ث',
    savedResult: 'تم تجهيز الملف وحفظه على جهازك',
    previewVideoBtn: 'معاينة الفيديو',
    hidePreviewBtn: 'إخفاء المعاينة',
    videoPreviewUnavailable: 'المعاينة المباشرة غير متاحة لهذا الرابط حالياً، ويمكنك التحميل مباشرة.',
    outputPreviewTitle: 'معاينة الملف الذي سيُحفظ على جهازك',
    outputFileNameLabel: 'اسم الملف',
    outputFormatLabel: 'الصيغة والجودة',
    outputRealSizeLabel: 'الحجم الفعلي',
    sizeAfterFetch: 'يظهر بعد جلب الرابط',
    completedToastTitle: 'اكتمل التحميل',
    completedToastBody: (name: string) => `بدأ حفظ ${name} على جهازك`,
    pasteUrlFirst: 'من فضلك الصق رابط الفيديو واضغط «جلب» أولاً.',
    fetchErrorBody: 'تعذر جلب معلومات هذا الرابط. تأكد أنه رابط فيديو عام وصحيح.',
    downloadErrorBody: 'تعذر إكمال التحميل لهذا الرابط، جرّب جودة أخرى أو رابطًا آخر.',
    fetchSuccessToast: 'تم جلب البيانات',
    fetchSuccessBody: (title: string) => `جاهز للتحميل: ${title}`,
    downloadingNowTitle: 'جاري التنزيل الآن',
    historyTitle: 'التحميلات السابقة',
    filesCount: (n: number) => `${n} ملف`,
    completedBadge: 'اكتمل',
    emptyHistory: 'لا توجد تحميلات بعد. الصق رابطاً وابدأ.',
    backAria: 'رجوع',
    subTitles: {
      font: 'الخط',
      theme: 'المظهر',
      lang: 'اللغة',
      link: 'ربط',
      notif: 'الإشعارات',
    },
    appColor: 'لون التطبيق',
    fontStyle: 'شكل الخط',
    fontSize: 'حجم الخط',
    defaultLabel: 'الافتراضي',
    arabicFonts: 'خطوط عربية',
    latinFonts: 'خطوط لاتينية (للإنجليزية والأرقام)',
    appLanguage: 'لغة التطبيق',
    languageHint: 'يتم تطبيق اللغة المختارة فوراً على جميع القوائم ومزايا التحديثات.',
    langArabic: 'العربية',
    langEnglish: 'English (الإنجليزية)',
    defaultType: 'النوع الافتراضي',
    saveLocation: 'مكان الحفظ',
    linked: 'مرتبط بجوجل',
    synced: 'تمت المزامنة سحابياً',
    syncing: 'جاري المزامنة…',
    syncedWithGoogle: 'متزامن مع حسابك في جوجل',
    syncHintSignIn: 'سجّل بجوجل لمزامنة تنزيلاتك عبر جميع أجهزتك',
    syncNow: 'مزامنة الآن',
    syncToastTitle: 'المزامنة السحابية',
    syncToastBody: 'تمت مزامنة سجل التنزيلات مع حسابك بنجاح',
    syncErrorBody: 'تعذر إكمال المزامنة السحابية. تحقق من الاتصال وحاول مجدداً.',
    signOut: 'تسجيل الخروج',
    signOutToast: 'تم تسجيل الخروج بنجاح',
    linkNoteSignedIn: 'يُحفظ سجل تنزيلاتك تلقائياً على حسابك في جوجل ويظهر فورياً على أي جهاز تسجل منه الدخول بنفس الحساب.',
    googleSignInTitle: 'مزامنة التنزيلات عبر حساب جوجل',
    googleSignInDesc: 'سجّل الدخول بحساب جوجل لحفظ سجل تنزيلاتك السابقة والجديدة سحابياً ومزامنتها تلقائياً بين هاتفك وأجهزتك الأخرى.',
    signingInGoogle: 'جاري تسجيل الدخول…',
    continueWithGoogle: 'المتابعة بحساب جوجل',
    googleAuthBlocked: 'تعذر فتح نافذة تسجيل الدخول بجوجل. يرجى السماح بالنوافذ المنبثقة والمحاولة مرة أخرى.',
    googleAuthCancelled: 'تم إلغاء تسجيل الدخول بحساب جوجل.',
    googleAuthFailed: 'تعذر تسجيل الدخول بحساب جوجل حالياً. حاول مرة أخرى.',
    accountToastTitle: 'حساب جوجل',
    googleUser: 'مستخدم جوجل',
    googleLinked: 'تم تسجيل الدخول ومزامنة سجل التنزيلات',
    hello: 'أهلاً،',
    accountLabel: 'الحساب',
    deviceAndAccountSaved: (n: number) => `${n} ملف — سجلّك محفوظ ومُتزامن مع حسابك في جوجل.`,
    deviceOnlySaved: (n: number) => `${n} ملف — بياناتك محفوظة على هذا الجهاز فقط.`,
    settingsTitle: 'الإعدادات',
    clearHistory: 'مسح سجل التحميلات',
    confirmClearHistory: 'اضغط مرة أخرى للتأكيد',
    historyLabel: 'السجل',
    historyCleared: 'تم مسح سجل التحميلات بالكامل',
    aboutTitle: 'عن التطبيق',
    aboutDesc: 'تنزيلاتي — أداة بسيطة لتحميل الفيديوهات أو استخراج الصوت منها.',
    versionLabel: (v: string) => `الإصدار ${v}`,
    checkUpdatesBtn: 'التحقق من التحديثات',
    shareCardTitle: 'مشاركة التطبيق مع الأصدقاء',
    shareCardDesc: 'شارك تنزيلاتي مع من تحب لحفظ الفيديوهات والصوتيات بسهولة.',
    shareBtn: 'مشاركة',
    shareSuccessToast: 'تمت المشاركة',
    shareCopiedToast: 'تم نسخ رابط التطبيق للمشاركة',
    feedbackTitle: 'شاركنا اقتراحاتك وأفكارك',
    feedbackSubtitle: 'رأيك يصنع الفارق في تطوير التطبيق!',
    feedbackDesc: 'يسعدني جداً سماع رأيك أو أي أفكار وملاحظات لتطوير التطبيق وجعله أفضل وأكثر فائدة لك:',
    feedbackEmail: 'anasahmednoubi@gmail.com',
    copyEmailBtn: 'نسخ البريد',
    emailCopiedTitle: 'تم النسخ',
    emailCopiedBody: 'تم نسخ البريد الإلكتروني بنجاح',
    previewNote: 'التحميل الفعلي عبر الخادم — يُحفظ الملف مباشرة في مجلد التنزيلات على جهازك.',
    navDownload: 'تحميل',
    navStatuses: 'الحالات',
    navHistory: 'السجل',
    navMore: 'المزيد',
    waTitle: 'حالات واتساب',
    waSubtitle: 'اقرأ ستوريهات الصور والفيديو من واتساب واحفظها مباشرة على جهازك.',
    waGrantTitle: 'ربط مجلد حالات واتساب',
    waGrantDesc: 'لقراءة الحالات الحالية على جهازك، امنح التطبيق إذن الوصول لمجلد الحالات مرة واحدة فقط.',
    waFolderPathHint: 'المسار المعتاد: Android / media / com.whatsapp / WhatsApp / Media / .Statuses',
    waConnectBtn: 'فتح حالات واتساب',
    waConnectBusinessBtn: 'واتساب للأعمال',
    waPickWebFolderBtn: 'اختيار مجلد الحالات (.Statuses)',
    waChangeFolderBtn: 'تغيير المجلد',
    waRefreshBtn: 'تحديث الحالات',
    waIncludeVideosTitle: 'تحميل ستوريهات الفيديو',
    waIncludeVideosDescOn: 'مفعّل — ستظهر حالات الفيديو ضمن القائمة وعند الحفظ الجماعي.',
    waIncludeVideosDescOff: 'متوقف — يُحفظ ويُعرض الصور فقط بدون تحميل الفيديوهات.',
    waFilterAll: 'الكل',
    waFilterPhotos: 'صور',
    waFilterVideos: 'فيديو',
    waCountSummary: (photos: number, videos: number) => `${photos} صورة · ${videos} فيديو`,
    waSaveBtn: 'حفظ',
    waSavedBadge: 'تم الحفظ',
    waSaveAllBtn: (n: number) => `حفظ الكل (${n})`,
    waSavePhotosOnlyBtn: (n: number) => `حفظ الصور فقط (${n})`,
    waPreviewTitle: 'معاينة الحالة',
    waEmptyTitle: 'لا توجد حالات مقروءة حالياً',
    waEmptyDesc: 'شاهد الحالات داخل تطبيق واتساب أولاً ثم اضغط «تحديث الحالات» لقراءتها هنا.',
    waVideosHiddenHint: 'خيار تحميل الفيديوهات متوقف حالياً. فعّل زر «تحميل ستوريهات الفيديو» بالأعلى لعرضها وتحميلها.',
    waBatchDialogTitle: 'تأكيد تحميل حالات الفيديو',
    waBatchDialogDesc: (photos: number, videos: number) =>
      `يوجد ${videos} فيديو و ${photos} صورة جاهزة للحفظ. هل تريد تحميل الفيديوهات أيضاً أم الصور فقط؟`,
    waBatchWithVideos: (total: number) => `تحميل الكل مع الفيديوهات (${total})`,
    waBatchPhotosOnly: (photos: number) => `حفظ الصور فقط (${photos})`,
    waVideoChoiceTitle: 'هذا الستوري فيديو',
    waVideoChoiceDesc: 'خيار تحميل الفيديوهات متوقف حالياً. هل تريد تفعيل تحميل الفيديوهات وحفظه الآن؟',
    waEnableAndSaveVideo: 'تفعيل وحفظ الفيديو',
    waSavedSingleToast: (name: string) => `تم حفظ الحالة: ${name}`,
    waSavedBatchToast: (n: number) => `تم حفظ ${n} حالة في التنزيلات`,
    waSaveErrorBody: 'تعذر حفظ هذه الحالة. تأكد من صلاحية المجلد وحاول مرة أخرى.',
    waAccessErrorBody: 'لم يتم منح إذن قراءة مجلد حالات واتساب.',
    waScanningLabel: 'جارٍ قراءة حالات واتساب…',
    waSavingBatchProgress: (done: number, total: number) => `جارٍ الحفظ (${done} / ${total})…`,
    waWebHint: 'على المتصفح، اختر مجلد الحالات (.Statuses) لقراءة الصور والفيديوهات الموجودة على جهازك.',
    updateAvailableAria: 'تحديث متاح',
    caughtTitle: 'رابط مكتشف في الحافظة',
    sharedTitle: 'رابط مشترك للتحميل',
    resolvingQualities: 'جارٍ جلب تفاصيل الفيديو والجودات المتاحة…',
    close: 'إغلاق',
    howToDownload: 'هل ترغب بتحميله فيديو أم صوت فقط؟',
    fullVideo: 'فيديو (MP4)',
    audioExtractOnly: 'صوت فقط (MP3)',
    whichQuality: 'حابب تحمّله بأي جودة؟',
    downloadNowQuality: 'تحميل الآن',
    openInDownloadTab: 'فتح في شاشة التحميل',
    clipboardTitle: 'الحافظة',
    pasteBtn: 'لصق',
    clipboardPastedText: 'تم لصق المحتوى من الحافظة',
    clipboardUnsupported: 'يرجى لصق الرابط في المربع أو الضغط على زر لصق.',
    clipboardEmpty: 'الحافظة فارغة حالياً أو لا تحتوي على رابط مدعوم.',
    clipboardFallback: 'تم فحص الحافظة وعرض الفيديو المكتشف.',
    linkDetectedToast: 'تم رصد رابط!',
    linkCaptured: (t: string) => `تم التقاط: ${t}...`,
    newLinkToast: 'رصد رابط جديد',
    platformCaptured: (p: string) => `تم التقاط رابط ${p} من الحافظة!`,
    warningTitle: 'تنبيه',
    // Update sheet strings
    updateCheckingPill: 'جارٍ الفحص',
    updateCheckingTitle: 'جارٍ التحقق من التحديثات...',
    updateCheckingDesc: 'يتم الآن الاتصال بـ GitHub لفحص آخر إصدار متوفر من تطبيق تنزيلاتي.',
    updateLatestToast: (v: string) => `تطبيقك محدّث بالفعل إلى آخر إصدار (${v})`,
    updateLatestPill: 'تطبيقك محدّث بالكامل',
    updateLatestTitle: 'أنت على آخر وأحدث إصدار بالفعل!',
    updateLatestDescBefore: 'تطبيقك يعمل بالإصدار الأخير (',
    updateLatestDescAfter: '). لا توجد أي تحديثات جديدة حاليًا، وجميع الميزات والتحسينات لديك محدّثة ومستقرة.',
    updateLatestBtn: 'رائع، شكرًا!',
    updateAvailToastTitle: 'تحديث جديد متاح',
    updateAvailToastBody: (v: string) => `الإصدار ${v} متاح الآن على GitHub`,
    updateAvailPill: 'يتوفر تحديث جديد',
    updateAvailTitle: 'تحديث جديد متاح الآن!',
    updateAvailVersionPrefix: 'يتوفر الإصدار الجديد (',
    updateFeaturesHeading: 'المميزات والتحسينات الجديدة:',
    updateNowBtn: 'تحديث التطبيق الآن',
    laterBtn: 'لاحقًا',
    updateUpdatingPill: (p: number) => `جارٍ التحديث · ${p}%`,
    updateUpdatingTitle: 'جارٍ تحديث التطبيق...',
    updateUpdatingDesc: 'يتم الآن تجهيز وتنزيل الإصدار الجديد من GitHub...',
    updateErrorPill: 'تعذر الفحص',
    updateErrorTitle: 'تعذر الاتصال بـ GitHub',
    updateErrorDesc: 'يرجى التأكد من اتصالك بالإنترنت ثم إعادة المحاولة للتحقق من وجود تحديثات جديدة.',
    retryBtn: 'إعادة المحاولة',
    updateDoneToastTitle: 'تم التحديث',
    updateDoneToastBody: (v: string) => `تم تجهيز التحديث ${v} بنجاح`,
    // Notifications, Tour, Erase All Data
    notificationsTitle: 'الإشعارات',
    notifOnBadge: 'مفعّلة',
    motivationalNotifications: 'إشعارات تحفيزية',
    motivationalDesc: 'رسائل تشجيعية تذكّرك بإنجاز تحميلاتك كل فترة.',
    notifInterval: 'الفترة بين كل إشعار',
    showDeviceNotif: 'إظهار الإشعارات على الجهاز',
    notifUnsupported: 'الإشعارات غير مدعومة في هذا المتصفح.',
    notifDenied: 'تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح.',
    notifError: 'تعذر تفعيل الإشعارات هنا. جرّب فتح الصفحة في المتصفح مباشرة.',
    notifActivated: 'تم تفعيل الإشعارات.',
    motReminderTitle: 'تذكير تحفيزي',
    motMsgs: [
      'خطوة صغيرة كل يوم تصنع فرقًا كبيرًا.',
      'لا تؤجل تحميل اليوم إلى الغد.',
      'استمر، أنت تتقدم أكثر مما تتصور.',
      'نظّم ملفاتك وأنجز بسرعة.',
    ],
    motIntervals: [
      [15, '15 دقيقة'],
      [30, '30 دقيقة'],
      [60, 'ساعة'],
      [180, '3 ساعات'],
    ] as [number, string][],
    replayTour: 'إعادة الجولة التعريفية',
    tourSteps: [
      ['الصق الرابط', 'الصق رابط الفيديو، أو انسخه ليلتقطه التطبيق تلقائيًا من الحافظة.'],
      ['اختر الجودة', 'اختر فيديو أو صوت فقط، ثم الجودة التي تناسبك.'],
      ['حمّل وتابع', 'اضغط تحميل وتابع التقدم، وستجد ملفاتك في تبويب السجل.'],
      ['تنقّل بالسحب', 'اسحب بإصبعك يمينًا أو يسارًا للتنقل بين التبويبات.'],
    ] as [string, string][],
    tourNext: 'التالي',
    tourStart: 'ابدأ',
    tourSkip: 'تخطي',
    eraseAllData: 'مسح جميع البيانات',
    erasedToastTitle: 'تم المسح',
    erasedToastBody: 'تم مسح جميع البيانات',
  },
  en: {
    appName: 'My Downloads',
    tagline: 'Paste link, choose quality, and download.',
    toggleThemeAria: 'Toggle dark mode',
    checkClipboardBtn: 'Check clipboard',
    checkClipboardTitle: 'Automatically scan clipboard for video links',
    pasteBtnLabel: 'Paste',
    clearUrlLabel: 'Clear URL',
    simulateCopy: 'Try:',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    audioSample: 'MP3 Audio',
    swipeIndicatorAria: 'Active tab indicator (swipe to navigate)',
    videoUrlLabel: 'Video URL',
    fetch: 'Fetch',
    fetching: 'Fetching…',
    sampleTitle: 'Paste any YouTube, TikTok, Facebook, Instagram, or X link',
    sampleAuthor: 'Real MP4 & MP3 download supported',
    videoTab: 'Video',
    audioTab: 'Audio Only',
    qualityLabel: 'Quality',
    hintVideo: 'Saves video as MP4 with audio.',
    hintAudio: 'Extracts audio only and saves as an audio file.',
    saveIn: 'Save to',
    change: 'Change',
    save: 'Save',
    download: 'Download',
    cancel: 'Cancel',
    readyToDownload: 'Ready to download',
    cancelled: 'Cancelled',
    downloading: 'Downloading…',
    extractingAudio: 'Extracting audio…',
    downloadComplete: 'Download complete',
    speedLabel: 'Speed:',
    etaLabel: 'Remaining:',
    secUnit: 's',
    savedResult: 'File ready and saved to your device',
    previewVideoBtn: 'Preview Video',
    hidePreviewBtn: 'Hide Preview',
    videoPreviewUnavailable: 'Live video preview is unavailable for this URL right now, but you can still download it.',
    outputPreviewTitle: 'File Saved-to-Device Preview',
    outputFileNameLabel: 'File Name',
    outputFormatLabel: 'Format & Quality',
    outputRealSizeLabel: 'Real Size',
    sizeAfterFetch: 'Shown after fetch',
    completedToastTitle: 'Download Complete',
    completedToastBody: (name: string) => `Saving ${name} to your device`,
    pasteUrlFirst: 'Please paste a video link and tap Fetch first.',
    fetchErrorBody: 'Could not extract info from this link. Make sure it is a valid public video URL.',
    downloadErrorBody: 'Could not complete download for this link. Try another quality or URL.',
    fetchSuccessToast: 'Metadata Loaded',
    fetchSuccessBody: (title: string) => `Ready to download: ${title}`,
    downloadingNowTitle: 'Downloading Now',
    historyTitle: 'Download History',
    filesCount: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    completedBadge: 'Done',
    emptyHistory: 'No downloads yet. Paste a link to get started.',
    backAria: 'Back',
    subTitles: {
      font: 'Font',
      theme: 'Appearance',
      lang: 'Language',
      link: 'Account',
      notif: 'Notifications',
    },
    appColor: 'Accent Color',
    fontStyle: 'Font Family',
    fontSize: 'Font Size',
    defaultLabel: 'Default',
    arabicFonts: 'Arabic Fonts (Arabic & Latin)',
    latinFonts: 'Latin Fonts',
    appLanguage: 'App Language',
    languageHint: 'Selected language applies immediately across menus and update release notes.',
    langArabic: 'العربية (Arabic)',
    langEnglish: 'English',
    defaultType: 'Default Format',
    saveLocation: 'Save Location',
    linked: 'Linked with Google',
    synced: 'Cloud Synced',
    syncing: 'Syncing…',
    syncedWithGoogle: 'Synced with your Google Account',
    syncHintSignIn: 'Sign in with Google to sync downloads across devices',
    syncNow: 'Sync Now',
    syncToastTitle: 'Cloud Sync',
    syncToastBody: 'Download history synced with your Google Account',
    syncErrorBody: 'Could not sync right now. Check your connection and try again.',
    signOut: 'Sign Out',
    signOutToast: 'Signed out',
    linkNoteSignedIn: 'Your download history is automatically saved to your Google Account and syncs across any device you sign in on.',
    googleSignInTitle: 'Sync Downloads with Google',
    googleSignInDesc: 'Sign in with your Google Account to back up previous and future downloads in the cloud and access your history on any device.',
    signingInGoogle: 'Signing in…',
    continueWithGoogle: 'Continue with Google',
    googleAuthBlocked: 'Google sign-in popup was blocked. Please allow popups and try again.',
    googleAuthCancelled: 'Google sign-in was cancelled.',
    googleAuthFailed: 'Could not sign in with Google right now. Please try again.',
    accountToastTitle: 'Google Account',
    googleUser: 'Google User',
    googleLinked: 'Signed in & download history synced',
    hello: 'Hello,',
    accountLabel: 'Account',
    deviceAndAccountSaved: (n: number) => `${n} ${n === 1 ? 'file' : 'files'} — Saved & synced with Google.`,
    deviceOnlySaved: (n: number) => `${n} ${n === 1 ? 'file' : 'files'} — Stored locally on this device only.`,
    settingsTitle: 'Settings',
    clearHistory: 'Clear Download History',
    confirmClearHistory: 'Tap again to confirm',
    historyLabel: 'History',
    historyCleared: 'Download history cleared',
    aboutTitle: 'About App',
    aboutDesc: 'My Downloads — A clean tool to download videos or extract audio.',
    versionLabel: (v: string) => `Version ${v}`,
    checkUpdatesBtn: 'Check for Updates',
    shareCardTitle: 'Share App with Friends',
    shareCardDesc: 'Share My Downloads with friends to save videos and audio effortlessly.',
    shareBtn: 'Share',
    shareSuccessToast: 'Shared',
    shareCopiedToast: 'App link copied to clipboard for sharing',
    feedbackTitle: 'Share Your Ideas & Feedback',
    feedbackSubtitle: 'Your feedback shapes the future of the app!',
    feedbackDesc: 'I would love to hear your thoughts, ideas, or suggestions to make the app even better and more useful for you:',
    feedbackEmail: 'anasahmednoubi@gmail.com',
    copyEmailBtn: 'Copy Email',
    emailCopiedTitle: 'Copied',
    emailCopiedBody: 'Email address copied to clipboard',
    previewNote: 'Real server-backed downloads — files save directly to your device Downloads folder.',
    navDownload: 'Download',
    navStatuses: 'Statuses',
    navHistory: 'History',
    navMore: 'More',
    waTitle: 'WhatsApp Statuses',
    waSubtitle: 'Browse active WhatsApp photo & video statuses on your device and save them directly.',
    waGrantTitle: 'Connect WhatsApp Statuses Folder',
    waGrantDesc: 'To read active statuses on your device, grant one-time read access to the WhatsApp Statuses folder.',
    waFolderPathHint: 'Typical path: Android / media / com.whatsapp / WhatsApp / Media / .Statuses',
    waConnectBtn: 'Open WhatsApp Statuses',
    waConnectBusinessBtn: 'WhatsApp Business',
    waPickWebFolderBtn: 'Pick Statuses Folder (.Statuses)',
    waChangeFolderBtn: 'Change Folder',
    waRefreshBtn: 'Refresh',
    waIncludeVideosTitle: 'Download Video Statuses',
    waIncludeVideosDescOn: 'Enabled — Video statuses appear in your list and batch saves.',
    waIncludeVideosDescOff: 'Disabled — Only photo statuses are shown and saved.',
    waFilterAll: 'All',
    waFilterPhotos: 'Photos',
    waFilterVideos: 'Videos',
    waCountSummary: (photos: number, videos: number) => `${photos} photos · ${videos} videos`,
    waSaveBtn: 'Save',
    waSavedBadge: 'Saved',
    waSaveAllBtn: (n: number) => `Save All (${n})`,
    waSavePhotosOnlyBtn: (n: number) => `Save Photos Only (${n})`,
    waPreviewTitle: 'Status Preview',
    waEmptyTitle: 'No Statuses Found Yet',
    waEmptyDesc: 'View statuses in WhatsApp first, then tap Refresh to load them here.',
    waVideosHiddenHint: 'Video downloads are currently switched off. Turn on "Download Video Statuses" above to show and save them.',
    waBatchDialogTitle: 'Include Video Statuses?',
    waBatchDialogDesc: (photos: number, videos: number) =>
      `There are ${videos} videos and ${photos} photos ready. Do you want to download videos too or photos only?`,
    waBatchWithVideos: (total: number) => `Download All incl. Videos (${total})`,
    waBatchPhotosOnly: (photos: number) => `Save Photos Only (${photos})`,
    waVideoChoiceTitle: 'This Status is a Video',
    waVideoChoiceDesc: 'Video downloads are currently off. Enable video downloads and save this video now?',
    waEnableAndSaveVideo: 'Enable & Save Video',
    waSavedSingleToast: (name: string) => `Saved status: ${name}`,
    waSavedBatchToast: (n: number) => `Saved ${n} statuses to Downloads`,
    waSaveErrorBody: 'Could not save this status. Check folder permission and try again.',
    waAccessErrorBody: 'WhatsApp Statuses folder access was not granted.',
    waScanningLabel: 'Reading WhatsApp statuses…',
    waSavingBatchProgress: (done: number, total: number) => `Saving (${done} / ${total})…`,
    waWebHint: 'In a browser, pick your local .Statuses folder to load photos and videos directly.',
    updateAvailableAria: 'Update available',
    caughtTitle: 'Link Detected in Clipboard',
    sharedTitle: 'Shared Link Ready',
    resolvingQualities: 'Loading video details & available qualities…',
    close: 'Close',
    howToDownload: 'Download as Video or Audio Only?',
    fullVideo: 'Video (MP4)',
    audioExtractOnly: 'Audio Only (MP3)',
    whichQuality: 'Which quality would you like?',
    downloadNowQuality: 'Download Now',
    openInDownloadTab: 'Open in Download Tab',
    clipboardTitle: 'Clipboard',
    pasteBtn: 'Paste',
    clipboardPastedText: 'Pasted text from clipboard',
    clipboardUnsupported: 'Please paste the link in the input box or tap Paste.',
    clipboardEmpty: 'Clipboard is currently empty or has no supported link.',
    clipboardFallback: 'Checked clipboard and loaded detected video.',
    linkDetectedToast: 'Link Detected!',
    linkCaptured: (t: string) => `Captured: ${t}...`,
    newLinkToast: 'New Link Detected',
    platformCaptured: (p: string) => `Captured ${p} link from clipboard!`,
    warningTitle: 'Notice',
    // Update sheet strings
    updateCheckingPill: 'Checking',
    updateCheckingTitle: 'Checking for Updates...',
    updateCheckingDesc: 'Connecting to GitHub to check for the latest version of My Downloads.',
    updateLatestToast: (v: string) => `Your app is already up to date (${v})`,
    updateLatestPill: 'Fully Up to Date',
    updateLatestTitle: 'You are on the latest version!',
    updateLatestDescBefore: 'Your app is running the latest version (',
    updateLatestDescAfter: '). There are no new updates available right now, and all features and improvements are up to date.',
    updateLatestBtn: 'Awesome, Thanks!',
    updateAvailToastTitle: 'New Update Available',
    updateAvailToastBody: (v: string) => `Version ${v} is now available on GitHub`,
    updateAvailPill: 'Update Available',
    updateAvailTitle: 'A New Update is Available!',
    updateAvailVersionPrefix: 'New version available (',
    updateFeaturesHeading: 'New Features & Improvements:',
    updateNowBtn: 'Update App Now',
    laterBtn: 'Later',
    updateUpdatingPill: (p: number) => `Updating · ${p}%`,
    updateUpdatingTitle: 'Updating App...',
    updateUpdatingDesc: 'Preparing and downloading the new release from GitHub...',
    updateErrorPill: 'Check Failed',
    updateErrorTitle: 'Could Not Connect to GitHub',
    updateErrorDesc: 'Please check your internet connection and try again to check for new updates.',
    retryBtn: 'Try Again',
    updateDoneToastTitle: 'Updated',
    updateDoneToastBody: (v: string) => `Update ${v} is ready`,
    // Notifications, Tour, Erase All Data
    notificationsTitle: 'Notifications',
    notifOnBadge: 'On',
    motivationalNotifications: 'Motivational Notifications',
    motivationalDesc: 'Encouraging messages reminding you to complete your downloads every so often.',
    notifInterval: 'Interval between notifications',
    showDeviceNotif: 'Show notifications on device',
    notifUnsupported: 'Notifications are not supported in this browser.',
    notifDenied: 'Notification permission was denied. Enable it in browser settings.',
    notifError: 'Could not enable notifications here. Try opening the page directly.',
    notifActivated: 'Notifications enabled.',
    motReminderTitle: 'Motivational Reminder',
    motMsgs: [
      'A small step every day makes a big difference.',
      'Do not postpone today\'s download to tomorrow.',
      'Keep going, you are progressing more than you think.',
      'Organize your files and get things done fast.',
    ],
    motIntervals: [
      [15, '15 min'],
      [30, '30 min'],
      [60, '1 hour'],
      [180, '3 hours'],
    ] as [number, string][],
    replayTour: 'Replay the Tour',
    tourSteps: [
      ['Paste the Link', 'Paste a video link, or copy it and the app will catch it automatically from clipboard.'],
      ['Pick the Quality', 'Choose video or audio only, then pick the quality you prefer.'],
      ['Download & Track', 'Tap download and follow the progress; your files appear in the History tab.'],
      ['Swipe to Navigate', 'Swipe left or right anywhere to smoothly move between tabs.'],
    ] as [string, string][],
    tourNext: 'Next',
    tourStart: 'Start',
    tourSkip: 'Skip',
    eraseAllData: 'Erase All Data',
    erasedToastTitle: 'Erased',
    erasedToastBody: 'All data was erased',
  },
} as const;

const HAS_ARABIC_RE = /[\u0600-\u06FF]/;

const COMMIT_PREFIX_AR: [RegExp, string][] = [
  [/^feat(\([^)]+\))?:\s*/i, 'ميزة جديدة: '],
  [/^fix(\([^)]+\))?:\s*/i, 'إصلاح وتحسين: '],
  [/^style(\([^)]+\))?:\s*/i, 'تحسين الواجهة والتصميم: '],
  [/^perf(\([^)]+\))?:\s*/i, 'تحسين الأداء والسرعة: '],
  [/^refactor(\([^)]+\))?:\s*/i, 'إعادة تنظيم وتحسين الكود: '],
  [/^build(\([^)]+\))?:\s*/i, 'تحديث نظام البناء وملف APK: '],
  [/^ci(\([^)]+\))?:\s*/i, 'تحديث البناء التلقائي على GitHub: '],
  [/^chore(\([^)]+\))?:\s*/i, 'تحديثات وصيانة عامة: '],
  [/^docs(\([^)]+\))?:\s*/i, 'تحديث التوثيق: '],
];

const PHRASE_MAP_EN_TO_AR: [RegExp, string][] = [
  [/\badd(ed)?\b/gi, 'إضافة'],
  [/\bupdat(e|ed|ing)\b/gi, 'تحديث'],
  [/\bfix(ed)?\b/gi, 'إصلاح'],
  [/\bimprov(e|ed|ement|ements)\b/gi, 'تحسين'],
  [/\bsupport(ed|ing)?\b/gi, 'دعم'],
  [/\bapp\b/gi, 'التطبيق'],
  [/\blanguage\b/gi, 'اللغة'],
  [/\barabic\b/gi, 'العربية'],
  [/\benglish\b/gi, 'الإنجليزية'],
  [/\bfeatures?\b/gi, 'مميزات'],
  [/\bdark mode\b/gi, 'الوضع الليلي'],
  [/\btheme\b/gi, 'المظهر'],
  [/\bbutton\b/gi, 'زر'],
  [/\bdownload(s|er)?\b/gi, 'التحميل'],
  [/\bclipboard\b/gi, 'الحافظة'],
  [/\bswipe\b/gi, 'السحب بالتاتش'],
  [/\bworkflow\b/gi, 'مسار البناء'],
  [/\bbottom sheet\b/gi, 'النافذة السفلية'],
  [/\bmodal|dialog\b/gi, 'نافذة'],
  [/\btoast\b/gi, 'إشعار'],
  [/\bsettings?\b/gi, 'الإعدادات'],
  [/\babout card\b/gi, 'بطاقة عن التطبيق'],
  [/\bgithub\b/gi, 'GitHub'],
];

const PHRASE_MAP_AR_TO_EN: [RegExp, string][] = [
  [/إضافة مربع تحديث التطبيق من GitHub مباشرة داخل تبويب المزيد/g, 'Added in-app GitHub update checker inside the More tab'],
  [/دعم التنقل بالتاتش والسحب يميناً ويساراً بين التبويبات/g, 'Support touch swipe navigation between tabs'],
  [/الالتقاط التلقائي لروابط الفيديو من الحافظة مع خيارات الجودة/g, 'Automatic clipboard video link detection with quality options'],
  [/بناء ونشر ملف APK تلقائياً عبر GitHub Releases/g, 'Automated APK build and publishing via GitHub Releases'],
  [/تحسينات عامة في الأداء وإصلاح الأخطاء/g, 'General performance improvements and bug fixes'],
  [/إصدار جديد متاح للتحميل والتثبيت/g, 'New release available to download and install'],
  [/إصدار APK محدّث جاهز للتنزيل عبر GitHub/g, 'Updated APK build ready to download via GitHub'],
  [/تحسينات وتعديلات جديدة على الكود/g, 'New code improvements and updates'],
  [/تحديث المزايا الذكية وفحص التحديثات/g, 'Smart Features & GitHub Update Checker'],
  [/تحديث جديد متاح على GitHub/g, 'New update available on GitHub'],
];

export function localizeFeatureLine(line: string, targetLang: AppLang): string {
  const clean = line.trim();
  if (!clean) return clean;
  const isArabic = HAS_ARABIC_RE.test(clean);

  if (targetLang === 'ar') {
    if (isArabic) return clean;
    for (const [re, arPrefix] of COMMIT_PREFIX_AR) {
      if (re.test(clean)) {
        const rest = clean.replace(re, '').trim();
        let translated = rest;
        for (const [enRe, arWord] of PHRASE_MAP_EN_TO_AR) {
          translated = translated.replace(enRe, arWord);
        }
        return `${arPrefix}${translated}`;
      }
    }
    let translated = clean;
    let changed = false;
    for (const [enRe, arWord] of PHRASE_MAP_EN_TO_AR) {
      if (enRe.test(translated)) {
        translated = translated.replace(enRe, arWord);
        changed = true;
      }
    }
    return changed ? translated : `تحديث: ${clean}`;
  } else {
    if (!isArabic) return clean;
    let translated = clean;
    for (const [arRe, enText] of PHRASE_MAP_AR_TO_EN) {
      translated = translated.replace(arRe, enText);
    }
    if (!HAS_ARABIC_RE.test(translated)) return translated;
    return 'New improvements and updates included in this release';
  }
}

export function parseBilingualReleaseNotes(body: string): { ar: string[]; en: string[] } {
  const lines = body.split('\n');
  const arLines: string[] = [];
  const enLines: string[] = [];
  let section: 'both' | 'ar' | 'en' = 'both';

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (/^#{1,4}\s*(العربية|arabic|ar)\b/i.test(trimmed) || /^\[AR\]$/i.test(trimmed)) {
      section = 'ar';
      continue;
    }
    if (/^#{1,4}\s*(english|en|الإنجليزية)\b/i.test(trimmed) || /^\[EN\]$/i.test(trimmed)) {
      section = 'en';
      continue;
    }

    const cleaned = trimmed.replace(/^[-*•]\s*/, '').trim();
    if (!cleaned || /^#{1,4}\s+/.test(cleaned)) continue;

    if (section === 'ar') {
      arLines.push(cleaned);
    } else if (section === 'en') {
      enLines.push(cleaned);
    } else {
      if (HAS_ARABIC_RE.test(cleaned)) {
        arLines.push(cleaned);
      } else {
        enLines.push(cleaned);
      }
    }
  }

  const finalAr =
    arLines.length > 0
      ? arLines
      : enLines.length > 0
        ? enLines.map((l) => localizeFeatureLine(l, 'ar'))
        : ['إصدار جديد متاح للتحميل والتثبيت'];

  const finalEn =
    enLines.length > 0
      ? enLines
      : arLines.length > 0
        ? arLines.map((l) => localizeFeatureLine(l, 'en'))
        : ['New release available to download and install'];

  return { ar: finalAr, en: finalEn };
}
