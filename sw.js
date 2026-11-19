/* Rend l'application disponible sans réseau. Tes œuvres et photos ne passent jamais par ici. */
const VERSION = "cimaise-3";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..700&family=Libre+Franklin:wght@400;500;600;700&display=swap";

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })));
    try {
      const r = await fetch(FONT_CSS);
      const css = await r.clone().text();
      await c.put(FONT_CSS, r);
      const latin = [...css.matchAll(/\/\* latin(?:-ext)? \*\/[^}]*?url\((https:[^)]+)\)/g)].map(m => m[1]);
      await Promise.all([...new Set(latin)].map(u => fetch(u, { mode: "cors" }).then(x => c.put(u, x))));
    } catch {}
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(async r => { (await caches.open(VERSION)).put(e.request, r.clone()); return r; })));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const key = e.request.mode === "navigate" ? "index.html" : e.request;
    const fresh = fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => undefined);
    if (e.request.mode === "navigate") {
      /* Page de l'appli : la version en ligne d'abord (3 s max), sinon celle enregistrée pour le hors-ligne */
      const quick = await Promise.race([fresh, new Promise(ok => setTimeout(ok, 3000))]);
      if (quick) return quick;
      return (await c.match("index.html")) || (await fresh) || new Response("Hors ligne", { status: 503 });
    }
    return (await c.match(e.request, { ignoreSearch: true })) || (await fresh) || new Response("Hors ligne", { status: 503 });
  })());
});
