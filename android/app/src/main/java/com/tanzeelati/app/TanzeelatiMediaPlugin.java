package com.tanzeelati.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "TanzeelatiMedia")
public class TanzeelatiMediaPlugin extends Plugin {

    private static final String ANDROID_VR_UA =
        "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip";
    private static final String ANDROID_YT_UA =
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip";
    private static final String MOBILE_CHROME_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, AtomicBoolean> cancelFlags = new ConcurrentHashMap<>();

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
                    downloadFile(stream, resolvedUA, finalTempFile, jobId, "extracting", 5, 96, cancelled);
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

        // 3. YouTube
        String ytId = extractYouTubeId(targetUrl);
        if (ytId != null) {
            JSObject yt = resolveYouTubeInnerTube(ytId, targetUrl);
            if (yt != null) return yt;
            JSObject piped = resolveYouTubePiped(ytId, targetUrl);
            if (piped != null) return piped;
        }

        // 4. Direct media links (.mp4, .mp3, .m4a, .webm, etc.)
        if (lower.matches(".*\\.(mp4|m4v|mov|webm|mp3|m4a|aac|wav|ogg)(\\?.*|$)")) {
            return buildDirectResult(targetUrl, "رابط مباشر", "Direct Media", isAudioUrl(lower));
        }

        // 5. Instagram / Facebook / generic HTML extraction natively without CORS
        JSObject htmlRes = resolveSocialPageHtml(targetUrl);
        if (htmlRes != null) return htmlRes;

        // 6. Content-Type probe fallback
        HttpURLConnection headConn = null;
        try {
            headConn = openConnectionFollowingRedirects(targetUrl, MOBILE_CHROME_UA, 6000, "HEAD");
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
                    for (JSONObject f : h264Adaptive) {
                        int h = f.optInt("height", 0);
                        if (h < 240 || seenH.contains(h)) continue;
                        if (h != 1080 && h != 720 && h != 480 && h != 360) continue;
                        seenH.add(h);
                        long totalBytes = parseLongSafe(f.optString("contentLength", "0")) + bestAudioSize;
                        JSObject opt = new JSObject();
                        opt.put("key", String.valueOf(h));
                        opt.put("labelAr", h >= 1080 ? h + "p (Full HD)" : h == 720 ? "720p (HD)" : h + "p");
                        opt.put("labelEn", h >= 1080 ? h + "p (Full HD)" : h == 720 ? "720p (HD)" : h + "p");
                        opt.put("descAr", h >= 720 ? "MP4 · عالي الوضوح" : "MP4 · موفر للبيانات");
                        opt.put("descEn", h >= 720 ? "MP4 · High Definition" : "MP4 · Data Saver");
                        opt.put("sizeText", totalBytes > 0 ? formatBytes(totalBytes) : h + "p");
                        opt.put("height", h);
                        opt.put("directUrl", f.optString("url"));
                        opt.put("audioUrl", bestAudioUrl);
                        opt.put("userAgent", usedUA);
                        videoOptions.put(opt);
                    }
                }

