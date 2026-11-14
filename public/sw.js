// devTools offline + compartilhar (share target).
// Arquivos com hash no nome não mudam: cache primeiro. O resto (index, manifest, ícones): rede primeiro, cache se offline.
const ESTATICOS = 'devtools-estaticos';
const PAGINAS = 'devtools-paginas';
const COMPARTILHADO = 'devtools-compartilhado';
const MAX_ESTATICOS = 200;
const COM_HASH = /-[\w-]{8}\.(js|css)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.method === 'POST' && url.pathname === '/compartilhar') return e.respondWith(receber(req));
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') return e.respondWith(redePrimeiro(req, '/index.html'));
  if (COM_HASH.test(url.pathname)) return e.respondWith(cachePrimeiro(req));
  e.respondWith(redePrimeiro(req));
});

async function cachePrimeiro(req) {
  const cache = await caches.open(ESTATICOS);
  const achado = await cache.match(req);
  if (achado) return achado;
  const r = await fetch(req);
  if (r.ok) {
    await cache.put(req, r.clone());
    const chaves = await cache.keys();
    for (const k of chaves.slice(0, Math.max(0, chaves.length - MAX_ESTATICOS))) await cache.delete(k);
  }
  return r;
}

// navegação guarda sempre como /index.html (SPA: toda rota é a mesma página)
async function redePrimeiro(req, chave) {
  const cache = await caches.open(PAGINAS);
  try {
    const r = await fetch(req);
    if (r.ok) await cache.put(chave ?? req, r.clone());
    return r;
  } catch (err) {
    const achado = await cache.match(chave ?? req);
    if (achado) return achado;
    throw err;
  }
}

async function receber(req) {
  try {
    const fd = await req.formData();
    const cache = await caches.open(COMPARTILHADO);
    const texto = ['title', 'text', 'url'].map((k) => fd.get(k)).filter((v) => typeof v === 'string' && v.trim()).join('\n');
    const arq = fd.get('arquivo');
    await cache.put('/__compartilhado/texto', new Response(texto));
    if (arq && typeof arq !== 'string' && arq.size)
      await cache.put('/__compartilhado/arquivo', new Response(arq, { headers: { 'content-type': arq.type || 'application/octet-stream', 'x-nome': encodeURIComponent(arq.name || '') } }));
    else await cache.delete('/__compartilhado/arquivo');
  } catch {}
  return Response.redirect('/ferramentas?compartilhado=1', 303);
}
