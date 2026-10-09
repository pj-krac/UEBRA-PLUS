const CACHE_PREFIX='uebra-plus-';
const CACHE=CACHE_PREFIX+'v27-inicio-ligero';
const CORE=['./','./index.html','./config.js','./manifest.webmanifest','./logo-uebra.png','./icon-192.png','./icon-512.png'];
const DOCUMENTS=['./document-assets/ministry-logo.png','./document-assets/certificate-header.png','./document-assets/certificate-watermark.jpg','./document-assets/planning-header.png'];
const LIBRARIES=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js','https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'];
async function boundedFetch(request){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{return await fetch(request,{signal:controller.signal})}finally{clearTimeout(timer)}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled([...CORE,LIBRARIES[0]].map(async asset=>{const response=await boundedFetch(asset);if(!response.ok)throw Error('Recurso no disponible');await cache.put(asset,response)}));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const current=await caches.open(CACHE);for(const key of await caches.keys()){if(!key.startsWith(CACHE_PREFIX)||key===CACHE)continue;const previous=await caches.open(key);for(const asset of [...CORE,...DOCUMENTS,...LIBRARIES])if(!(await current.match(asset))){const response=await previous.match(asset);if(response)await current.put(asset,response)}await caches.delete(key)}await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const asset=[...CORE,...DOCUMENTS].map(p=>new URL(p,self.location.href).href).find(h=>{const expected=new URL(h);return expected.origin===url.origin&&expected.pathname===url.pathname})||LIBRARIES.find(h=>h===url.href);
 if(!asset)return;
 // Únicamente archivos públicos; nunca API, notas, usuarios ni asistencias pendientes.
 const update=(async()=>{const cache=await caches.open(CACHE);const old=await cache.match(asset);if(old)return old;const response=await boundedFetch(event.request);if(response.ok)await cache.put(asset,response.clone());return response});
 if(event.request.mode==='navigate'){
  // Abrir inmediatamente la copia disponible. La red actualiza la próxima apertura.
  event.respondWith((async()=>{const cache=await caches.open(CACHE),old=await cache.match(asset);if(old)return old;try{return await update()}catch{return Response.error()}})());
  event.waitUntil((async()=>{try{const response=await boundedFetch(event.request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(asset,response)}}catch{}})());
 }else event.respondWith((async()=>{try{return await update()}catch{const cache=await caches.open(CACHE);return await cache.match(asset)||Response.error()}})());
});
