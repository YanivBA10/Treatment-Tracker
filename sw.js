const CACHE='personal-tracker-v5-ux1-20260910';
const ASSETS=['./','./index.html','./config.js','./app.js','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
self.addEventListener('push',e=>{
  let data={title:'המעקבים שלי',body:'יש לך פעולה לביצוע',tag:'personal-tracker-reminder',url:'./'};
  try{if(e.data)data={...data,...e.data.json()}}catch{}
  e.waitUntil(self.registration.showNotification(data.title||'המעקבים שלי',{
    body:data.body||'',icon:'icon.svg',badge:'icon.svg',tag:data.tag||'personal-tracker-reminder',
    data:{url:data.url||'./'},renotify:false
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const url=e.notification.data?.url||'./';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){c.navigate?.(url);return c.focus()}}
    return clients.openWindow?clients.openWindow(url):undefined;
  }));
});
