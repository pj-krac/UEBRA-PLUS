const CACHE_PREFIX = 'uebra-plus-';
const CACHE = `${CACHE_PREFIX}v15-modulos-integrados`;

const ASSETS = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './logo-uebra.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(
        ks
          .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin||url.search||!ASSETS.some(a=>new URL(a,self.location.href).pathname===url.pathname))return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(!r.ok)return r;
 const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() =>
        caches.match(e.request)
          .then(r => r || caches.match('./index.html'))
      )
  );
});
