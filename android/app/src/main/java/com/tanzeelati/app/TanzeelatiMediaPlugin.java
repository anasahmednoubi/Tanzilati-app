package com.tanzeelati.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(
    name = "TanzeelatiMedia",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class TanzeelatiMediaPlugin extends Plugin {

    private static final String ANDROID_VR_UA =
        "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip";
    private static final String ANDROID_YT_UA =
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip";
    private static final String MOBILE_CHROME_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    private static final String DESKTOP_CHROME_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    private static final String FB_EXTERNAL_HIT_UA =
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    private static final String WA_PREFS_NAME = "tanzeelati_wa_prefs";
    private static final String WA_TREE_URIS_KEY = "wa_tree_uris_json";

    private static volatile TanzeelatiMediaPlugin activeInstance;
    private static volatile String pendingSharedUrl = null;
    private static volatile String pendingSharedSubject = null;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, AtomicBoolean> cancelFlags = new ConcurrentHashMap<>();

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    public static void handleSharedIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action)) return;

        String rawText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (rawText == null || rawText.trim().isEmpty()) {
            CharSequence cs = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (cs != null) rawText = cs.toString();
        }
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (subject == null) {
            subject = intent.getStringExtra(Intent.EXTRA_TITLE);
        }

        String foundUrl = extractUrlIfPresent(rawText);
        if (foundUrl == null || foundUrl.isEmpty()) return;

        pendingSharedUrl = foundUrl;
        pendingSharedSubject = subject != null ? subject.trim() : "";

        // Clear extras so orientation changes do not replay this share intent
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.setAction("");

        TanzeelatiMediaPlugin inst = activeInstance;
        if (inst != null) {
            JSObject data = new JSObject();
            data.put("url", pendingSharedUrl);
            data.put("subject", pendingSharedSubject);
            inst.notifyListeners("sharedLinkReceived", data, true);
        }
    }

    private static String extractUrlIfPresent(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        Matcher m = Pattern.compile("(https?://[^\\s<>\"'{}|\\\\^`]+)", Pattern.CASE_INSENSITIVE).matcher(raw.trim());
        if (m.find()) {
            return extractCleanUrl(m.group(1).replaceAll("[.,;:!?)]+$", ""));
        }
        Matcher dom = Pattern.compile(
            "((?:www\\.|m\\.|mbasic\\.|web\\.|touch\\.)?(?:youtube\\.com|youtu\\.be|tiktok\\.com|vm\\.tiktok\\.com|vt\\.tiktok\\.com|instagram\\.com|instagr\\.am|facebook\\.com|fb\\.watch|fb\\.com|fb\\.me|twitter\\.com|x\\.com|threads\\.net|threads\\.com|reddit\\.com|redd\\.it|soundcloud\\.com|vimeo\\.com|pin\\.it|pinterest\\.com)/[^\\s<>\"'{}|\\\\^`]+)",
            Pattern.CASE_INSENSITIVE
        ).matcher(raw.trim());
        if (dom.find()) {
            return extractCleanUrl("https://" + dom.group(1).replaceAll("[.,;:!?)]+$", ""));
        }
        return null;
    }

    @PluginMethod
    public void getPendingSharedUrl(PluginCall call) {
        String url = pendingSharedUrl;
        String subject = pendingSharedSubject;
        pendingSharedUrl = null;
        pendingSharedSubject = null;

        JSObject res = new JSObject();
        res.put("url", url != null ? url : "");
        res.put("subject", subject != null ? subject : "");
        call.resolve(res);
    }

    @PluginMethod
    public void clearPendingSharedUrl(PluginCall call) {
        pendingSharedUrl = null;
        pendingSharedSubject = null;
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    @PluginMethod
    public void resolveMedia(PluginCall call) {
        String rawUrl = call.getString("url", "");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("EMPTY_URL");
            return;
        }
        String targetUrl = extractCleanUrl(rawUrl);
        executor.execute(() -> {
            try {
                JSObject info = resolveMediaInternal(targetUrl);
                if (info == null) {
                    call.reject("EXTRACTION_FAILED");
                } else {
                    call.resolve(info);
                }
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "EXTRACTION_FAILED");
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String jobId = call.getString("jobId", "");
        if (jobId != null && !jobId.isEmpty()) {
            AtomicBoolean flag = cancelFlags.get(jobId);
            if (flag != null) {
                flag.set(true);
            }
        }
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    @PluginMethod
    public void downloadMedia(PluginCall call) {
        String jobId = call.getString("jobId", "job_" + System.currentTimeMillis());
        String sourcePageUrl = extractCleanUrl(call.getString("url", ""));
        String videoUrl = call.getString("videoUrl", "");
        String audioUrl = call.getString("audioUrl", "");
        String userAgent = call.getString("userAgent", MOBILE_CHROME_UA);
        String qualityKey = call.getString("qualityKey", "best");
        String filename = sanitizeFilename(call.getString("filename", "tanzeelati-media.mp4"));
        String mimeType = call.getString("mimeType", "video/mp4");
        boolean isAudio = Boolean.TRUE.equals(call.getBoolean("isAudio", false));

        AtomicBoolean cancelled = new AtomicBoolean(false);
        cancelFlags.put(jobId, cancelled);

        executor.execute(() -> {
            File workDir = new File(getContext().getCacheDir(), "tanzeelati_" + jobId);
            if (!workDir.exists()) {
                workDir.mkdirs();
            }

            try {
                String resolvedVideoUrl = videoUrl != null ? videoUrl.trim() : "";
                String resolvedAudioUrl = audioUrl != null ? audioUrl.trim() : "";
                String resolvedUA = (userAgent != null && !userAgent.trim().isEmpty()) ? userAgent : MOBILE_CHROME_UA;
                String resolvedFallbackUrl = "";

                // If stream URLs weren't supplied, resolve them natively on device
                if ((isAudio && resolvedAudioUrl.isEmpty() && resolvedVideoUrl.isEmpty()) || (!isAudio && resolvedVideoUrl.isEmpty())) {
                    emitProgress(jobId, "downloading", 4, null, null);
                    JSObject fresh = resolveMediaInternal(sourcePageUrl);
                    if (fresh != null) {
                        if (isAudio) {
                            JSArray aOpts = (JSArray) fresh.get("audioOptions");
                            if (aOpts != null && aOpts.length() > 0) {
                                for (int i = 0; i < aOpts.length(); i++) {
                                    JSONObject opt = aOpts.getJSONObject(i);
                                    if (qualityKey.equals(opt.optString("key")) && opt.has("directUrl")) {
                                        resolvedAudioUrl = opt.optString("directUrl", "");
                                        resolvedUA = opt.optString("userAgent", resolvedUA);
                                        break;
                                    }
                                }
                                if (resolvedAudioUrl.isEmpty()) {
                                    JSONObject first = aOpts.getJSONObject(0);
                                    resolvedAudioUrl = first.optString("directUrl", "");
                                    resolvedUA = first.optString("userAgent", resolvedUA);
                                }
                            }
                            if (resolvedAudioUrl.isEmpty()) {
                                resolvedAudioUrl = fresh.optString("fallbackAudioUrl", fresh.optString("fallbackStreamUrl", ""));
                            }
                        } else {
                            JSArray vOpts = (JSArray) fresh.get("videoOptions");
                            if (vOpts != null && vOpts.length() > 0) {
                                JSONObject chosen = null;
                                for (int i = 0; i < vOpts.length(); i++) {
                                    JSONObject opt = vOpts.getJSONObject(i);
                                    if (qualityKey.equals(opt.optString("key"))) {
                                        chosen = opt;
                                        break;
                                    }
                                }
                                if (chosen == null) chosen = vOpts.getJSONObject(0);
                                resolvedVideoUrl = chosen.optString("directUrl", "");
                                resolvedAudioUrl = chosen.optString("audioUrl", "");
                                resolvedUA = chosen.optString("userAgent", resolvedUA);
                            }
                            resolvedFallbackUrl = fresh.optString("fallbackStreamUrl", "");
                            if (resolvedVideoUrl.isEmpty()) {
                                resolvedVideoUrl = resolvedFallbackUrl;
                            }
                        }
                    }
                }

                if (cancelled.get()) throw new Exception("CANCELLED");

                File finalTempFile = new File(workDir, filename);

                if (isAudio) {
                    String stream = !resolvedAudioUrl.isEmpty() ? resolvedAudioUrl : resolvedVideoUrl;
                    if (stream.isEmpty()) throw new Exception("NO_AUDIO_STREAM");
                    File rawAudioTmp = new File(workDir, "raw_audio_src.bin");
                    downloadFile(stream, resolvedUA, rawAudioTmp, jobId, "extracting", 5, 88, cancelled);
                    if (cancelled.get()) throw new Exception("CANCELLED");
                    emitProgress(jobId, "extracting", 92, null, 1);
                    if (filename.toLowerCase(Locale.US).endsWith(".m4a") && demuxAudioToM4a(rawAudioTmp, finalTempFile)) {
                        rawAudioTmp.delete();
                    } else {
                        copyFile(rawAudioTmp, finalTempFile);
                        rawAudioTmp.delete();
                    }
                    emitProgress(jobId, "extracting", 96, null, 1);
                } else {
                    if (resolvedVideoUrl.isEmpty()) throw new Exception("NO_VIDEO_STREAM");
                    boolean needsMux = !resolvedAudioUrl.isEmpty() && !resolvedAudioUrl.equals(resolvedVideoUrl);
                    if (needsMux) {
                        File vTmp = new File(workDir, "video_track.mp4");
                        File aTmp = new File(workDir, "audio_track.m4a");
                        downloadFile(resolvedVideoUrl, resolvedUA, vTmp, jobId, "downloading", 3, 72, cancelled);
                        downloadFile(resolvedAudioUrl, resolvedUA, aTmp, jobId, "downloading", 72, 92, cancelled);
                        if (cancelled.get()) throw new Exception("CANCELLED");
                        emitProgress(jobId, "extracting", 94, null, 2);
                        boolean muxOk = muxMp4AndM4a(vTmp, aTmp, finalTempFile);
                        if (!muxOk || !finalTempFile.exists() || finalTempFile.length() == 0) {
                            if (!resolvedFallbackUrl.isEmpty() && !resolvedFallbackUrl.equals(resolvedVideoUrl)) {
                                downloadFile(resolvedFallbackUrl, resolvedUA, finalTempFile, jobId, "downloading", 50, 96, cancelled);
                            } else {
                                // Copy video track as fallback
                                copyFile(vTmp, finalTempFile);
                            }
                        }
                        vTmp.delete();
                        aTmp.delete();
                    } else {
                        downloadFile(resolvedVideoUrl, resolvedUA, finalTempFile, jobId, "downloading", 3, 96, cancelled);
                    }
                }

                if (cancelled.get()) throw new Exception("CANCELLED");
                if (!finalTempFile.exists() || finalTempFile.length() == 0) {
                    throw new Exception("EMPTY_FILE");
                }

                emitProgress(jobId, "extracting", 98, null, 1);
                String savedPath = saveToDownloads(finalTempFile, filename, mimeType);
                long finalSize = finalTempFile.length();

                emitProgress(jobId, "complete", 100, null, 0);

                JSObject result = new JSObject();
                result.put("ok", true);
                result.put("jobId", jobId);
                result.put("filename", filename);
                result.put("savedPath", savedPath);
                result.put("fileSize", finalSize);
                call.resolve(result);
            } catch (Exception e) {
                if ("CANCELLED".equals(e.getMessage()) || cancelled.get()) {
                    emitProgress(jobId, "cancelled", 0, null, null);
                    call.reject("CANCELLED");
                } else {
                    emitProgress(jobId, "error", 0, null, null);
                    call.reject(e.getMessage() != null ? e.getMessage() : "DOWNLOAD_FAILED");
                }
            } finally {
                cancelFlags.remove(jobId);
                deleteDir(workDir);
            }
        });
    }

    private void emitProgress(String jobId, String phase, double progress, String speedMBs, Integer etaSec) {
        JSObject data = new JSObject();
        data.put("jobId", jobId);
        data.put("phase", phase);
        data.put("progress", Math.round(progress * 10.0) / 10.0);
        if (speedMBs != null) data.put("speedMBs", speedMBs);
        if (etaSec != null) data.put("etaSec", etaSec);
        notifyListeners("downloadProgress", data);
    }

    private JSObject resolveMediaInternal(String targetUrl) throws Exception {
        String lower = targetUrl.toLowerCase(Locale.US);

        // 1. TikTok
        if (lower.contains("tiktok.com")) {
            JSObject tik = resolveTikTok(targetUrl);
            if (tik != null) return tik;
        }

        // 2. X / Twitter
        if (lower.contains("twitter.com") || lower.contains("x.com")) {
            JSObject tw = resolveTwitter(targetUrl);
            if (tw != null) return tw;
        }

        // 3. Facebook (handles share/r, share/v, fb.watch, fb.me, Reels, Watch, mbasic, plugins/video.php)
        if (lower.contains("facebook.com") || lower.contains("fb.watch") || lower.contains("fb.com") || lower.contains("fb.me")) {
            JSObject fb = resolveFacebook(targetUrl);
            if (fb != null) return fb;
        }

        // 4. Instagram (/reel/, /p/, /share/, /embed/)
        if (lower.contains("instagram.com") || lower.contains("instagr.am")) {
            JSObject ig = resolveInstagram(targetUrl);
            if (ig != null) return ig;
        }

        // 5. YouTube
        String ytId = extractYouTubeId(targetUrl);
        if (ytId != null) {
            JSObject yt = resolveYouTubeInnerTube(ytId, targetUrl);
            if (yt != null) return yt;
            JSObject piped = resolveYouTubePiped(ytId, targetUrl);
            if (piped != null) return piped;
        }

        // 6. Direct media links (.mp4, .mp3, .m4a, .webm, etc.)
        if (lower.matches(".*\\.(mp4|m4v|mov|webm|mp3|m4a|aac|wav|ogg)(\\?.*|$)")) {
            return buildDirectResult(targetUrl, "رابط مباشر", "Direct Media", isAudioUrl(lower));
        }

        // 7. Generic HTML social extraction fallback
        JSObject htmlRes = resolveSocialPageHtml(targetUrl);
        if (htmlRes != null) return htmlRes;

        // 8. Content-Type probe fallback
        HttpURLConnection headConn = null;
        try {
            headConn = openConnectionFollowingRedirects(targetUrl, DESKTOP_CHROME_UA, 6000, "HEAD");
            String ct = headConn.getContentType();
            if (ct != null && (ct.startsWith("video/") || ct.startsWith("audio/"))) {
                return buildDirectResult(headConn.getURL().toString(), "رابط مباشر", "Direct Media", ct.startsWith("audio/"));
            }
        } catch (Exception ignored) {
        } finally {
            if (headConn != null) headConn.disconnect();
        }

        return null;
    }

    private JSObject resolveYouTubeInnerTube(String videoId, String originalUrl) {
        String[][] clients = new String[][] {
            { "ANDROID_VR", "1.60.19", ANDROID_VR_UA, "32", "Android", "12L" },
            { "ANDROID", "20.10.38", ANDROID_YT_UA, "34", "Android", "14" }
        };

        for (String[] clientCfg : clients) {
            HttpURLConnection conn = null;
            try {
                URL u = new URL("https://www.youtube.com/youtubei/v1/player?prettyPrint=false");
                conn = (HttpURLConnection) u.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(7000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("User-Agent", clientCfg[2]);

                JSONObject clientObj = new JSONObject();
                clientObj.put("clientName", clientCfg[0]);
                clientObj.put("clientVersion", clientCfg[1]);
                clientObj.put("androidSdkVersion", Integer.parseInt(clientCfg[3]));
                clientObj.put("osName", clientCfg[4]);
                clientObj.put("osVersion", clientCfg[5]);
                clientObj.put("hl", "en");
                clientObj.put("gl", "US");

                JSONObject contextObj = new JSONObject();
                contextObj.put("client", clientObj);

                JSONObject body = new JSONObject();
                body.put("videoId", videoId);
                body.put("context", contextObj);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                if (conn.getResponseCode() != 200) continue;
                String jsonStr = readStreamAsString(conn.getInputStream());
                JSONObject data = new JSONObject(jsonStr);

                JSONObject playability = data.optJSONObject("playabilityStatus");
                if (playability == null || !"OK".equals(playability.optString("status"))) continue;

                JSONObject details = data.optJSONObject("videoDetails");
                JSONObject streaming = data.optJSONObject("streamingData");
                if (streaming == null) continue;

                String title = details != null ? details.optString("title", "YouTube Video") : "YouTube Video";
                String author = details != null ? details.optString("author", "YouTube") : "YouTube";
                int durSec = details != null ? details.optInt("lengthSeconds", 120) : 120;
                String thumb = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
                if (details != null && details.has("thumbnail")) {
                    JSONArray thumbs = details.getJSONObject("thumbnail").optJSONArray("thumbnails");
                    if (thumbs != null && thumbs.length() > 0) {
                        thumb = thumbs.getJSONObject(thumbs.length() - 1).optString("url", thumb);
                    }
                }

                // Find best progressive MP4 (with audio built-in)
                String progUrl = "";
                long progSize = 0;
                int progHeight = 360;
                JSONArray progArr = streaming.optJSONArray("formats");
                if (progArr != null) {
                    for (int i = progArr.length() - 1; i >= 0; i--) {
                        JSONObject f = progArr.getJSONObject(i);
                        String uStr = f.optString("url", "");
                        String mime = f.optString("mimeType", "");
                        if (!uStr.isEmpty() && mime.contains("video/mp4")) {
                            progUrl = uStr;
                            progHeight = f.optInt("height", 360);
                            progSize = parseLongSafe(f.optString("contentLength", "0"));
                            break;
                        }
                    }
                }

                // Find best AAC M4A audio track (itag 140 / audio/mp4)
                String bestAudioUrl = "";
                long bestAudioSize = 0;
                int bestAudioBitrate = -1;
                JSONArray adapArr = streaming.optJSONArray("adaptiveFormats");
                if (adapArr != null) {
                    for (int i = 0; i < adapArr.length(); i++) {
                        JSONObject f = adapArr.getJSONObject(i);
                        String uStr = f.optString("url", "");
                        String mime = f.optString("mimeType", "");
                        if (!uStr.isEmpty() && mime.startsWith("audio/mp4")) {
                            int br = f.optInt("bitrate", 0);
                            if (br > bestAudioBitrate) {
                                bestAudioBitrate = br;
                                bestAudioUrl = uStr;
                                bestAudioSize = parseLongSafe(f.optString("contentLength", "0"));
                            }
                        }
                    }
                }

                // Collect H.264/AVC MP4 adaptive options so MediaMuxer merges cleanly with M4A
                List<JSONObject> h264Adaptive = new ArrayList<>();
                if (adapArr != null) {
                    for (int i = 0; i < adapArr.length(); i++) {
                        JSONObject f = adapArr.getJSONObject(i);
                        String uStr = f.optString("url", "");
                        String mime = f.optString("mimeType", "");
                        if (!uStr.isEmpty() && mime.startsWith("video/mp4") && (mime.contains("avc1") || mime.contains("mp4v"))) {
                            h264Adaptive.add(f);
                        }
                    }
                }
                Collections.sort(h264Adaptive, (a, b) -> Integer.compare(b.optInt("height", 0), a.optInt("height", 0)));

                JSArray videoOptions = new JSArray();
                Set<Integer> seenH = new HashSet<>();
                String usedUA = clientCfg[2];

                if (!bestAudioUrl.isEmpty()) {
                    if (bestAudioSize <= 0) {
                        bestAudioSize = probeContentLength(bestAudioUrl, usedUA);
                    }
                    for (JSONObject f : h264Adaptive) {
                        int h = f.optInt("height", 0);
                        if (h < 240 || seenH.contains(h)) continue;
                        if (h != 1080 && h != 720 && h != 480 && h != 360) continue;
                        seenH.add(h);
                        long vBytes = parseLongSafe(f.optString("contentLength", "0"));
                        if (vBytes <= 0) {
                            vBytes = probeContentLength(f.optString("url"), usedUA);
                        }
                        long totalBytes = (vBytes > 0 && bestAudioSize > 0) ? (vBytes + bestAudioSize) : vBytes;
                        JSObject opt = new JSObject();
                        opt.put("key", String.valueOf(h));
                        opt.put("labelAr", h >= 1080 ? h + "p (Full HD)" : h == 720 ? "720p (HD)" : h + "p");
                        opt.put("labelEn", h >= 1080 ? h + "p (Full HD)" : h == 720 ? "720p (HD)" : h + "p");
                        opt.put("descAr", h >= 720 ? "MP4 · عالي الوضوح" : "MP4 · موفر للبيانات");
                        opt.put("descEn", h >= 720 ? "MP4 · High Definition" : "MP4 · Data Saver");
                        opt.put("sizeText", totalBytes > 0 ? formatBytes(totalBytes, true) : "—");
                        if (totalBytes > 0) opt.put("sizeBytes", totalBytes);
                        opt.put("height", h);
                        opt.put("directUrl", f.optString("url"));
                        opt.put("audioUrl", bestAudioUrl);
                        opt.put("userAgent", usedUA);
                        videoOptions.put(opt);
                    }
                }

                if (!progUrl.isEmpty() && !seenH.contains(progHeight)) {
                    if (progSize <= 0) {
                        progSize = probeContentLength(progUrl, usedUA);
                    }
                    JSObject opt = new JSObject();
                    opt.put("key", String.valueOf(progHeight));
                    opt.put("labelAr", progHeight + "p (MP4 مباشر)");
                    opt.put("labelEn", progHeight + "p (Direct MP4)");
                    opt.put("descAr", "MP4 · صوت وصورة مدمجين");
                    opt.put("descEn", "MP4 · Video + Audio");
                    opt.put("sizeText", progSize > 0 ? formatBytes(progSize, true) : "—");
                    if (progSize > 0) opt.put("sizeBytes", progSize);
                    opt.put("height", progHeight);
                    opt.put("directUrl", progUrl);
                    opt.put("userAgent", usedUA);
                    videoOptions.put(opt);
                }

                if (videoOptions.length() == 0) continue;

                // Prepend "best" option mirroring highest option
                JSONObject top = videoOptions.getJSONObject(0);
                JSObject bestOpt = new JSObject();
                bestOpt.put("key", "best");
                bestOpt.put("labelAr", "أفضل جودة متاحة (" + top.optInt("height", 360) + "p)");
                bestOpt.put("labelEn", "Best Available (" + top.optInt("height", 360) + "p)");
                bestOpt.put("descAr", "MP4 · أعلى دقة صوت وصورة");
                bestOpt.put("descEn", "MP4 · Highest Audio & Video");
                bestOpt.put("sizeText", top.optString("sizeText", "—"));
                if (top.has("sizeBytes")) bestOpt.put("sizeBytes", top.optLong("sizeBytes"));
                bestOpt.put("height", top.optInt("height", 360));
                bestOpt.put("directUrl", top.optString("directUrl"));
                if (top.has("audioUrl")) bestOpt.put("audioUrl", top.optString("audioUrl"));
                bestOpt.put("userAgent", usedUA);

                JSArray finalVideoOpts = new JSArray();
                finalVideoOpts.put(bestOpt);
                for (int i = 0; i < videoOptions.length(); i++) {
                    finalVideoOpts.put(videoOptions.get(i));
                }

                String effectiveAudio = !bestAudioUrl.isEmpty() ? bestAudioUrl : progUrl;
                JSArray audioOpts = buildAudioOptions(durSec, effectiveAudio, usedUA, bestAudioSize);

                JSObject out = new JSObject();
                out.put("url", originalUrl);
                out.put("title", title);
                out.put("author", author);
                out.put("duration", formatDuration(durSec));
                out.put("durationSec", durSec);
                out.put("thumbnail", thumb);
                out.put("platformAr", "يوتيوب");
                out.put("platformEn", "YouTube");
                out.put("engine", "innertube");
                out.put("videoOptions", finalVideoOpts);
                out.put("audioOptions", audioOpts);
                out.put("fallbackStreamUrl", !progUrl.isEmpty() ? progUrl : bestOpt.optString("directUrl"));
                out.put("fallbackAudioUrl", effectiveAudio);
                out.put("previewUrl", !progUrl.isEmpty() ? progUrl : bestOpt.optString("directUrl"));
                out.put("embedUrl", "https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0&playsinline=1");
                return out;
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    private JSObject resolveYouTubePiped(String videoId, String originalUrl) {
        String[] hosts = {
            "https://api.piped.private.coffee",
            "https://pipedapi.kavin.rocks",
            "https://pipedapi.ducks.party"
        };
        for (String host : hosts) {
            HttpURLConnection conn = null;
            try {
                conn = openConnectionFollowingRedirects(host + "/streams/" + videoId, MOBILE_CHROME_UA, 6500, "GET");
                if (conn.getResponseCode() != 200) continue;
                JSONObject data = new JSONObject(readStreamAsString(conn.getInputStream()));
                if (!data.has("videoStreams")) continue;

                String title = data.optString("title", "YouTube Video");
                String author = data.optString("uploader", "YouTube");
                int dur = data.optInt("duration", 0);
                String thumb = data.optString("thumbnailUrl", "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");

                JSONArray vStreams = data.optJSONArray("videoStreams");
                JSONArray aStreams = data.optJSONArray("audioStreams");
                String bestAudio = "";
                if (aStreams != null && aStreams.length() > 0) {
                    bestAudio = aStreams.getJSONObject(0).optString("url", "");
                }

                String progUrl = "";
                if (vStreams != null) {
                    for (int i = 0; i < vStreams.length(); i++) {
                        JSONObject v = vStreams.getJSONObject(i);
                        if (!v.optBoolean("videoOnly", true)
                            && !"HLS".equalsIgnoreCase(v.optString("format"))
                            && !v.optString("quality", "").toUpperCase(Locale.US).contains("LBRY")
                            && !v.optString("url", "").isEmpty()) {
                            progUrl = v.optString("url");
                            break;
                        }
                    }
                }
                if (progUrl.isEmpty()) continue;

                long progBytes = probeContentLength(progUrl, MOBILE_CHROME_UA);
                long audBytes = !bestAudio.isEmpty() ? probeContentLength(bestAudio, MOBILE_CHROME_UA) : 0L;

                JSObject opt = new JSObject();
                opt.put("key", "best");
                opt.put("labelAr", "أفضل جودة متاحة (MP4)");
                opt.put("labelEn", "Best Available (MP4)");
                opt.put("descAr", "MP4 · مباشر");
                opt.put("descEn", "MP4 · Direct");
                opt.put("sizeText", progBytes > 0 ? formatBytes(progBytes, true) : "—");
                if (progBytes > 0) opt.put("sizeBytes", progBytes);
                opt.put("directUrl", progUrl);
                opt.put("userAgent", MOBILE_CHROME_UA);

                JSArray vOpts = new JSArray();
                vOpts.put(opt);

                JSObject out = new JSObject();
                out.put("url", originalUrl);
                out.put("title", title);
                out.put("author", author);
                out.put("duration", formatDuration(dur));
                out.put("durationSec", dur);
                out.put("thumbnail", thumb);
                out.put("platformAr", "يوتيوب");
                out.put("platformEn", "YouTube");
                out.put("engine", "piped");
                out.put("videoOptions", vOpts);
                out.put("audioOptions", buildAudioOptions(dur, !bestAudio.isEmpty() ? bestAudio : progUrl, MOBILE_CHROME_UA, audBytes));
                out.put("fallbackStreamUrl", progUrl);
                out.put("fallbackAudioUrl", !bestAudio.isEmpty() ? bestAudio : progUrl);
                out.put("previewUrl", progUrl);
                out.put("embedUrl", "https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0&playsinline=1");
                return out;
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    private JSObject resolveTikTok(String targetUrl) {
        HttpURLConnection conn = null;
        try {
            String api = "https://www.tikwm.com/api/?url=" + URLEncoder.encode(targetUrl, "UTF-8") + "&hd=1";
            conn = openConnectionFollowingRedirects(api, MOBILE_CHROME_UA, 8000, "GET");
            if (conn.getResponseCode() != 200) return null;
            JSONObject json = new JSONObject(readStreamAsString(conn.getInputStream()));
            if (json.optInt("code", -1) != 0 || !json.has("data")) return null;
            JSONObject d = json.getJSONObject("data");
            String hdUrl = d.optString("hdplay", "");
            if (hdUrl.isEmpty()) hdUrl = d.optString("play", "");
            String sdUrl = d.optString("play", hdUrl);
            if (hdUrl.isEmpty() && sdUrl.isEmpty()) return null;

            int dur = d.optInt("duration", 0);
            String title = d.optString("title", "TikTok Video");
            if (title.trim().isEmpty()) title = "TikTok Video";
            JSONObject authorObj = d.optJSONObject("author");
            String author = authorObj != null ? authorObj.optString("nickname", authorObj.optString("unique_id", "TikTok")) : "TikTok";
            String cover = d.optString("cover", d.optString("origin_cover", ""));
            String musicUrl = d.optString("music", "");

            long hdBytes = d.optLong("hd_size", d.optLong("size", 0));
            if (hdBytes <= 0) hdBytes = probeContentLength(hdUrl, MOBILE_CHROME_UA);
            long sdBytes = d.optLong("size", 0);
            if (sdBytes <= 0 && !sdUrl.isEmpty() && !sdUrl.equals(hdUrl)) {
                sdBytes = probeContentLength(sdUrl, MOBILE_CHROME_UA);
            }
            long musicBytes = !musicUrl.isEmpty() ? probeContentLength(musicUrl, MOBILE_CHROME_UA) : 0L;

            JSArray vOpts = new JSArray();
            JSObject bestOpt = new JSObject();
            bestOpt.put("key", "best");
            bestOpt.put("labelAr", "أفضل جودة بدون علامة مائية");
            bestOpt.put("labelEn", "Best Quality (No Watermark)");
            bestOpt.put("descAr", "MP4 · HD أصلي");
            bestOpt.put("descEn", "MP4 · Original HD");
            bestOpt.put("sizeText", hdBytes > 0 ? formatBytes(hdBytes, true) : "—");
            if (hdBytes > 0) bestOpt.put("sizeBytes", hdBytes);
            bestOpt.put("directUrl", hdUrl);
            bestOpt.put("userAgent", MOBILE_CHROME_UA);
            vOpts.put(bestOpt);

            if (!sdUrl.isEmpty() && !sdUrl.equals(hdUrl)) {
                JSObject sdOpt = new JSObject();
                sdOpt.put("key", "480");
                sdOpt.put("labelAr", "جودة قياسية (موفر للبيانات)");
                sdOpt.put("labelEn", "Standard Quality (Compact)");
                sdOpt.put("descAr", "MP4 · بدون علامة مائية");
                sdOpt.put("descEn", "MP4 · No Watermark");
                sdOpt.put("sizeText", sdBytes > 0 ? formatBytes(sdBytes, true) : "—");
                if (sdBytes > 0) sdOpt.put("sizeBytes", sdBytes);
                sdOpt.put("directUrl", sdUrl);
                sdOpt.put("userAgent", MOBILE_CHROME_UA);
                vOpts.put(sdOpt);
            }

            String effectiveAudio = !musicUrl.isEmpty() ? musicUrl : hdUrl;
            JSObject out = new JSObject();
            out.put("url", targetUrl);
            out.put("title", title);
            out.put("author", author);
            out.put("duration", formatDuration(dur));
            out.put("durationSec", dur);
            out.put("thumbnail", cover);
            out.put("platformAr", "تيك توك");
            out.put("platformEn", "TikTok");
            out.put("engine", "tikwm");
            out.put("videoOptions", vOpts);
            out.put("audioOptions", buildAudioOptions(dur, effectiveAudio, MOBILE_CHROME_UA, musicBytes));
            out.put("fallbackStreamUrl", hdUrl);
            out.put("fallbackAudioUrl", effectiveAudio);
            out.put("previewUrl", !sdUrl.isEmpty() ? sdUrl : hdUrl);
            return out;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private JSObject resolveTwitter(String targetUrl) {
        Matcher m = Pattern.compile("/([^/]+)/status/(\\d+)", Pattern.CASE_INSENSITIVE).matcher(targetUrl);
        if (!m.find()) return null;
        String screenName = m.group(1);
        String statusId = m.group(2);

        HttpURLConnection conn = null;
        try {
            conn = openConnectionFollowingRedirects("https://api.fxtwitter.com/" + screenName + "/status/" + statusId, MOBILE_CHROME_UA, 7000, "GET");
            if (conn.getResponseCode() == 200) {
                JSONObject json = new JSONObject(readStreamAsString(conn.getInputStream()));
                JSONObject tweet = json.optJSONObject("tweet");
                if (tweet != null && tweet.has("media")) {
                    JSONArray videos = tweet.getJSONObject("media").optJSONArray("videos");
                    if (videos != null && videos.length() > 0) {
                        JSONObject v = videos.getJSONObject(0);
                        String bestUrl = v.optString("url", "");
                        JSONArray variants = v.optJSONArray("variants");
                        List<JSONObject> mp4s = new ArrayList<>();
                        if (variants != null) {
                            for (int i = 0; i < variants.length(); i++) {
                                JSONObject vr = variants.getJSONObject(i);
                                if ("video/mp4".equals(vr.optString("content_type")) && !vr.optString("url", "").isEmpty()) {
                                    mp4s.add(vr);
                                }
                            }
                            Collections.sort(mp4s, (a, b) -> Integer.compare(b.optInt("bitrate", 0), a.optInt("bitrate", 0)));
                            if (!mp4s.isEmpty()) bestUrl = mp4s.get(0).optString("url");
                        }
                        if (!bestUrl.isEmpty()) {
                            int dur = v.optInt("duration", 0);
                            long bestBytes = probeContentLength(bestUrl, MOBILE_CHROME_UA);
                            JSArray vOpts = new JSArray();
                            JSObject best = new JSObject();
                            best.put("key", "best");
                            best.put("labelAr", "أفضل جودة متاحة (MP4)");
                            best.put("labelEn", "Best Available Quality (MP4)");
                            best.put("descAr", "MP4 · أعلى دقة");
                            best.put("descEn", "MP4 · Highest Resolution");
                            best.put("sizeText", bestBytes > 0 ? formatBytes(bestBytes, true) : "—");
                            if (bestBytes > 0) best.put("sizeBytes", bestBytes);
                            best.put("directUrl", bestUrl);
                            best.put("userAgent", MOBILE_CHROME_UA);
                            vOpts.put(best);

                            String[] keys = { "720", "480", "360" };
                            for (int i = 0; i < Math.min(3, mp4s.size()); i++) {
                                JSONObject vr = mp4s.get(i);
                                String vrUrl = vr.optString("url");
                                int kbps = Math.round(vr.optInt("bitrate", 0) / 1000f);
                                long vrBytes = i == 0 && bestBytes > 0 ? bestBytes : probeContentLength(vrUrl, MOBILE_CHROME_UA);
                                JSObject o = new JSObject();
                                o.put("key", keys[i]);
                                o.put("labelAr", i == 0 ? "جودة عالية (HD)" : i == 1 ? "جودة متوسطة" : "حجم أصغر");
                                o.put("labelEn", i == 0 ? "High Quality (HD)" : i == 1 ? "Medium Quality" : "Compact Size");
                                o.put("descAr", kbps > 0 ? "MP4 · " + kbps + " kbps" : "MP4");
                                o.put("descEn", kbps > 0 ? "MP4 · " + kbps + " kbps" : "MP4");
                                o.put("sizeText", vrBytes > 0 ? formatBytes(vrBytes, true) : "—");
                                if (vrBytes > 0) o.put("sizeBytes", vrBytes);
                                o.put("directUrl", vrUrl);
                                o.put("userAgent", MOBILE_CHROME_UA);
                                vOpts.put(o);
                            }

                            JSONObject authorObj = tweet.optJSONObject("author");
                            String author = authorObj != null ? authorObj.optString("name", authorObj.optString("screen_name", "X")) : "X";
                            String title = tweet.optString("text", "X Video " + statusId);
                            if (title.length() > 85) title = title.substring(0, 85);

                            JSObject out = new JSObject();
                            out.put("url", targetUrl);
                            out.put("title", title);
                            out.put("author", author);
                            out.put("duration", formatDuration(dur));
                            out.put("durationSec", dur);
                            out.put("thumbnail", v.optString("thumbnail_url", ""));
                            out.put("platformAr", "منصة X");
                            out.put("platformEn", "X Platform");
                            out.put("engine", "fxtwitter");
                            out.put("videoOptions", vOpts);
                            out.put("audioOptions", buildAudioOptions(dur, bestUrl, MOBILE_CHROME_UA, 0L));
                            out.put("fallbackStreamUrl", bestUrl);
                            out.put("fallbackAudioUrl", bestUrl);
                            out.put("previewUrl", mp4s.size() > 1 ? mp4s.get(1).optString("url", bestUrl) : bestUrl);
                            return out;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static class PageFetchResult {
        final String html;
        final String finalUrl;
        final String loginNextUrl;
        PageFetchResult(String html, String finalUrl, String loginNextUrl) {
            this.html = html;
            this.finalUrl = finalUrl;
            this.loginNextUrl = loginNextUrl;
        }
    }

    private static String unwrapFacebookLoginNext(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) return null;
        try {
            URL u = new URL(rawUrl);
            if (u.getHost().toLowerCase(Locale.US).endsWith("facebook.com") && u.getPath().contains("/login")) {
                String q = u.getQuery();
                if (q != null) {
                    for (String p : q.split("&")) {
                        if (p.startsWith("next=")) {
                            String decoded = URLDecoder.decode(p.substring(5), "UTF-8");
                            if (decoded.startsWith("http")) return decoded;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private PageFetchResult fetchHtmlWithCookies(String targetUrl, String ua, String referer) {
        Map<String, String> cookies = new LinkedHashMap<>();
        String current = targetUrl;
        String loginNextUrl = null;
        for (int hop = 0; hop < 8; hop++) {
            String unwrappedHere = unwrapFacebookLoginNext(current);
            if (unwrappedHere != null) loginNextUrl = unwrappedHere;

            HttpURLConnection conn = null;
            try {
                URL u = new URL(current);
                conn = (HttpURLConnection) u.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(12000);
                conn.setRequestProperty("User-Agent", ua);
                conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9,ar;q=0.8");
                conn.setRequestProperty("Sec-Fetch-Dest", "document");
                conn.setRequestProperty("Sec-Fetch-Mode", "navigate");
                conn.setRequestProperty("Sec-Fetch-Site", referer != null ? "same-origin" : "none");
                conn.setRequestProperty("Sec-Fetch-User", "?1");
                conn.setRequestProperty("Upgrade-Insecure-Requests", "1");
                if (referer != null && !referer.isEmpty()) {
                    conn.setRequestProperty("Referer", referer);
                }
                if (!cookies.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    for (Map.Entry<String, String> e : cookies.entrySet()) {
                        if (sb.length() > 0) sb.append("; ");
                        sb.append(e.getKey()).append("=").append(e.getValue());
                    }
                    conn.setRequestProperty("Cookie", sb.toString());
                }

                Map<String, List<String>> hdrs = conn.getHeaderFields();
                if (hdrs != null) {
                    for (Map.Entry<String, List<String>> entry : hdrs.entrySet()) {
                        if (entry.getKey() != null && entry.getKey().equalsIgnoreCase("Set-Cookie") && entry.getValue() != null) {
                            for (String sc : entry.getValue()) {
                                String pair = sc.split(";")[0].trim();
                                int eq = pair.indexOf('=');
                                if (eq > 0) {
                                    cookies.put(pair.substring(0, eq), pair.substring(eq + 1));
                                }
                            }
                        }
                    }
                }

                int code = conn.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String loc = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (loc == null || loc.isEmpty()) break;
                    String nextHop = new URL(u, loc).toString();
                    String nextU = unwrapFacebookLoginNext(nextHop);
                    if (nextU != null) loginNextUrl = nextU;
                    current = nextHop;
                    continue;
                }
                if (code < 200 || code >= 300) {
                    return loginNextUrl != null ? new PageFetchResult("", current, loginNextUrl) : null;
                }
                String body = readStreamAsString(conn.getInputStream());
                return new PageFetchResult(body, current, loginNextUrl);
            } catch (Exception ignored) {
                return loginNextUrl != null ? new PageFetchResult("", current, loginNextUrl) : null;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return loginNextUrl != null ? new PageFetchResult("", current, loginNextUrl) : null;
    }

    private static class DashParsed {
        String videoUrl = "";
        String audioUrl = "";
        int durationSec = 0;
    }

    private DashParsed parseFacebookDashManifest(String html) {
        DashParsed result = new DashParsed();
        String xml = "";
        Matcher dm = Pattern.compile("\"dash_manifest(?:_xml_string)?\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"", Pattern.CASE_INSENSITIVE).matcher(html);
        if (dm.find()) {
            xml = unescapeHtmlAndJson(dm.group(1)).replace("\\n", "\n");
        } else if (html.contains("<MPD") && html.contains("<BaseURL>")) {
            xml = unescapeHtmlAndJson(html);
        }
        if (xml.isEmpty() || !xml.contains("<BaseURL>")) return result;

        Matcher durM = Pattern.compile("mediaPresentationDuration=\"PT(?:(\\d+)H)?(?:(\\d+)M)?([\\d.]+)S\"", Pattern.CASE_INSENSITIVE).matcher(xml);
        if (durM.find()) {
            try {
                int h = durM.group(1) != null ? Integer.parseInt(durM.group(1)) : 0;
                int m = durM.group(2) != null ? Integer.parseInt(durM.group(2)) : 0;
                double s = Double.parseDouble(durM.group(3));
                result.durationSec = (int) Math.round(h * 3600 + m * 60 + s);
            } catch (Exception ignored) {}
        }

        String bestAvcVideo = "";
        long bestAvcScore = -1;
        String bestAnyVideo = "";
        long bestAnyScore = -1;
        String bestAudio = "";
        long bestAudioScore = -1;

        Matcher asetM = Pattern.compile("<AdaptationSet\\b([^>]*)>([\\s\\S]*?)</AdaptationSet>", Pattern.CASE_INSENSITIVE).matcher(xml);
        while (asetM.find()) {
            String asetAttrs = asetM.group(1) != null ? asetM.group(1) : "";
            String asetBody = asetM.group(2) != null ? asetM.group(2) : "";
            boolean isAudioSet = asetAttrs.toLowerCase(Locale.US).contains("contenttype=\"audio\"") || asetAttrs.toLowerCase(Locale.US).contains("mimetype=\"audio/");
            boolean isVideoSet = asetAttrs.toLowerCase(Locale.US).contains("contenttype=\"video\"") || asetAttrs.toLowerCase(Locale.US).contains("mimetype=\"video/");

            Matcher repM = Pattern.compile("<Representation\\b([^>]*)>([\\s\\S]*?)</Representation>", Pattern.CASE_INSENSITIVE).matcher(asetBody);
            while (repM.find()) {
                String repAttrs = repM.group(1) != null ? repM.group(1) : "";
                String repBody = repM.group(2) != null ? repM.group(2) : "";
                String baseRaw = firstMatch(repBody, "<BaseURL>([^<]+)</BaseURL>");
                if (baseRaw == null) continue;
                String baseUrl = unescapeHtmlAndJson(baseRaw);
                if (!baseUrl.startsWith("http")) continue;

                long bw = parseLongSafe(firstMatch(repAttrs, "bandwidth=[\"'](\\d+)[\"']"));
                long height = parseLongSafe(firstMatch(repAttrs, "height=[\"'](\\d+)[\"']"));
                String codecs = firstMatch(repAttrs, "codecs=[\"']([^\"']+)[\"']");
                if (codecs == null) codecs = "";
                String mime = firstMatch(repAttrs, "mimeType=[\"']([^\"']+)[\"']");
                if (mime == null) mime = "";
                String cl = codecs.toLowerCase(Locale.US);
                String ml = mime.toLowerCase(Locale.US);

                boolean repAudio = isAudioSet || ml.contains("audio/") || cl.contains("mp4a") || cl.contains("opus");
                boolean repVideo = isVideoSet || ml.contains("video/") || cl.contains("avc1") || cl.contains("av01") || cl.contains("vp9") || cl.contains("vp09") || cl.contains("hev1");

                if (repAudio && !repVideo) {
                    long aScore = (cl.contains("mp4a") ? 10_000_000L : 0L) + bw;
                    if (aScore > bestAudioScore) {
                        bestAudioScore = aScore;
                        bestAudio = baseUrl;
                    }
                } else if (repVideo) {
                    long vScore = height * 100_000L + bw;
                    if (cl.contains("avc1") && vScore > bestAvcScore) {
                        bestAvcScore = vScore;
                        bestAvcVideo = baseUrl;
                    }
                    if (vScore > bestAnyScore) {
                        bestAnyScore = vScore;
                        bestAnyVideo = baseUrl;
                    }
                }
            }
        }

        result.videoUrl = !bestAvcVideo.isEmpty() ? bestAvcVideo : bestAnyVideo;
        result.audioUrl = bestAudio;
        return result;
    }

    private JSObject extractFacebookMedia(String html, String originalUrl) throws Exception {
        String hdRaw = firstMatch(html,
            "\"browser_native_hd_url\"\\s*:\\s*\"([^\"]+)\"",
            "\"playable_url_quality_hd\"\\s*:\\s*\"([^\"]+)\"",
            "\"hd_src_no_ratelimit\"\\s*:\\s*\"([^\"]+)\"",
            "\"hd_src\"\\s*:\\s*\"([^\"]+)\""
        );
        String sdRaw = firstMatch(html,
            "\"browser_native_sd_url\"\\s*:\\s*\"([^\"]+)\"",
            "\"playable_url\"\\s*:\\s*\"([^\"]+)\"",
            "\"sd_src_no_ratelimit\"\\s*:\\s*\"([^\"]+)\"",
            "\"sd_src\"\\s*:\\s*\"([^\"]+)\"",
            "<meta[^>]+property=[\"']og:video(?::secure_url)?[\"'][^>]+content=[\"']([^\"']+)[\"']",
            "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:video(?::secure_url)?[\"']"
        );

        String hdUrl = hdRaw != null ? unescapeHtmlAndJson(hdRaw) : "";
        if (!hdUrl.startsWith("http")) hdUrl = "";
        String sdUrl = sdRaw != null ? unescapeHtmlAndJson(sdRaw) : "";
        if (!sdUrl.startsWith("http")) sdUrl = "";

        if (hdUrl.isEmpty() || sdUrl.isEmpty()) {
            Matcher pm = Pattern.compile("\"progressive_url\"\\s*:\\s*\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(html);
            while (pm.find()) {
                String cand = unescapeHtmlAndJson(pm.group(1));
                if (!cand.startsWith("http")) continue;
                int s = Math.max(0, pm.start() - 180);
                int e = Math.min(html.length(), pm.end() + 180);
                String ctx = html.substring(s, e);
                if (Pattern.compile("\"quality\"\\s*:\\s*\"HD\"", Pattern.CASE_INSENSITIVE).matcher(ctx).find()) {
                    if (hdUrl.isEmpty()) hdUrl = cand;
                } else if (sdUrl.isEmpty()) {
                    sdUrl = cand;
                }
            }
        }

        if (hdUrl.isEmpty() && sdUrl.isEmpty()) {
            String redirSrc = firstMatch(html, "/video_redirect/\\?src=([^\"'&<>\\s]+)");
            if (redirSrc != null && !redirSrc.isEmpty()) {
                try {
                    String dec = URLDecoder.decode(unescapeHtmlAndJson(redirSrc), "UTF-8");
                    if (dec.startsWith("http")) sdUrl = dec;
                } catch (Exception ignored) {}
            }
        }

        DashParsed dash = parseFacebookDashManifest(html);
        String audioUrl = "";
        if (hdUrl.isEmpty() && sdUrl.isEmpty() && !dash.videoUrl.isEmpty()) {
            sdUrl = dash.videoUrl;
            audioUrl = dash.audioUrl;
        }

        if (hdUrl.isEmpty() && sdUrl.isEmpty()) return null;

        String bestStream = !hdUrl.isEmpty() ? hdUrl : sdUrl;
        String sdStream = !sdUrl.isEmpty() ? sdUrl : hdUrl;

        int durSec = 0;
        String msDur = firstMatch(html, "\"playable_duration_in_ms\"\\s*:\\s*(\\d+)");
        if (msDur != null) {
            durSec = (int) Math.round(parseLongSafe(msDur) / 1000.0);
        }
        if (durSec <= 0) durSec = dash.durationSec;

        String title = firstMatch(html,
            "<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']",
            "<meta[^>]+name=[\"']twitter:title[\"'][^>]+content=[\"']([^\"']+)[\"']",
            "<title>([^<]+)</title>"
        );
        if (title != null) {
            title = unescapeHtmlAndJson(title).replaceAll("\\s*\\|\\s*Facebook$", "").trim();
        }
        if (title == null || title.isEmpty() || title.equalsIgnoreCase("Facebook")) {
            title = "Facebook Video";
        }

        String thumb = firstMatch(html,
            "<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']",
            "\"preferred_thumbnail\"\\s*:\\s*\\{[^}]*\"image\"\\s*:\\s*\\{\\s*\"uri\"\\s*:\\s*\"([^\"]+)\""
        );
        thumb = thumb != null ? unescapeHtmlAndJson(thumb) : "";

        long hdBytes = !hdUrl.isEmpty() ? probeContentLength(hdUrl, DESKTOP_CHROME_UA) : 0L;
        long sdBytes = !sdUrl.isEmpty() && !sdUrl.equals(hdUrl) ? probeContentLength(sdUrl, DESKTOP_CHROME_UA) : hdBytes;

        JSArray vOpts = new JSArray();
        if (!hdUrl.isEmpty()) {
            JSObject opt = new JSObject();
            opt.put("key", "best");
            opt.put("labelAr", "جودة عالية (HD · MP4)");
            opt.put("labelEn", "High Quality (HD · MP4)");
            opt.put("descAr", "MP4 · أعلى دقة من فيسبوك");
            opt.put("descEn", "MP4 · Facebook HD");
            opt.put("sizeText", hdBytes > 0 ? formatBytes(hdBytes, true) : "—");
            if (hdBytes > 0) opt.put("sizeBytes", hdBytes);
            opt.put("directUrl", hdUrl);
            if (!audioUrl.isEmpty()) opt.put("audioUrl", audioUrl);
            opt.put("userAgent", DESKTOP_CHROME_UA);
            vOpts.put(opt);
        }
        if (!sdUrl.isEmpty() && !sdUrl.equals(hdUrl)) {
            JSObject opt = new JSObject();
            opt.put("key", !hdUrl.isEmpty() ? "480" : "best");
            opt.put("labelAr", !hdUrl.isEmpty() ? "جودة قياسية (SD · MP4)" : "أفضل جودة متاحة (MP4)");
            opt.put("labelEn", !hdUrl.isEmpty() ? "Standard Quality (SD · MP4)" : "Best Available (MP4)");
            opt.put("descAr", !hdUrl.isEmpty() ? "MP4 · حجم أقل" : "MP4 · حفظ مباشر");
            opt.put("descEn", !hdUrl.isEmpty() ? "MP4 · Compact Size" : "MP4 · Direct Save");
            opt.put("sizeText", sdBytes > 0 ? formatBytes(sdBytes, true) : "—");
            if (sdBytes > 0) opt.put("sizeBytes", sdBytes);
            opt.put("directUrl", sdUrl);
            if (!audioUrl.isEmpty()) opt.put("audioUrl", audioUrl);
            opt.put("userAgent", DESKTOP_CHROME_UA);
            vOpts.put(opt);
        }

        String effAudio = !audioUrl.isEmpty() ? audioUrl : sdStream;
        JSObject out = new JSObject();
        out.put("url", originalUrl);
        out.put("title", title.length() > 85 ? title.substring(0, 85) : title);
        out.put("author", "Facebook");
        out.put("duration", durSec > 0 ? formatDuration(durSec) : "—");
        out.put("durationSec", durSec);
        out.put("thumbnail", thumb.startsWith("http") ? thumb : "");
        out.put("platformAr", "فيسبوك");
        out.put("platformEn", "Facebook");
        out.put("engine", "direct");
        out.put("videoOptions", vOpts);
        out.put("audioOptions", buildAudioOptions(durSec, effAudio, DESKTOP_CHROME_UA, 0L));
        out.put("fallbackStreamUrl", bestStream);
        out.put("fallbackAudioUrl", effAudio);
        out.put("previewUrl", sdStream);
        return out;
    }

    private JSObject resolveFacebook(String targetUrl) {
        try {
            List<String[]> candidates = new ArrayList<>();
            List<String> discoveredUrls = new ArrayList<>();
            discoveredUrls.add(targetUrl);
            String canonical = targetUrl;

            PageFetchResult p1 = fetchHtmlWithCookies(targetUrl, DESKTOP_CHROME_UA, null);
            if (p1 != null) {
                if (p1.loginNextUrl != null && !p1.loginNextUrl.isEmpty()) {
                    discoveredUrls.add(p1.loginNextUrl);
                    canonical = p1.loginNextUrl;
                } else if (p1.finalUrl != null && !p1.finalUrl.isEmpty()) {
                    discoveredUrls.add(p1.finalUrl);
                    canonical = p1.finalUrl;
                }

                if (p1.html != null && !p1.html.isEmpty()) {
                    JSObject found1 = extractFacebookMedia(p1.html, targetUrl);
                    if (found1 != null) return found1;

                    String ogUrl = firstMatch(p1.html,
                        "<meta[^>]+property=[\"']og:url[\"'][^>]+content=[\"']([^\"']+)[\"']",
                        "<link[^>]+rel=[\"']canonical[\"'][^>]+href=[\"']([^\"']+)[\"']",
                        "<meta[^>]+http-equiv=[\"']refresh[\"'][^>]+content=[\"'][^\"']*url=([^\"'\\s>]+)"
                    );
                    if (ogUrl != null) {
                        String cu = unescapeHtmlAndJson(ogUrl);
                        if (cu.startsWith("http") && !cu.contains("/login")) {
                            discoveredUrls.add(cu);
                            if (canonical.equals(targetUrl) || canonical.contains("/share/") || canonical.contains("/login")) {
                                canonical = cu;
                            }
                        }
                    }

                    String bodyVid = firstMatch(p1.html,
                        "\"(?:video_id|story_fbid|shareable_id)\"\\s*:\\s*\"(\\d{8,})\"",
                        "facebook\\.com(?:\\\\)?/(?:reel|videos)(?:\\\\)?/(\\d{8,})"
                    );
                    if (bodyVid != null && !bodyVid.isEmpty()) {
                        discoveredUrls.add("https://www.facebook.com/watch/?v=" + bodyVid);
                        discoveredUrls.add("https://www.facebook.com/reel/" + bodyVid);
                    }
                }
            }

            String bestNonLogin = null;
            for (String u : discoveredUrls) {
                if (!u.contains("/login") && Pattern.compile("/(?:reel|videos|watch)", Pattern.CASE_INSENSITIVE).matcher(u).find()) {
                    bestNonLogin = u;
                    break;
                }
            }
            if (bestNonLogin == null) {
                bestNonLogin = canonical.contains("/login") ? targetUrl : canonical;
            }

            if (!bestNonLogin.contains("plugins/video.php")) {
                String plugUrl = "https://www.facebook.com/plugins/video.php?href=" + URLEncoder.encode(bestNonLogin, "UTF-8") + "&show_text=0&width=560";
                candidates.add(new String[] { plugUrl, DESKTOP_CHROME_UA });
                candidates.add(new String[] { plugUrl, FB_EXTERNAL_HIT_UA });
            }

            candidates.add(new String[] { bestNonLogin, FB_EXTERNAL_HIT_UA });
            if (!bestNonLogin.equals(targetUrl)) {
                candidates.add(new String[] { targetUrl, FB_EXTERNAL_HIT_UA });
                candidates.add(new String[] { bestNonLogin, DESKTOP_CHROME_UA });
            }

            String idHaystack = String.join(" ", discoveredUrls);
            Matcher idM = Pattern.compile("(?:\\/(?:videos?|reel|reels|stories)\\/|story_fbid=|watch\\/?\\?v=)(\\d{8,})", Pattern.CASE_INSENSITIVE).matcher(idHaystack);
            if (idM.find()) {
                String vidId = idM.group(1);
                String watchPlug = "https://www.facebook.com/plugins/video.php?href=" + URLEncoder.encode("https://www.facebook.com/watch/?v=" + vidId, "UTF-8") + "&show_text=0&width=560";
                candidates.add(new String[] { watchPlug, DESKTOP_CHROME_UA });
                candidates.add(new String[] { "https://www.facebook.com/watch/?v=" + vidId, FB_EXTERNAL_HIT_UA });
                candidates.add(new String[] { "https://www.facebook.com/watch/?v=" + vidId, DESKTOP_CHROME_UA });
                candidates.add(new String[] { "https://www.facebook.com/reel/" + vidId, FB_EXTERNAL_HIT_UA });
                candidates.add(new String[] { "https://mbasic.facebook.com/watch/?v=" + vidId, MOBILE_CHROME_UA });
            }

            try {
                URL cu = new URL(bestNonLogin);
                if (!cu.getHost().startsWith("mbasic.")) {
                    candidates.add(new String[] { bestNonLogin.replaceFirst("://[^/]+", "://mbasic.facebook.com"), MOBILE_CHROME_UA });
                }
            } catch (Exception ignored) {}

            Set<String> visited = new HashSet<>();
            for (String[] cand : candidates) {
                String key = cand[1] + "::" + cand[0];
                if (visited.contains(key)) continue;
                visited.add(key);
                PageFetchResult res = fetchHtmlWithCookies(cand[0], cand[1], "https://www.facebook.com/");
                if (res != null && res.html != null && !res.html.isEmpty()) {
                    JSObject found = extractFacebookMedia(res.html, targetUrl);
                    if (found != null) return found;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private JSObject resolveInstagram(String targetUrl) {
        try {
            PageFetchResult p1 = fetchHtmlWithCookies(targetUrl, DESKTOP_CHROME_UA, null);
            String finalUrl = (p1 != null && p1.finalUrl != null) ? p1.finalUrl : targetUrl;
            List<String> htmls = new ArrayList<>();
            if (p1 != null && p1.html != null) htmls.add(p1.html);

            Matcher igM = Pattern.compile("/(reel|reels|p|tv)/([A-Za-z0-9_-]+)").matcher(finalUrl);
            if (igM.find()) {
                String[] embedUrls = {
                    "https://www.instagram.com/" + igM.group(1) + "/" + igM.group(2) + "/embed/captioned/",
                    "https://www.instagram.com/" + igM.group(1) + "/" + igM.group(2) + "/embed/"
                };
                for (String ep : embedUrls) {
                    PageFetchResult er = fetchHtmlWithCookies(ep, DESKTOP_CHROME_UA, "https://www.instagram.com/");
                    if (er != null && er.html != null) htmls.add(er.html);
                }
            }

            for (String h : htmls) {
                String raw = firstMatch(h,
                    "<meta[^>]+property=[\"']og:video:secure_url[\"'][^>]+content=[\"']([^\"']+)[\"']",
                    "<meta[^>]+property=[\"']og:video[\"'][^>]+content=[\"']([^\"']+)[\"']",
                    "\"video_url\"\\s*:\\s*\"([^\"]+)\"",
                    "<video[^>]+src=[\"']([^\"']+)[\"']"
                );
                if (raw == null) continue;
                String clean = unescapeHtmlAndJson(raw);
                if (!clean.startsWith("http")) continue;

                long bytes = probeContentLength(clean, DESKTOP_CHROME_UA);
                String title = firstMatch(h,
                    "<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']",
                    "<title>([^<]+)</title>"
                );
                title = title != null ? unescapeHtmlAndJson(title).trim() : "Instagram Video";
                if (title.isEmpty()) title = "Instagram Video";
                String thumb = firstMatch(h, "<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']");
                thumb = thumb != null ? unescapeHtmlAndJson(thumb) : "";

                JSArray vOpts = new JSArray();
                JSObject opt = new JSObject();
                opt.put("key", "best");
                opt.put("labelAr", "أفضل جودة متاحة (MP4)");
                opt.put("labelEn", "Best Available Quality (MP4)");
                opt.put("descAr", "MP4 · حفظ مباشر");
                opt.put("descEn", "MP4 · Direct Save");
                opt.put("sizeText", bytes > 0 ? formatBytes(bytes, true) : "—");
                if (bytes > 0) opt.put("sizeBytes", bytes);
                opt.put("directUrl", clean);
                opt.put("userAgent", DESKTOP_CHROME_UA);
                vOpts.put(opt);

                JSObject out = new JSObject();
                out.put("url", targetUrl);
                out.put("title", title.length() > 85 ? title.substring(0, 85) : title);
                out.put("author", "Instagram");
                out.put("duration", "—");
                out.put("durationSec", 0);
                out.put("thumbnail", thumb.startsWith("http") ? thumb : "");
                out.put("platformAr", "إنستغرام");
                out.put("platformEn", "Instagram");
                out.put("engine", "direct");
                out.put("videoOptions", vOpts);
                out.put("audioOptions", buildAudioOptions(0, clean, DESKTOP_CHROME_UA, 0L));
                out.put("fallbackStreamUrl", clean);
                out.put("fallbackAudioUrl", clean);
                out.put("previewUrl", clean);
                return out;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private JSObject resolveSocialPageHtml(String targetUrl) {
        try {
            PageFetchResult fetched = fetchHtmlWithCookies(targetUrl, MOBILE_CHROME_UA, null);
            if (fetched == null || fetched.html == null || fetched.html.isEmpty()) return null;
            String html = fetched.html;
            String finalUrl = fetched.finalUrl != null ? fetched.finalUrl : targetUrl;
            String lower = finalUrl.toLowerCase(Locale.US);
            String platAr = "فيديو";
            String platEn = "Video";
            if (lower.contains("instagram.com")) { platAr = "إنستغرام"; platEn = "Instagram"; }
            else if (lower.contains("facebook.com") || lower.contains("fb.watch") || lower.contains("fb.com")) { platAr = "فيسبوك"; platEn = "Facebook"; }
            else if (lower.contains("reddit.com")) { platAr = "ريديت"; platEn = "Reddit"; }
            else if (lower.contains("vimeo.com")) { platAr = "فيميو"; platEn = "Vimeo"; }
            else if (lower.contains("soundcloud.com")) { platAr = "ساوند كلاود"; platEn = "SoundCloud"; }
            else if (lower.contains("threads.")) { platAr = "ثريدز"; platEn = "Threads"; }

            String videoUrl = firstMatch(html,
                "<meta[^>]+property=[\"']og:video:secure_url[\"'][^>]+content=[\"']([^\"']+)[\"']",
                "<meta[^>]+property=[\"']og:video[\"'][^>]+content=[\"']([^\"']+)[\"']",
                "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:video:secure_url[\"']",
                "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:video[\"']",
                "\"playable_url_quality_hd\"\\s*:\\s*\"([^\"]+)\"",
                "\"playable_url\"\\s*:\\s*\"([^\"]+)\"",
                "\"hd_src\"\\s*:\\s*\"([^\"]+)\"",
                "\"sd_src\"\\s*:\\s*\"([^\"]+)\"",
                "\"video_url\"\\s*:\\s*\"([^\"]+)\"",
                "\"contentUrl\"\\s*:\\s*\"([^\"]+)\""
            );

            if (videoUrl == null || videoUrl.isEmpty()) return null;
            videoUrl = unescapeHtmlAndJson(videoUrl);
            if (!videoUrl.startsWith("http")) return null;

            String title = firstMatch(html,
                "<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']",
                "<title>([^<]+)</title>"
            );
            if (title == null || title.trim().isEmpty()) title = platEn + " Video";
            else title = unescapeHtmlAndJson(title).trim();

            String thumb = firstMatch(html,
                "<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']"
            );
            if (thumb != null) thumb = unescapeHtmlAndJson(thumb);

            long videoBytes = probeContentLength(videoUrl, MOBILE_CHROME_UA);

            JSArray vOpts = new JSArray();
            JSObject opt = new JSObject();
            opt.put("key", "best");
            opt.put("labelAr", "أفضل جودة متاحة (MP4)");
            opt.put("labelEn", "Best Available Quality (MP4)");
            opt.put("descAr", "MP4 · حفظ مباشر");
            opt.put("descEn", "MP4 · Direct Save");
            opt.put("sizeText", videoBytes > 0 ? formatBytes(videoBytes, true) : "—");
            if (videoBytes > 0) opt.put("sizeBytes", videoBytes);
            opt.put("directUrl", videoUrl);
            opt.put("userAgent", MOBILE_CHROME_UA);
            vOpts.put(opt);

            JSObject out = new JSObject();
            out.put("url", targetUrl);
            out.put("title", title.length() > 85 ? title.substring(0, 85) : title);
            out.put("author", platEn);
            out.put("duration", "—");
            out.put("durationSec", 0);
            out.put("thumbnail", thumb != null ? thumb : "");
            out.put("platformAr", platAr);
            out.put("platformEn", platEn);
            out.put("engine", "direct");
            out.put("videoOptions", vOpts);
            out.put("audioOptions", buildAudioOptions(0, videoUrl, MOBILE_CHROME_UA, 0L));
            out.put("fallbackStreamUrl", videoUrl);
            out.put("fallbackAudioUrl", videoUrl);
            out.put("previewUrl", videoUrl);
            return out;
        } catch (Exception ignored) {
            return null;
        }
    }

    private JSObject buildDirectResult(String directUrl, String platAr, String platEn, boolean audioOnly) {
        long directBytes = probeContentLength(directUrl, MOBILE_CHROME_UA);

        JSArray vOpts = new JSArray();
        JSObject opt = new JSObject();
        opt.put("key", "best");
        opt.put("labelAr", "الجودة الأصلية (ملف مباشر)");
        opt.put("labelEn", "Original Quality (Direct File)");
        opt.put("descAr", audioOnly ? "ملف صوتي مباشر" : "ملف فيديو مباشر");
        opt.put("descEn", audioOnly ? "Direct Audio" : "Direct Video");
        opt.put("sizeText", directBytes > 0 ? formatBytes(directBytes, true) : "—");
        if (directBytes > 0) opt.put("sizeBytes", directBytes);
        opt.put("directUrl", directUrl);
        opt.put("userAgent", MOBILE_CHROME_UA);
        vOpts.put(opt);

        String name = "media-file";
        try {
            String path = new URL(directUrl).getPath();
            String last = path.substring(path.lastIndexOf('/') + 1);
            if (!last.isEmpty()) name = last.replaceFirst("\\.[^.]+$", "");
        } catch (Exception ignored) {}

        JSObject out = new JSObject();
        out.put("url", directUrl);
        out.put("title", name);
        out.put("author", platEn);
        out.put("duration", "—");
        out.put("durationSec", 0);
        out.put("thumbnail", "");
        out.put("platformAr", platAr);
        out.put("platformEn", platEn);
        out.put("engine", "direct");
        out.put("videoOptions", vOpts);
        out.put("audioOptions", buildAudioOptions(0, directUrl, MOBILE_CHROME_UA, audioOnly ? directBytes : 0L));
        out.put("fallbackStreamUrl", directUrl);
        out.put("fallbackAudioUrl", directUrl);
        if (!audioOnly) out.put("previewUrl", directUrl);
        return out;
    }

    private JSArray buildAudioOptions(int durSec, String directAudioUrl, String ua, long exactAudioBytes) {
        long resolvedAudioBytes = exactAudioBytes;
        String lower = directAudioUrl != null ? directAudioUrl.toLowerCase(Locale.US) : "";
        if (resolvedAudioBytes <= 0 && !lower.isEmpty() && (lower.contains("mime=audio") || lower.contains("tikwm") || isAudioUrl(lower))) {
            resolvedAudioBytes = probeContentLength(directAudioUrl, ua);
        }

        JSArray arr = new JSArray();
        String[][] specs = {
            { "m4a", "M4A – صوت AAC أصلي", "M4A – Original AAC Audio", "M4A / AAC", "M4A / AAC", "128" },
            { "mp3-320", "MP3 – جودة عالية (320 kbps)", "MP3 – High Quality (320 kbps)", "صوت نقي", "Purest Audio", "320" },
            { "mp3-192", "MP3 – جودة متوسطة (192 kbps)", "MP3 – Medium Quality (192 kbps)", "جودة معيارية", "Standard Quality", "192" }
        };
        for (String[] s : specs) {
            int kbps = Integer.parseInt(s[5]);
            long bytes = 0L;
            boolean isExact = false;
            if ("m4a".equals(s[0]) && resolvedAudioBytes > 0) {
                bytes = resolvedAudioBytes;
                isExact = true;
            } else if (resolvedAudioBytes > 0 && isAudioUrl(lower)) {
                bytes = resolvedAudioBytes;
                isExact = true;
            } else if (durSec > 0) {
                bytes = (kbps * 1000L * durSec) / 8L;
            }

            JSObject o = new JSObject();
            o.put("key", s[0]);
            o.put("labelAr", s[1]);
            o.put("labelEn", s[2]);
            o.put("descAr", s[3]);
            o.put("descEn", s[4]);
            o.put("sizeText", bytes > 0 ? formatBytes(bytes, isExact) : "—");
            if (bytes > 0) o.put("sizeBytes", bytes);
            o.put("directUrl", directAudioUrl);
            o.put("userAgent", ua);
            arr.put(o);
        }
        return arr;
    }

    private void downloadFile(
        String urlStr,
        String userAgent,
        File destFile,
        String jobId,
        String phase,
        double startPct,
        double endPct,
        AtomicBoolean cancelled
    ) throws Exception {
        HttpURLConnection conn = null;
        try {
            String activeUa = (userAgent != null && !userAgent.trim().isEmpty()) ? userAgent : DESKTOP_CHROME_UA;
            conn = openConnectionFollowingRedirects(urlStr, activeUa, 15000, "GET", true);
            int code = conn.getResponseCode();
            if (code == 403 || code == 400) {
                String[] retryUas = new String[] { FB_EXTERNAL_HIT_UA, MOBILE_CHROME_UA, DESKTOP_CHROME_UA };
                boolean[] retryRefs = new boolean[] { false, false, false };
                for (int r = 0; r < retryUas.length; r++) {
                    conn.disconnect();
                    conn = openConnectionFollowingRedirects(urlStr, retryUas[r], 15000, "GET", retryRefs[r]);
                    code = conn.getResponseCode();
                    if (code >= 200 && code < 300) break;
                }
            }
            if (code < 200 || code >= 300) {
                throw new Exception("HTTP_" + code);
            }

            long total = conn.getContentLengthLong();
            long downloaded = 0;
            long lastTick = System.currentTimeMillis();
            long lastBytes = 0;

            try (InputStream in = new BufferedInputStream(conn.getInputStream(), 32768);
                 OutputStream out = new BufferedOutputStream(new FileOutputStream(destFile), 32768)) {
                byte[] buf = new byte[16384];
                int read;
                while ((read = in.read(buf)) != -1) {
                    if (cancelled.get()) throw new Exception("CANCELLED");
                    out.write(buf, 0, read);
                    downloaded += read;

                    long now = System.currentTimeMillis();
                    if (now - lastTick >= 220) {
                        double dt = (now - lastTick) / 1000.0;
                        long delta = downloaded - lastBytes;
                        double bps = dt > 0 ? delta / dt : 0;
                        String mbps = String.format(Locale.US, "%.1f", Math.max(0.1, bps / (1024.0 * 1024.0)));
                        double pct = total > 0
                            ? Math.min(endPct, startPct + ((double) downloaded / (double) total) * (endPct - startPct))
                            : Math.min(endPct - 2.0, startPct + 10.0);
                        Integer eta = (total > 0 && bps > 0)
                            ? Math.max(1, (int) Math.round((total - downloaded) / bps))
                            : null;
                        emitProgress(jobId, phase, pct, mbps, eta);
                        lastTick = now;
                        lastBytes = downloaded;
                    }
                }
                out.flush();
            }
            emitProgress(jobId, phase, endPct, null, null);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private boolean muxMp4AndM4a(File videoFile, File audioFile, File outFile) {
        MediaExtractor vExtractor = new MediaExtractor();
        MediaExtractor aExtractor = new MediaExtractor();
        MediaMuxer muxer = null;
        try {
            vExtractor.setDataSource(videoFile.getAbsolutePath());
            aExtractor.setDataSource(audioFile.getAbsolutePath());

            int vTrackIdx = -1;
            MediaFormat vFormat = null;
            for (int i = 0; i < vExtractor.getTrackCount(); i++) {
                MediaFormat fmt = vExtractor.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    vTrackIdx = i;
                    vFormat = fmt;
                    break;
                }
            }

            int aTrackIdx = -1;
            MediaFormat aFormat = null;
            for (int i = 0; i < aExtractor.getTrackCount(); i++) {
                MediaFormat fmt = aExtractor.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    aTrackIdx = i;
                    aFormat = fmt;
                    break;
                }
            }

            if (vTrackIdx < 0 || aTrackIdx < 0 || vFormat == null || aFormat == null) return false;

            vExtractor.selectTrack(vTrackIdx);
            aExtractor.selectTrack(aTrackIdx);

            muxer = new MediaMuxer(outFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            int outVTrack = muxer.addTrack(vFormat);
            int outATrack = muxer.addTrack(aFormat);
            muxer.start();

            ByteBuffer buffer = ByteBuffer.allocate(512 * 1024);
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();

            while (true) {
                int sampleSize = vExtractor.readSampleData(buffer, 0);
                if (sampleSize < 0) break;
                info.offset = 0;
                info.size = sampleSize;
                info.presentationTimeUs = vExtractor.getSampleTime();
                info.flags = vExtractor.getSampleFlags();
                muxer.writeSampleData(outVTrack, buffer, info);
                vExtractor.advance();
            }

            while (true) {
                int sampleSize = aExtractor.readSampleData(buffer, 0);
                if (sampleSize < 0) break;
                info.offset = 0;
                info.size = sampleSize;
                info.presentationTimeUs = aExtractor.getSampleTime();
                info.flags = aExtractor.getSampleFlags();
                muxer.writeSampleData(outATrack, buffer, info);
                aExtractor.advance();
            }

            return true;
        } catch (Exception e) {
            return false;
        } finally {
            try { if (muxer != null) { muxer.stop(); muxer.release(); } } catch (Exception ignored) {}
            try { vExtractor.release(); } catch (Exception ignored) {}
            try { aExtractor.release(); } catch (Exception ignored) {}
        }
    }

    private boolean demuxAudioToM4a(File inputMedia, File outM4a) {
        MediaExtractor extractor = new MediaExtractor();
        MediaMuxer muxer = null;
        try {
            extractor.setDataSource(inputMedia.getAbsolutePath());
            int aTrackIdx = -1;
            MediaFormat aFormat = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat fmt = extractor.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    aTrackIdx = i;
                    aFormat = fmt;
                    break;
                }
            }
            if (aTrackIdx < 0 || aFormat == null) return false;
            extractor.selectTrack(aTrackIdx);
            muxer = new MediaMuxer(outM4a.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            int outATrack = muxer.addTrack(aFormat);
            muxer.start();
            ByteBuffer buffer = ByteBuffer.allocate(256 * 1024);
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            while (true) {
                int sampleSize = extractor.readSampleData(buffer, 0);
                if (sampleSize < 0) break;
                info.offset = 0;
                info.size = sampleSize;
                info.presentationTimeUs = extractor.getSampleTime();
                info.flags = extractor.getSampleFlags();
                muxer.writeSampleData(outATrack, buffer, info);
                extractor.advance();
            }
            return outM4a.exists() && outM4a.length() > 0;
        } catch (Exception ignored) {
            return false;
        } finally {
            try { if (muxer != null) { muxer.stop(); muxer.release(); } } catch (Exception ignored) {}
            try { extractor.release(); } catch (Exception ignored) {}
        }
    }

    private String saveToDownloads(File sourceFile, String filename, String mimeType) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Tanzeelati");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("MEDIASTORE_INSERT_FAILED");

            try (InputStream in = new FileInputStream(sourceFile);
                 OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new Exception("OUTPUT_STREAM_NULL");
                byte[] buf = new byte[16384];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                out.flush();
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return "Download/Tanzeelati/" + filename;
        } else {
            File dlDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Tanzeelati");
            if (!dlDir.exists()) dlDir.mkdirs();
            File dest = new File(dlDir, filename);
            copyFile(sourceFile, dest);
            MediaScannerConnection.scanFile(getContext(), new String[] { dest.getAbsolutePath() }, new String[] { mimeType }, null);
            return dest.getAbsolutePath();
        }
    }

    private static String inferCdnReferer(String urlStr) {
        if (urlStr == null) return null;
        String lower = urlStr.toLowerCase(Locale.US);
        if (lower.contains("fbcdn.net") || lower.contains("facebook.com")) return "https://www.facebook.com/";
        if (lower.contains("cdninstagram.com") || lower.contains("instagram.com")) return "https://www.instagram.com/";
        if (lower.contains("tiktok") || lower.contains("muscdn") || lower.contains("byteoversea")) return "https://www.tiktok.com/";
        if (lower.contains("twimg.com") || lower.contains("twitter.com") || lower.contains("x.com")) return "https://x.com/";
        return null;
    }

    private HttpURLConnection openConnectionFollowingRedirects(String urlStr, String ua, int timeoutMs, String method) throws Exception {
        return openConnectionFollowingRedirects(urlStr, ua, timeoutMs, method, true);
    }

    private HttpURLConnection openConnectionFollowingRedirects(String urlStr, String ua, int timeoutMs, String method, boolean sendReferer) throws Exception {
        String current = urlStr;
        String referer = sendReferer ? inferCdnReferer(urlStr) : null;
        for (int i = 0; i < 8; i++) {
            URL u = new URL(current);
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod(method);
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestProperty("User-Agent", ua);
            conn.setRequestProperty("Accept", "*/*");
            conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
            if (referer != null) {
                conn.setRequestProperty("Referer", referer);
            }
            int code = conn.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null || loc.isEmpty()) return conn;
                current = new URL(u, loc).toString();
                continue;
            }
            return conn;
        }
        throw new Exception("TOO_MANY_REDIRECTS");
    }

    private String readStreamAsString(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int len;
        while ((len = in.read(buf)) != -1) {
            bos.write(buf, 0, len);
            if (bos.size() > 12 * 1024 * 1024) break;
        }
        return bos.toString(StandardCharsets.UTF_8.name());
    }

    private static void copyFile(File src, File dst) throws Exception {
        try (InputStream in = new FileInputStream(src);
             OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[16384];
            int len;
            while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
            out.flush();
        }
    }

    private static void deleteDir(File dir) {
        if (dir == null || !dir.exists()) return;
        File[] children = dir.listFiles();
        if (children != null) {
            for (File c : children) deleteDir(c);
        }
        dir.delete();
    }

    private static String extractCleanUrl(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        String extracted = t;
        Matcher m = Pattern.compile("(https?://[^\\s<>\"'{}|\\\\^`]+)", Pattern.CASE_INSENSITIVE).matcher(t);
        if (m.find()) {
            extracted = m.group(1);
        } else if (!t.startsWith("http://") && !t.startsWith("https://") && !t.isEmpty()) {
            extracted = "https://" + t;
        }
        try {
            URL u = new URL(extracted);
            String host = u.getHost().toLowerCase(Locale.US);
            if ("l.facebook.com".equals(host) || "lm.facebook.com".equals(host)) {
                String q = u.getQuery();
                if (q != null) {
                    for (String p : q.split("&")) {
                        if (p.startsWith("u=")) {
                            return URLDecoder.decode(p.substring(2), "UTF-8");
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return extracted;
    }

    private static String extractYouTubeId(String rawUrl) {
        try {
            URL u = new URL(rawUrl);
            String host = u.getHost().toLowerCase(Locale.US).replaceFirst("^www\\.", "");
            if ("youtu.be".equals(host)) {
                String p = u.getPath().replaceAll("^/+", "");
                int slash = p.indexOf('/');
                String id = slash >= 0 ? p.substring(0, slash) : p;
                return id.length() >= 6 ? id : null;
            }
            if (host.endsWith("youtube.com") || "youtube-nocookie.com".equals(host)) {
                String q = u.getQuery();
                if (q != null) {
                    for (String param : q.split("&")) {
                        if (param.startsWith("v=")) {
                            String v = param.substring(2);
                            if (!v.isEmpty()) return v;
                        }
                    }
                }
                String[] parts = u.getPath().replaceAll("^/+", "").split("/");
                if (parts.length >= 2 && ("shorts".equals(parts[0]) || "embed".equals(parts[0]) || "live".equals(parts[0]) || "v".equals(parts[0]))) {
                    return parts[1];
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String firstMatch(String input, String... patterns) {
        for (String pat : patterns) {
            Matcher m = Pattern.compile(pat, Pattern.CASE_INSENSITIVE).matcher(input);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static String unescapeHtmlAndJson(String s) {
        if (s == null) return "";
        Matcher um = Pattern.compile("\\\\u([0-9a-fA-F]{4})").matcher(s);
        StringBuffer sb = new StringBuffer();
        while (um.find()) {
            int code = Integer.parseInt(um.group(1), 16);
            um.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf((char) code)));
        }
        um.appendTail(sb);
        return sb.toString()
                .replace("\\/", "/")
                .replace("\\\"", "\"")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#039;", "'")
                .replace("&#x3A;", ":")
                .replace("&#x2F;", "/")
                .trim();
    }

    private static boolean isAudioUrl(String lower) {
        return lower.matches(".*\\.(mp3|m4a|aac|wav|ogg|opus)(\\?.*|$)");
    }

    private static String sanitizeFilename(String name) {
        String cleaned = name.replaceAll("[<>:\"/\\\\|?*\\x00-\\x1f]", " ")
                             .replaceAll("\\s+", " ")
                             .trim();
        if (cleaned.length() > 80) cleaned = cleaned.substring(0, 80).trim();
        return cleaned.isEmpty() ? "tanzeelati-media.mp4" : cleaned;
    }

    private static long parseLongSafe(String s) {
        try { return Long.parseLong(s); } catch (Exception e) { return 0L; }
    }

    private static String formatDuration(int sec) {
        if (sec <= 0) return "0:00";
        int h = sec / 3600;
        int m = (sec % 3600) / 60;
        int s = sec % 60;
        if (h > 0) return String.format(Locale.US, "%d:%02d:%02d", h, m, s);
        return String.format(Locale.US, "%02d:%02d", m, s);
    }

    private long probeContentLength(String urlStr, String ua) {
        if (urlStr == null || urlStr.trim().isEmpty()) return 0L;
        HttpURLConnection conn = null;
        try {
            conn = openConnectionFollowingRedirects(urlStr, ua != null && !ua.isEmpty() ? ua : MOBILE_CHROME_UA, 3200, "HEAD");
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                long len = conn.getContentLengthLong();
                if (len > 0) return len;
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }

        HttpURLConnection rng = null;
        try {
            String current = urlStr;
            for (int i = 0; i < 4; i++) {
                URL u = new URL(current);
                rng = (HttpURLConnection) u.openConnection();
                rng.setInstanceFollowRedirects(false);
                rng.setRequestMethod("GET");
                rng.setConnectTimeout(3200);
                rng.setReadTimeout(3200);
                rng.setRequestProperty("User-Agent", ua != null && !ua.isEmpty() ? ua : MOBILE_CHROME_UA);
                rng.setRequestProperty("Range", "bytes=0-0");
                String cdnRef = inferCdnReferer(current);
                if (cdnRef != null) {
                    rng.setRequestProperty("Referer", cdnRef);
                }
                int code = rng.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String loc = rng.getHeaderField("Location");
                    rng.disconnect();
                    rng = null;
                    if (loc == null || loc.isEmpty()) break;
                    current = new URL(u, loc).toString();
                    continue;
                }
                if (code == 206 || (code >= 200 && code < 300)) {
                    String cr = rng.getHeaderField("Content-Range");
                    if (cr != null) {
                        Matcher m = Pattern.compile("/(\\d+)$").matcher(cr.trim());
                        if (m.find()) {
                            long total = parseLongSafe(m.group(1));
                            if (total > 0) return total;
                        }
                    }
                    long cl = rng.getContentLengthLong();
                    if (cl > 1) return cl;
                }
                break;
            }
        } catch (Exception ignored) {
        } finally {
            if (rng != null) rng.disconnect();
        }
        return 0L;
    }

    private static String formatBytes(long bytes) {
        return formatBytes(bytes, false);
    }

    private static String formatBytes(long bytes, boolean exact) {
        if (bytes <= 0) return "—";
        String prefix = exact ? "" : "~";
        double mb = bytes / (1024.0 * 1024.0);
        if (mb >= 1.0) {
            return String.format(Locale.US, mb >= 100.0 ? "%s%.0f MB" : "%s%.1f MB", prefix, mb);
        }
        return String.format(Locale.US, "%s%d KB", prefix, Math.max(1, Math.round(bytes / 1024.0)));
    }

    // ==================== WhatsApp Statuses Reader & Saver (SAF + Legacy) ====================

    private static final String[] LEGACY_WA_PATHS = new String[] {
        "Android/media/com.whatsapp/WhatsApp/Media/.Statuses",
        "WhatsApp/Media/.Statuses",
        "Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses",
        "WhatsApp Business/Media/.Statuses"
    };

    private List<String> getSavedWaTreeUris() {
        List<String> out = new ArrayList<>();
        try {
            SharedPreferences sp = getContext().getSharedPreferences(WA_PREFS_NAME, Context.MODE_PRIVATE);
            String raw = sp.getString(WA_TREE_URIS_KEY, "[]");
            JSONArray arr = new JSONArray(raw);
            List<UriPermission> persisted = getContext().getContentResolver().getPersistedUriPermissions();
            Set<String> validPerms = new HashSet<>();
            for (UriPermission p : persisted) {
                if (p.isReadPermission()) validPerms.add(p.getUri().toString());
            }
            for (int i = 0; i < arr.length(); i++) {
                String u = arr.optString(i, "");
                if (!u.isEmpty() && validPerms.contains(u) && !out.contains(u)) {
                    out.add(u);
                }
            }
        } catch (Exception ignored) {}
        return out;
    }

    private void addSavedWaTreeUri(Uri treeUri) {
        try {
            List<String> existing = getSavedWaTreeUris();
            String s = treeUri.toString();
            if (!existing.contains(s)) existing.add(0, s);
            JSONArray arr = new JSONArray();
            for (String u : existing) arr.put(u);
            getContext().getSharedPreferences(WA_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(WA_TREE_URIS_KEY, arr.toString())
                .apply();
        } catch (Exception ignored) {}
    }

    private List<File> getReadableLegacyStatusDirs() {
        List<File> dirs = new ArrayList<>();
        File extRoot = Environment.getExternalStorageDirectory();
        if (extRoot == null) return dirs;
        for (String rel : LEGACY_WA_PATHS) {
            File f = new File(extRoot, rel);
            if (f.exists() && f.isDirectory() && f.canRead()) {
                File[] test = f.listFiles();
                if (test != null) {
                    dirs.add(f);
                }
            }
        }
        return dirs;
    }

    @PluginMethod
    public void checkWhatsAppAccess(PluginCall call) {
        List<String> trees = getSavedWaTreeUris();
        if (!trees.isEmpty()) {
            JSObject res = new JSObject();
            res.put("hasAccess", true);
            res.put("mode", "saf");
            call.resolve(res);
            return;
        }
        List<File> legacyDirs = getReadableLegacyStatusDirs();
        if (!legacyDirs.isEmpty()) {
            JSObject res = new JSObject();
            res.put("hasAccess", true);
            res.put("mode", "legacy");
            call.resolve(res);
            return;
        }
        JSObject res = new JSObject();
        res.put("hasAccess", false);
        res.put("mode", "none");
        call.resolve(res);
    }

    @PluginMethod
    public void clearWhatsAppAccess(PluginCall call) {
        try {
            getContext().getSharedPreferences(WA_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(WA_TREE_URIS_KEY)
                .apply();
        } catch (Exception ignored) {}
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    @PluginMethod
    public void requestWhatsAppFolderAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            if (getPermissionState("storage") == PermissionState.GRANTED || !getReadableLegacyStatusDirs().isEmpty()) {
                executor.execute(() -> resolveWhatsAppListInternal(call, true));
                return;
            }
            requestPermissionForAlias("storage", call, "handleStoragePermission");
            return;
        }
        launchSafPicker(call);
    }

    @PermissionCallback
    private void handleStoragePermission(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED || !getReadableLegacyStatusDirs().isEmpty()) {
            executor.execute(() -> resolveWhatsAppListInternal(call, true));
        } else {
            launchSafPicker(call);
        }
    }

    private void launchSafPicker(PluginCall call) {
        String appType = call.getString("appType", "whatsapp");
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String docPath = "business".equals(appType)
                ? "primary:Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses"
                : "primary:Android/media/com.whatsapp/WhatsApp/Media/.Statuses";
            try {
                File ext = Environment.getExternalStorageDirectory();
                if (!"business".equals(appType) && ext != null) {
                    File androidMedia = new File(ext, "Android/media/com.whatsapp/WhatsApp/Media/.Statuses");
                    File oldWa = new File(ext, "WhatsApp/Media/.Statuses");
                    if (!androidMedia.exists() && oldWa.exists()) {
                        docPath = "primary:WhatsApp/Media/.Statuses";
                    }
                }
            } catch (Exception ignored) {}
            Uri initialUri = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", docPath);
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, initialUri);
        }
        startActivityForResult(call, intent, "handleWhatsAppTreeResult");
    }

    @ActivityCallback
    private void handleWhatsAppTreeResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject out = new JSObject();
            out.put("granted", false);
            out.put("hasAccess", !getSavedWaTreeUris().isEmpty() || !getReadableLegacyStatusDirs().isEmpty());
            out.put("items", new JSArray());
            call.resolve(out);
            return;
        }
        Uri treeUri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
            addSavedWaTreeUri(treeUri);
        } catch (Exception e) {
            call.reject("PERSIST_URI_FAILED");
            return;
        }
        executor.execute(() -> resolveWhatsAppListInternal(call, true));
    }

    @PluginMethod
    public void listWhatsAppStatuses(PluginCall call) {
        executor.execute(() -> resolveWhatsAppListInternal(call, false));
    }

    private static class WaStatusItem {
        String id;
        String name;
        String uri;
        boolean isVideo;
        String mimeType;
        long sizeBytes;
        long modifiedMs;
        String thumbPath;
        String sourceApp;
    }

    private void resolveWhatsAppListInternal(PluginCall call, boolean fromGrant) {
        try {
            List<String> treeUris = getSavedWaTreeUris();
            List<File> legacyDirs = getReadableLegacyStatusDirs();
            boolean hasAccess = !treeUris.isEmpty() || !legacyDirs.isEmpty();

            if (!hasAccess) {
                JSObject out = new JSObject();
                if (fromGrant) out.put("granted", false);
                out.put("hasAccess", false);
                out.put("items", new JSArray());
                call.resolve(out);
                return;
            }

            Map<String, WaStatusItem> byId = new LinkedHashMap<>();
            File thumbDir = new File(getContext().getCacheDir(), "wa_thumbs");
            if (!thumbDir.exists()) thumbDir.mkdirs();

            for (String treeStr : treeUris) {
                Uri treeUri = Uri.parse(treeStr);
                String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
                String sourceApp = treeStr.toLowerCase(Locale.US).contains("w4b") || treeStr.toLowerCase(Locale.US).contains("business")
                    ? "WhatsApp Business" : "WhatsApp";
                scanSafFolder(treeUri, rootDocId, 0, sourceApp, thumbDir, byId);
            }

            for (File dir : legacyDirs) {
                String sourceApp = dir.getAbsolutePath().toLowerCase(Locale.US).contains("business")
                    ? "WhatsApp Business" : "WhatsApp";
                File[] files = dir.listFiles();
                if (files == null) continue;
                for (File f : files) {
                    if (!f.isFile() || f.length() <= 0) continue;
                    String fname = f.getName();
                    if (!isSupportedStatusName(fname)) continue;
                    boolean isVid = isVideoFileName(fname);
                    String id = sha1Short(f.getAbsolutePath() + "_" + f.length());
                    WaStatusItem item = new WaStatusItem();
                    item.id = id;
                    item.name = fname;
                    item.uri = Uri.fromFile(f).toString();
                    item.isVideo = isVid;
                    item.mimeType = inferStatusMime(fname, isVid);
                    item.sizeBytes = f.length();
                    item.modifiedMs = f.lastModified();
                    item.sourceApp = sourceApp;
                    item.thumbPath = ensureThumbnailFile(item.uri, id, isVid, thumbDir);
                    byId.putIfAbsent(fname + "_" + item.sizeBytes, item);
                }
            }

            List<WaStatusItem> sorted = new ArrayList<>(byId.values());
            Collections.sort(sorted, (a, b) -> Long.compare(b.modifiedMs, a.modifiedMs));

            JSArray arr = new JSArray();
            for (WaStatusItem it : sorted) {
                JSObject obj = new JSObject();
                obj.put("id", it.id);
                obj.put("name", it.name);
                obj.put("uri", it.uri);
                obj.put("isVideo", it.isVideo);
                obj.put("mimeType", it.mimeType);
                obj.put("sizeBytes", it.sizeBytes);
                obj.put("sizeText", formatBytes(it.sizeBytes, true));
                obj.put("modifiedMs", it.modifiedMs);
                obj.put("thumbPath", it.thumbPath != null ? it.thumbPath : "");
                obj.put("sourceApp", it.sourceApp);
                arr.put(obj);
            }

            JSObject res = new JSObject();
            if (fromGrant) res.put("granted", true);
            res.put("hasAccess", true);
            res.put("items", arr);
            call.resolve(res);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "WA_SCAN_FAILED");
        }
    }

    private void scanSafFolder(
        Uri treeUri,
        String parentDocId,
        int depth,
        String sourceApp,
        File thumbDir,
        Map<String, WaStatusItem> byId
    ) {
        if (depth > 2) return;
        ContentResolver resolver = getContext().getContentResolver();
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId);
        String[] projection = new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            DocumentsContract.Document.COLUMN_SIZE
        };
        try (Cursor c = resolver.query(childrenUri, projection, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String docId = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long mod = c.isNull(3) ? System.currentTimeMillis() : c.getLong(3);
                long size = c.isNull(4) ? 0L : c.getLong(4);
                if (name == null) continue;

                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    String lowDir = name.toLowerCase(Locale.US);
                    if (lowDir.contains("status") || lowDir.equals("media") || lowDir.contains("whatsapp")) {
                        scanSafFolder(treeUri, docId, depth + 1, sourceApp, thumbDir, byId);
                    }
                    continue;
                }

                if (size <= 0 || !isSupportedStatusName(name)) continue;
                boolean isVid = isVideoFileName(name) || (mime != null && mime.startsWith("video/"));
                Uri fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
                String id = sha1Short(docId + "_" + size);
                WaStatusItem item = new WaStatusItem();
                item.id = id;
                item.name = name;
                item.uri = fileUri.toString();
                item.isVideo = isVid;
                item.mimeType = (mime != null && !mime.isEmpty()) ? mime : inferStatusMime(name, isVid);
                item.sizeBytes = size;
                item.modifiedMs = mod;
                item.sourceApp = sourceApp;
                item.thumbPath = ensureThumbnailFile(item.uri, id, isVid, thumbDir);
                byId.putIfAbsent(name + "_" + size, item);
            }
        } catch (Exception ignored) {}
    }

    private String ensureThumbnailFile(String uriStr, String id, boolean isVideo, File thumbDir) {
        File outFile = new File(thumbDir, id + ".jpg");
        if (outFile.exists() && outFile.length() > 0) {
            return Uri.fromFile(outFile).toString();
        }
        Uri uri = Uri.parse(uriStr);
        Bitmap bmp = null;
        try {
            if (isVideo) {
                MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                try {
                    mmr.setDataSource(getContext(), uri);
                    bmp = mmr.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                    if (bmp == null) bmp = mmr.getFrameAtTime();
                } finally {
                    try { mmr.release(); } catch (Exception ignored) {}
                }
            } else {
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                    if (in != null) BitmapFactory.decodeStream(in, null, bounds);
                }
                int sample = 1;
                int maxDim = Math.max(bounds.outWidth, bounds.outHeight);
                while (maxDim / sample > 420) sample *= 2;
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inSampleSize = sample;
                try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                    if (in != null) bmp = BitmapFactory.decodeStream(in, null, opts);
                }
            }
            if (bmp != null) {
                int w = bmp.getWidth();
                int h = bmp.getHeight();
                if (Math.max(w, h) > 400) {
                    float scale = 400f / Math.max(w, h);
                    Bitmap scaled = Bitmap.createScaledBitmap(bmp, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), true);
                    if (scaled != bmp) bmp.recycle();
                    bmp = scaled;
                }
                try (OutputStream out = new FileOutputStream(outFile)) {
                    bmp.compress(Bitmap.CompressFormat.JPEG, 78, out);
                    out.flush();
                }
                bmp.recycle();
                return Uri.fromFile(outFile).toString();
            }
        } catch (Exception ignored) {
            if (bmp != null && !bmp.isRecycled()) bmp.recycle();
        }
        return null;
    }

    @PluginMethod
    public void prepareWhatsAppPreview(PluginCall call) {
        String uriStr = call.getString("uri", "");
        String name = sanitizeFilename(call.getString("name", "status.mp4"));
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("EMPTY_URI");
            return;
        }
        executor.execute(() -> {
            try {
                if (uriStr.startsWith("file://")) {
                    JSObject res = new JSObject();
                    res.put("previewPath", uriStr);
                    call.resolve(res);
                    return;
                }
                File pvDir = new File(getContext().getCacheDir(), "wa_preview");
                if (!pvDir.exists()) pvDir.mkdirs();
                File dest = new File(pvDir, sha1Short(uriStr) + "_" + name);
                if (!dest.exists() || dest.length() == 0) {
                    try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uriStr));
                         OutputStream out = new FileOutputStream(dest)) {
                        if (in == null) throw new Exception("OPEN_STREAM_FAILED");
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        out.flush();
                    }
                }
                JSObject res = new JSObject();
                res.put("previewPath", Uri.fromFile(dest).toString());
                call.resolve(res);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "PREVIEW_FAILED");
            }
        });
    }

    @PluginMethod
    public void saveWhatsAppStatus(PluginCall call) {
        String uriStr = call.getString("uri", "");
        String rawName = call.getString("filename", "status_media.jpg");
        String mimeType = call.getString("mimeType", "image/jpeg");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("EMPTY_URI");
            return;
        }
        String safeName = sanitizeFilename(rawName);
        executor.execute(() -> {
            File tmp = new File(getContext().getCacheDir(), "wa_save_" + System.currentTimeMillis() + "_" + safeName);
            try {
                try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uriStr));
                     OutputStream out = new FileOutputStream(tmp)) {
                    if (in == null) throw new Exception("OPEN_STREAM_FAILED");
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    out.flush();
                }
                String savedPath = saveToDownloads(tmp, safeName, mimeType);
                long size = tmp.length();
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("filename", safeName);
                res.put("savedPath", savedPath);
                res.put("fileSize", size);
                call.resolve(res);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "SAVE_STATUS_FAILED");
            } finally {
                if (tmp.exists()) tmp.delete();
            }
        });
    }

    private static boolean isSupportedStatusName(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase(Locale.US);
        if (lower.equals(".nomedia") || lower.startsWith(".")) return false;
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")
            || lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".3gp") || lower.endsWith(".webm");
    }

    private static boolean isVideoFileName(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase(Locale.US);
        return lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".3gp") || lower.endsWith(".webm");
    }

    private static String inferStatusMime(String name, boolean isVid) {
        String lower = name.toLowerCase(Locale.US);
        if (isVid) {
            if (lower.endsWith(".webm")) return "video/webm";
            if (lower.endsWith(".3gp")) return "video/3gpp";
            if (lower.endsWith(".mkv")) return "video/x-matroska";
            return "video/mp4";
        }
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    private static String sha1Short(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] dig = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8 && i < dig.length; i++) {
                sb.append(String.format(Locale.US, "%02x", dig[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
