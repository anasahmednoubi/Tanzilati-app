# تطبيق تنزيلاتي (Tanzeelati) 📥📱

تطبيق حديث وسريع لتنزيل الفيديوهات والمقاطع الصوتية، مجهز للعمل كتطبيق ويب (PWA) وتطبيق أندرويد أصلي (Android APK) عبر **Capacitor** و **GitHub Actions**.

---

## 🚀 كيفية ربط المشروع بمستودع جديد على GitHub (خطوة بخطوة)

### 1. أنشئ مستودعاً جديداً على GitHub:
1. افتح [GitHub](https://github.com/new).
2. اختر اسماً للمستودع، مثلاً: `Tanzilati-app`.
3. اتركه **Public** أو **Private** بحسب رغبتك، **ولا** تضع علامة على "Add a README file" لأن المشروع يحتوي عليه بالفعل.
4. اضغط **Create repository**.

---

### 2. اربط الكود وارفعه إلى GitHub من جهازك أو موجه الأوامر (Terminal):

افتح الطرفية (Terminal) في مسار المشروع ونفذ الأوامر التالية:

```bash
# 1. تهيئة مستودع Git
git init

# 2. إضافة جميع الملفات
git add .

# 3. حفظ الالتزام الأول
git commit -m "الإصدار الأول: تطبيق تنزيلاتي مع دعم الأندرويد و GitHub Actions"

# 4. تحديد الفرع الرئيسي
git branch -M main

# 5. ربط المستودع بالرابط الخاص بك على جيت هاب
git remote add origin https://github.com/anasahmednoubi/Tanzilati-app.git

# 6. رفع الكود
git push -u origin main
```

---

## ⚙️ كيف يتم بناء ملف الـ APK تلقائياً عبر GitHub Actions؟

بمجرد رفع الكود (`git push`):
1. سيعمل ملف الـ Workflow الموجود في `.github/workflows/build-apk.yml` تلقائياً.
2. يقوم الأكشن ببناء تطبيق الويب ثم توليد مشروع الأندرويد وترجمته عبر Gradle إلى ملف **`app-debug.apk`**.
3. **لتحميل الـ APK**:
   - اذهب إلى صفحة مستودعك على GitHub.
   - اضغط على تبويب **Actions** في الأعلى.
   - اضغط على أحدث تشغيل (Workflow run) باسم **Build Android APK**.
   - في أسفل الصفحة تحت قسم **Artifacts**، ستجد ملف **`Tanzeelati-Debug-APK`**.
   - اضغط عليه لتحميله مباشرة وتثبيته على هاتفك الأندرويد! 🎉

---

## 🛠️ أوامر التطوير المحلية:
- تشغيل التطبيق محلياً: `npm run dev`
- بناء ملفات الويب: `npm run build`
- مزامنة كود الأندرويد: `npx cap sync android`
- فتح المشروع في Android Studio: `npx cap open android`
