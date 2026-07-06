/*
  হার্টবিট — অফলাইন সাপোর্ট (Service Worker)
  ------------------------------------------------
  প্রথমবার ইন্টারনেট সংযোগে পাতাটি খোলা হলে এই ফাইলটি পাতাটি নিজে এবং
  Tailwind / Chart.js / html2pdf.js লাইব্রেরিগুলো ব্রাউজারের ক্যাশে জমা রাখে।
  এরপর ইন্টারনেট না থাকলেও অ্যাপটি খোলে, রিডিং সেভ হয়, চার্ট আঁকে এবং
  PDF তৈরি হয় — কারণ সবকিছু ক্যাশ থেকে লোড হয়।

  ব্যবহার: এই ফাইলটি আপনার HTML ফাইলের ঠিক পাশে (একই ফোল্ডারে)
  "heartbeat-service-worker.js" নামে আপলোড করুন। এটি শুধুমাত্র
  https:// বা localhost-এ কাজ করে — সরাসরি ফাইল ডাবল-ক্লিক করে
  (file://) খুললে ব্রাউজার Service Worker চালাতে দেয় না।
*/

const CACHE_NAME = 'heartbeat-bp-cache-v1';

const APP_SHELL = [
  self.registration ? self.registration.scope : './',
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // পৃথকভাবে ক্যাশ করি যাতে একটি ফেইল করলেও বাকিগুলো ক্যাশ হয়
      return Promise.allSettled(
        CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // পাতা নিজে (HTML নেভিগেশন): নেটওয়ার্ক আগে চেষ্টা করি, ব্যর্থ হলে ক্যাশ থেকে দেই
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./')))
    );
    return;
  }

  // CDN লাইব্রেরি ও ফন্ট: ক্যাশ আগে, না থাকলে নেটওয়ার্ক থেকে এনে ক্যাশ করি
  const isTracked = CDN_ASSETS.some((u) => req.url.startsWith(u.split('?')[0]));
  if (isTracked || req.url.includes('fonts.g') ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
