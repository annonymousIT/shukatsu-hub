// 就活Hub Service Worker
// 役割: (1) Web Push の受信/クリック処理 (2) アプリシェルのキャッシュ(オフライン起動・低速回線の体感改善)
/* eslint-disable no-undef */

// 選考フロー(段階＞タスク)大改修にあわせて版を更新。activate で旧キャッシュを破棄し、
// 復帰ユーザーに確実に新バージョンを配る。
const CACHE = "shukatsu-cache-v2";
// 最低限プリキャッシュ(残りの静的アセットは実行時にキャッシュへ育てる)
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      // 一部が 404 等でも install を止めない
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u)))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|ico)$/.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 保存系(POST 等)は素通し
  const url = new URL(req.url);
  // Supabase などの外部ドメインはキャッシュしない(常に最新・認証を壊さない)
  if (url.origin !== self.location.origin) return;

  // ページ遷移: ネット優先 → 失敗時はキャッシュ(オフラインでも起動できる)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match("/")) || Response.error();
        }),
    );
    return;
  }

  // 静的アセット(ハッシュ付きで不変): キャッシュ優先 → 低速でも即時・オフライン可
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});

// ---- Web Push(従来どおり) ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "就活Hub";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "shukatsu-notify",
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // 通知に件数(badge)が乗っていればアプリアイコンの赤バッジへ反映(アプリ未起動でも更新)
      if (typeof data.badge === "number" && self.navigator.setAppBadge) {
        try {
          await self.navigator.setAppBadge(data.badge);
        } catch (e) {
          /* 非対応端末は無視 */
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
