// v2: در نسخه‌ی قبلی، سرویس‌ورکر فقط پوسته‌ی برنامه (index.html/manifest/icons) رو کش می‌کرد،
// در حالی که موتور اصلی برنامه (React, ReactDOM, XLSX, Plotly, Tailwind) و فونت‌ها هر بار از
// CDN اینترنتی لود می‌شدن. به همین دلیل، نسخه‌ی نصب‌شده بدون اینترنت اجرا نمی‌شد.
// این نسخه، هم آن فایل‌ها رو در نصب کش می‌کنه، هم هر درخواست موفق دیگه‌ای (فونت‌ها و غیره) رو
// به‌صورت خودکار برای دفعات بعد ذخیره می‌کنه. نکته‌ی مهم: برای اینکه آفلاین کار کنه، باید حداقل
// یک‌بار برنامه با اینترنت فعال باز و نصب شده باشه تا این فایل‌ها دانلود و کش بشن.
const CACHE_NAME = "namello-v2";

const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

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
      await cache.addAll(APP_SHELL);
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((res) => {
          // هر درخواست GET موفق دیگه (مثلاً فایل‌های فونت gstatic که آدرس دقیقشون از قبل
          // معلوم نیست) رو هم برای دفعات بعد که آفلاینیم کش می‌کنیم.
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch((err) => {
          throw err;
        });
    })
  );
});
