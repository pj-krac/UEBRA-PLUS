const CACHE_PREFIX='uebra-plus-';
const CACHE=CACHE_PREFIX+'v25-sumativa-sin-descripcion';
const LOCAL=['./','./index.html','./config.js','./manifest.webmanifest','./logo-uebra.png','./icon-192.png','./icon-512.png'];
const LIBRARIES=[
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
];
async function boundedFetch(request){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{return await fetch(request,{signal:controller.signal})}finally{clearTimeout(timer)}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled([...LOCAL,...LIBRARIES].map(async asset=>{const response=await boundedFetch(asset);if(!response.ok)throw Error('Recurso no disponible');await cache.put(asset,response)}));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)(await (async()=>{const previous=await caches.open(key),current=await caches.open(CACHE);for(const request of await previous.keys()){if(!(await current.match(request))){const response=await previous.match(request);if(response)await current.put(request,response)}}await caches.delete(key)})());await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const local=LOCAL.map(p=>new URL(p,self.location.href).href).find(href=>new URL(href).origin===url.origin&&new URL(href).pathname===url.pathname);
 const asset=local||LIBRARIES.find(href=>href===url.href);if(!asset)return;
 // Solo recursos públicos enumerados; no cachear API, usuarios, notas ni respuestas de autenticación.
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const old=await cache.match(asset);if(old&&!event.request.mode.includes('navigate'))return old;try{const response=await boundedFetch(event.request);if(response.ok){await cache.put(asset,response.clone());return response}const old=await cache.match(asset);return old||response}catch(e){return await cache.match(asset)||Response.error()}})());
});