                if (!progUrl.isEmpty() && !seenH.contains(progHeight)) {
                    JSObject opt = new JSObject();
                    opt.put("key", String.valueOf(progHeight));
                    opt.put("labelAr", progHeight + "p (MP4 مباشر)");
                    opt.put("labelEn", progHeight + "p (Direct MP4)");
                    opt.put("descAr", "MP4 · صوت وصورة مدمجين");
                    opt.put("descEn", "MP4 · Video + Audio");
                    opt.put("sizeText", progSize > 0 ? formatBytes(progSize) : progHeight + "p");
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
                bestOpt.put("sizeText", top.optString("sizeText", "MP4"));
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
                JSArray audioOpts = buildAudioOptions(durSec, effectiveAudio, usedUA);

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
                int dur = data.optInt("duration", 120);
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

                JSObject opt = new JSObject();
                opt.put("key", "best");
                opt.put("labelAr", "أفضل جودة متاحة (MP4)");
                opt.put("labelEn", "Best Available (MP4)");
                opt.put("descAr", "MP4 · مباشر");
                opt.put("descEn", "MP4 · Direct");
                opt.put("sizeText", "MP4");
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
                out.put("audioOptions", buildAudioOptions(dur, !bestAudio.isEmpty() ? bestAudio : progUrl, MOBILE_CHROME_UA));
                out.put("fallbackStreamUrl", progUrl);
                out.put("fallbackAudioUrl", !bestAudio.isEmpty() ? bestAudio : progUrl);
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

            int dur = d.optInt("duration", 30);
            String title = d.optString("title", "TikTok Video");
            if (title.trim().isEmpty()) title = "TikTok Video";
            JSONObject authorObj = d.optJSONObject("author");
            String author = authorObj != null ? authorObj.optString("nickname", authorObj.optString("unique_id", "TikTok")) : "TikTok";
            String cover = d.optString("cover", d.optString("origin_cover", ""));
            String musicUrl = d.optString("music", hdUrl);

            JSArray vOpts = new JSArray();
            JSObject bestOpt = new JSObject();
            bestOpt.put("key", "best");
            bestOpt.put("labelAr", "أفضل جودة بدون علامة مائية");
            bestOpt.put("labelEn", "Best Quality (No Watermark)");
            bestOpt.put("descAr", "MP4 · HD أصلي");
            bestOpt.put("descEn", "MP4 · Original HD");
            bestOpt.put("sizeText", formatBytes(d.optLong("hd_size", d.optLong("size", 0))));
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
                sdOpt.put("sizeText", formatBytes(d.optLong("size", 0)));
                sdOpt.put("directUrl", sdUrl);
                sdOpt.put("userAgent", MOBILE_CHROME_UA);
                vOpts.put(sdOpt);
            }

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
            out.put("audioOptions", buildAudioOptions(dur, !musicUrl.isEmpty() ? musicUrl : hdUrl, MOBILE_CHROME_UA));
            out.put("fallbackStreamUrl", hdUrl);
            out.put("fallbackAudioUrl", !musicUrl.isEmpty() ? musicUrl : hdUrl);
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
                            int dur = v.optInt("duration", 30);
                            JSArray vOpts = new JSArray();
                            JSObject best = new JSObject();
                            best.put("key", "best");
                            best.put("labelAr", "أفضل جودة متاحة (MP4)");
                            best.put("labelEn", "Best Available Quality (MP4)");
                            best.put("descAr", "MP4 · أعلى دقة");
                            best.put("descEn", "MP4 · Highest Resolution");
                            best.put("sizeText", "MP4");
                            best.put("directUrl", bestUrl);
                            best.put("userAgent", MOBILE_CHROME_UA);
                            vOpts.put(best);

