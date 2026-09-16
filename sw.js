const CACHE='personal-tracker-v5.5.1';
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
const ACTION_DB='personal-tracker-actions-v2',ACTION_STORE='actions';
function openActionDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(ACTION_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(ACTION_STORE))db.createObjectStore(ACTION_STORE,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function persistLocalAction(payload){
  const db=await openActionDb();
  const record={id:`act_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,createdAt:Date.now(),payload};
  await new Promise((resolve,reject)=>{const tx=db.transaction(ACTION_STORE,'readwrite');tx.objectStore(ACTION_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();return record;
}
async function notifyOpenClients(payload){
  const list=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of list){try{c.postMessage({type:'notification-action-local',payload})}catch{}}
}
self.addEventListener('notificationclick',e=>{
  const d=e.notification.data||{},rawAction=e.action;
  let action=rawAction;
  // On the target Android/RTL notification UI, Chrome has been observed to return
  // the opposite action id for the two visible buttons. Normalize only notifications
  // explicitly marked by the Worker so the mapping remains scoped and testable.
  if(d.actionMapping==='swap-done-snooze-v1'){
    if(rawAction==='done')action='snooze';
    else if(rawAction==='snooze')action='done';
  }
  e.notification.close();
  if(action&&d.actionUrl&&d.deviceId){
    e.waitUntil((async()=>{
      const now=Date.now();
      const payload={deviceId:d.deviceId,action,rawAction,kind:d.kind,dateKey:d.dateKey,trackerDay:d.trackerDay,trackerId:d.trackerId,itemId:d.itemId,reminderId:d.reminderId,taskId:d.taskId,at:now};
      if(action==='snooze')payload.snoozedUntil=now+3600000;
      try{await persistLocalAction(payload)}catch{}
      try{await notifyOpenClients(payload)}catch{}
      try{
        const r=await fetch(d.actionUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error('action failed');
      }catch{await focusOrOpen(d.url||'./')}
    })());return;
  }
  e.waitUntil(focusOrOpen(d.url||'./'));
});
