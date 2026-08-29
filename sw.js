const CACHE='mkk-hygiene-v1';
const STATIC=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.endsWith('/data/entries.json')){ e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request))); return; }
  if(e.request.method==='GET') e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
function db(){return new Promise((res,rej)=>{const r=indexedDB.open('mkk-sw',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function get(k,d=null){const x=await db();return new Promise((res,rej)=>{const t=x.transaction('kv','readonly').objectStore('kv').get(k);t.onsuccess=()=>res(t.result??d);t.onerror=()=>rej(t.error)})}
async function set(k,v){const x=await db();return new Promise((res,rej)=>{const t=x.transaction('kv','readwrite').objectStore('kv').put(v,k);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)})}
self.addEventListener('message',e=>{if(e.data?.type==='SET_PREFS')e.waitUntil(Promise.all([set('towns',e.data.towns||[]),set('notifications',!!e.data.notifications)]))});
self.addEventListener('periodicsync',e=>{if(e.tag==='mkk-check')e.waitUntil(check())});
async function check(){
  if(!(await get('notifications',false)))return;
  try{
    const r=await fetch('./data/entries.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok)return;
    const data=await r.json(), entries=data.entries||[], ids=entries.map(x=>x.id), old=await get('seen',[]);
    if(!old.length){await set('seen',ids);return}
    const towns=await get('towns',[]); const fresh=entries.filter(x=>!old.includes(x.id)&&(!towns.length||towns.includes(x.city)));
    await set('seen',ids.slice(0,500));
    if(fresh.length) await self.registration.showNotification('Neue MKK-Hygieneveröffentlichung',{body:fresh.length===1?`${fresh[0].name} · ${fresh[0].city}`:`${fresh.length} neue Einträge im beobachteten Bereich`,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:'mkk-new',data:{url:'./'}});
  }catch{}
}
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():clients.openWindow(e.notification.data?.url||'./'))) });
