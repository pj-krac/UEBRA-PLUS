const CACHE_PREFIX='uebra-plus-';
const CACHE=CACHE_PREFIX+'v19-automatico-offline';
const LOCAL=['./','./index.html','./config.js','./manifest.webmanifest','./logo-uebra.png','./icon-192.png','./icon-512.png'];
const LIBRARIES=[
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(LOCAL);await Promise.allSettled(LIBRARIES.map(url=>cache.add(url)));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const local=LOCAL.map(p=>new URL(p,self.location.href).href).find(href=>new URL(href).origin===url.origin&&new URL(href).pathname===url.pathname);
 const asset=local||LIBRARIES.find(href=>href===url.href);if(!asset)return;
 // Solo recursos públicos enumerados; no cachear API, usuarios, notas ni respuestas de autenticación.
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok){await cache.put(asset,response.clone());return response}const old=await cache.match(asset);return old||response}catch(e){return await cache.match(asset)||Response.error()}})());
});
