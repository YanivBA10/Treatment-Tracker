const CACHE='personal-tracker-v5.4';
const ASSETS=['./','./index.html','./config.js','./app.js','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
self.addEventListener('push',e=>{
  let data={title:'המעקבים שלי',body:'יש לך פעולה לביצוע',tag:'personal-tracker-reminder',url:'./'};
  try{if(e.data)data={...data,...e.data.json()}}catch{}
  const opts={body:data.body||'',icon:'icon.svg',badge:'icon.svg',tag:data.tag||'personal-tracker-reminder',data:data.data||{url:data.url||'./'},renotify:false};
  if(data.actions)opts.actions=data.actions;
  e.waitUntil(self.registration.showNotification(data.title||'המעקבים שלי',opts));
});
async function focusOrOpen(url){
  const list=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of list){if('focus'in c){try{await c.navigate?.(url)}catch{}return c.focus()}}
  return clients.openWindow?clients.openWindow(url):undefined;
}
self.addEventListener('notificationclick',e=>{
  const d=e.notification.data||{},action=e.action;e.notification.close();
  if(action&&d.actionUrl&&d.deviceId){
    e.waitUntil((async()=>{
      try{
        const payload={deviceId:d.deviceId,action,kind:d.kind,dateKey:d.dateKey,trackerDay:d.trackerDay,trackerId:d.trackerId,itemId:d.itemId,reminderId:d.reminderId,taskId:d.taskId};
        const r=await fetch(d.actionUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error('action failed');
      }catch{await focusOrOpen(d.url||'./')}
    })());return;
  }
  e.waitUntil(focusOrOpen(d.url||'./'));
});
