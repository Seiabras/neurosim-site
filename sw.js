// Service worker do NeuroClin Games: deixa o jogo abrir sem internet depois da primeira visita.
// Estratégia: rede primeiro para a página e os scripts (sempre a versão mais nova quando há internet), cache como reserva offline.
// Nunca guarda a API (/api/): contas e sincronização precisam de rede. Para forçar atualização, mude VERSAO.
const VERSAO = "neuroclin-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(e.request).then((r) => { if (r && r.ok) { const c = r.clone(); caches.open(VERSAO).then((ch) => ch.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html"))));
});