                            String[] keys = { "720", "480", "360" };
                            for (int i = 0; i < Math.min(3, mp4s.size()); i++) {
                                JSONObject vr = mp4s.get(i);
                                int kbps = Math.round(vr.optInt("bitrate", 0) / 1000f);
                                JSObject o = new JSObject();
                                o.put("key", keys[i]);
                                o.put("labelAr", i == 0 ? "جودة عالية (HD)" : i == 1 ? "جودة متوسطة" : "حجم أصغر");
                                o.put("labelEn", i == 0 ? "High Quality (HD)" : i == 1 ? "Medium Quality" : "Compact Size");
                                o.put("descAr", kbps > 0 ? "MP4 · " + kbps + " kbps" : "MP4");
                                o.put("descEn", kbps > 0 ? "MP4 · " + kbps + " kbps" : "MP4");
                                o.put("sizeText", "MP4");
                                o.put("directUrl", vr.optString("url"));
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
                            out.put("audioOptions", buildAudioOptions(dur, bestUrl, MOBILE_CHROME_UA));
                            out.put("fallbackStreamUrl", bestUrl);
                            out.put("fallbackAudioUrl", bestUrl);
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

    private JSObject resolveSocialPageHtml(String targetUrl) {
        HttpURLConnection conn = null;
        try {
            conn = openConnectionFollowingRedirects(targetUrl, MOBILE_CHROME_UA, 8500, "GET");
            String ct = conn.getContentType();
            if (ct != null && (ct.startsWith("video/") || ct.startsWith("audio/"))) {
                return buildDirectResult(conn.getURL().toString(), "رابط مباشر", "Direct Media", ct.startsWith("audio/"));
            }
            String html = readStreamAsString(conn.getInputStream());
            if (html == null || html.isEmpty()) return null;

            String finalUrl = conn.getURL().toString();
            String lower = finalUrl.toLowerCase(Locale.US);
            String platAr = "فيديو";
            String platEn = "Video";
            if (lower.contains("instagram.com")) { platAr = "إنستغرام"; platEn = "Instagram"; }
            else if (lower.contains("facebook.com") || lower.contains("fb.watch")) { platAr = "فيسبوك"; platEn = "Facebook"; }
            else if (lower.contains("reddit.com")) { platAr = "ريديت"; platEn = "Reddit"; }
            else if (lower.contains("vimeo.com")) { platAr = "فيميو"; platEn = "Vimeo"; }
            else if (lower.contains("soundcloud.com")) { platAr = "ساوند كلاود"; platEn = "SoundCloud"; }

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

            // Fallback for Instagram embed endpoint if main page didn't expose video_url directly
            if ((videoUrl == null || videoUrl.isEmpty()) && lower.contains("instagram.com")) {
                Matcher igM = Pattern.compile("/(reel|reels|p|tv)/([A-Za-z0-9_-]+)").matcher(finalUrl);
                if (igM.find()) {
                    String embedUrl = "https://www.instagram.com/" + igM.group(1) + "/" + igM.group(2) + "/embed/captioned/";
                    HttpURLConnection eConn = null;
                    try {
                        eConn = openConnectionFollowingRedirects(embedUrl, MOBILE_CHROME_UA, 7500, "GET");
                        String eHtml = readStreamAsString(eConn.getInputStream());
                        videoUrl = firstMatch(eHtml,
                            "\"video_url\"\\s*:\\s*\"([^\"]+)\"",
                            "<video[^>]+src=[\"']([^\"']+)[\"']",
                            "\"playable_url\"\\s*:\\s*\"([^\"]+)\""
                        );
                    } catch (Exception ignored) {
                    } finally {
                        if (eConn != null) eConn.disconnect();
                    }
                }
            }

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

            JSArray vOpts = new JSArray();
            JSObject opt = new JSObject();
            opt.put("key", "best");
            opt.put("labelAr", "أفضل جودة متاحة (MP4)");
            opt.put("labelEn", "Best Available Quality (MP4)");
            opt.put("descAr", "MP4 · حفظ مباشر");
            opt.put("descEn", "MP4 · Direct Save");
            opt.put("sizeText", "MP4");
            opt.put("directUrl", videoUrl);
            opt.put("userAgent", MOBILE_CHROME_UA);
            vOpts.put(opt);

            JSObject out = new JSObject();
            out.put("url", targetUrl);
            out.put("title", title.length() > 85 ? title.substring(0, 85) : title);
            out.put("author", platEn);
            out.put("duration", "—");
            out.put("durationSec", 60);
            out.put("thumbnail", thumb != null ? thumb : "");
            out.put("platformAr", platAr);
            out.put("platformEn", platEn);
            out.put("engine", "direct");
            out.put("videoOptions", vOpts);
            out.put("audioOptions", buildAudioOptions(60, videoUrl, MOBILE_CHROME_UA));
            out.put("fallbackStreamUrl", videoUrl);
            out.put("fallbackAudioUrl", videoUrl);
            return out;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private JSObject buildDirectResult(String directUrl, String platAr, String platEn, boolean audioOnly) {
        JSArray vOpts = new JSArray();
        JSObject opt = new JSObject();
        opt.put("key", "best");
        opt.put("labelAr", "الجودة الأصلية (ملف مباشر)");
        opt.put("labelEn", "Original Quality (Direct File)");
        opt.put("descAr", audioOnly ? "ملف صوتي مباشر" : "ملف فيديو مباشر");
        opt.put("descEn", audioOnly ? "Direct Audio" : "Direct Video");
        opt.put("sizeText", "—");
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
        out.put("durationSec", 60);
        out.put("thumbnail", "");
        out.put("platformAr", platAr);
        out.put("platformEn", platEn);
        out.put("engine", "direct");
        out.put("videoOptions", vOpts);
        out.put("audioOptions", buildAudioOptions(60, directUrl, MOBILE_CHROME_UA));
        out.put("fallbackStreamUrl", directUrl);
        out.put("fallbackAudioUrl", directUrl);
        return out;
    }

    private JSArray buildAudioOptions(int durSec, String directAudioUrl, String ua) {
        JSArray arr = new JSArray();
        String[][] specs = {
            { "m4a", "M4A – صوت AAC عالي الكفاءة", "M4A – High Efficiency AAC", "M4A / AAC", "M4A / AAC", "160" },
            { "mp3-320", "MP3 – جودة عالية (320 kbps)", "MP3 – High Quality (320 kbps)", "صوت نقي", "Purest Audio", "320" },
            { "mp3-192", "MP3 – جودة متوسطة (192 kbps)", "MP3 – Medium Quality (192 kbps)", "جودة معيارية", "Standard Quality", "192" }
        };
        for (String[] s : specs) {
            int kbps = Integer.parseInt(s[5]);
            long estBytes = durSec > 0 ? (kbps * 1000L * durSec) / 8L : 5L * 1024 * 1024;
            JSObject o = new JSObject();
            o.put("key", s[0]);
            o.put("labelAr", s[1]);
            o.put("labelEn", s[2]);
            o.put("descAr", s[3]);
            o.put("descEn", s[4]);
            o.put("sizeText", formatBytes(estBytes));
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
            conn = openConnectionFollowingRedirects(urlStr, userAgent, 15000, "GET");
            int code = conn.getResponseCode();
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

    private HttpURLConnection openConnectionFollowingRedirects(String urlStr, String ua, int timeoutMs, String method) throws Exception {
        String current = urlStr;
        for (int i = 0; i < 6; i++) {
            URL u = new URL(current);
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod(method);
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestProperty("User-Agent", ua);
            conn.setRequestProperty("Accept", "*/*");
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
        byte[] buf = new byte[8192];
        int len;
        while ((len = in.read(buf)) != -1) {
            bos.write(buf, 0, len);
            if (bos.size() > 3 * 1024 * 1024) break;
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
        Matcher m = Pattern.compile("(https?://[^\\s<>\"'{}|\\\\^`]+)", Pattern.CASE_INSENSITIVE).matcher(t);
        if (m.find()) return m.group(1);
        if (!t.startsWith("http://") && !t.startsWith("https://") && !t.isEmpty()) {
            return "https://" + t;
        }
        return t;
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
        return s.replace("\\/", "/")
                .replace("\\u0026", "&")
                .replace("&amp;", "&")
                .replace("\\u003C", "<")
                .replace("\\u003E", ">");
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

    private static String formatBytes(long bytes) {
        if (bytes <= 0) return "—";
        double mb = bytes / (1024.0 * 1024.0);
        if (mb >= 1.0) {
            return String.format(Locale.US, mb >= 10.0 ? "~%.0f MB" : "~%.1f MB", mb);
        }
        return String.format(Locale.US, "~%d KB", Math.max(1, Math.round(bytes / 1024.0)));
    }
}
