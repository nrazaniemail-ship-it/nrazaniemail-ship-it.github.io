// v3: مشکل نسخه‌ی قبل این بود که index.html (که تمام کد برنامه توش inline هست) با استراتژی
// "اول کش" سرو می‌شد — یعنی بعد از اولین بار، حتی وقتی اینترنت وصل بود و نسخه‌ی جدیدی روی
// هاست آپلود شده بود، سرویس‌ورکر همچنان همون نسخه‌ی قدیمیِ کش‌شده رو نشون می‌داد و کاربر آخرین
// تغییرات رو نمی‌دید.
// این نسخه، استراتژی رو برای خودِ index.html به "اول شبکه" (network-first) تغییر داده: هر بار
// که اینترنت وصله، همیشه نسخه‌ی تازه از سرور گرفته و نشون داده می‌شه (و همون نسخه هم برای
// دفعات آفلاینِ بعدی کش می‌شه). فقط وقتی واقعاً آفلاینیم، از کش قدیمی استفاده می‌شه.
// برای فایل‌های CDN (React, XLSX, Plotly, Tailwind, فونت‌ها) که نسخه‌شون پین‌شده و عوض نمی‌شه،
// همچنان استراتژی "اول کش" (سریع‌تر و برای آفلاین قابل‌اعتمادتر) باقی مونده.
const CACHE_NAME = "namello-v3";

const HTML_URLS = ["./", "./index.html"];
const APP_SHELL = ["./manifest.json", "./icon-192.png", "./icon-512.png"];

const RUNTIME_DEPS = [
  "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.32.0/plotly.min.js",
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=Estedad:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Cairo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // پوسته‌ی برنامه: اگه هرکدوم شکست بخوره، نصب باید شکست بخوره (این‌ها حیاتی و محلی‌ان)
      await cache.addAll([...HTML_URLS, ...APP_SHELL]);
      // وابستگی‌های CDN: هرکدوم جدا کش می‌شن تا اگه یکی‌شون (مثلاً به‌خاطر فیلترینگ یه دامنه)
      // شکست خورد، بقیه همچنان کش بشن و برنامه تا حد امکان آفلاین کار کنه.
      await Promise.allSettled(
        RUNTIME_DEPS.map((url) =>
          fetch(url, { mode: "cors" })
            .then((res) => { if (res && (res.ok || res.type === "opaque")) return cache.put(url, res); })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAppShellHtml(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (isAppShellHtml(req)) {
    // network-first: همیشه اول نسخه‌ی تازه رو از سرور بگیر (اگه اینترنت هست)، کش رو هم به‌روز کن.
    // فقط وقتی شبکه واقعاً در دسترس نیست، از آخرین نسخه‌ی کش‌شده استفاده کن.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // بقیه (کتابخانه‌های CDN پین‌شده، آیکون‌ها، مانیفست): اول کش، سریع‌تر و برای آفلاین مطمئن‌تر.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch((err) => { throw err; });
    })
  );
});
