
const APP_KEY='personalTracker_v3';
const OLD_KEY='treatmentTracker_v1';
const DAY_MS=86400000;
const PUSH_API=(window.PERSONAL_TRACKER_PUSH_API||'').replace(/\/$/,'');
const DEVICE_KEY='personalTrackerDeviceId_v1';
let pushSyncTimer=null;
let state=loadState();
let currentTrackerId=null, editingTrackerId=null, detailSection='today';
let renderedRoute=null, isExiting=false;

function uid(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function todayStr(){const d=new Date();return localDateStr(d)}
function localDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function fmtDate(d,short=false){return new Intl.DateTimeFormat('he-IL',short?{day:'2-digit',month:'2-digit'}:{weekday:'long',day:'numeric',month:'long'}).format(d)}
function save(){localStorage.setItem(APP_KEY,JSON.stringify(state));schedulePushSync()}
function toast(msg){const e=document.getElementById('toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id=uid('device');localStorage.setItem(DEVICE_KEY,id)}return id}
function applyTheme(){
  state.settings||={theme:'system'};const pref=state.settings.theme||'system';
  const resolved=pref==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):pref;
  document.documentElement.dataset.theme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=resolved==='dark'?'#0f1420':'#f3f6fb';
  const sel=document.getElementById('themeSelect');if(sel)sel.value=pref;
}
function showConfirm({title,message,confirmText='אישור',danger=false,cancelText='ביטול'}){
  return new Promise(resolve=>{
    const bg=document.getElementById('modalBackdrop'),t=document.getElementById('modalTitle'),m=document.getElementById('modalMessage'),ok=document.getElementById('modalConfirm'),cancel=document.getElementById('modalCancel');
    t.textContent=title;m.textContent=message;ok.textContent=confirmText;cancel.textContent=cancelText;
    ok.className='btn'+(danger?' danger':'');bg.classList.remove('hidden');
    const finish=v=>{bg.classList.add('hidden');ok.onclick=null;cancel.onclick=null;bg.onclick=null;resolve(v)};
    ok.onclick=()=>finish(true);cancel.onclick=()=>finish(false);bg.onclick=e=>{if(e.target===bg)finish(false)};
  });
}

function loadState(){
  const existing=JSON.parse(localStorage.getItem(APP_KEY)||'null');
  if(existing){existing.version=5;existing.settings||={theme:'system'};if(!existing.settings.theme)existing.settings.theme='system';existing.trackers||=[];existing.reminders||=[];for(const tr of existing.trackers)for(const s of (tr.stages||[]))for(const t of (s.tasks||[]))if(t.description==null)t.description='';return existing;}
  const old=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
  const base={version:5,trackers:[],reminders:[],settings:{theme:'system'}};
  if(old){base.trackers.push(migrateOld(old));localStorage.setItem(APP_KEY,JSON.stringify(base));}
  return base;
}
function migrateOld(old){
  return {id:uid('tracker'),name:'טיפול משחה ואבקה',startDate:old.startDate||todayStr(),duration:30,openEnded:false,mode:'staged',status:'active',createdAt:Date.now(),done:old.done||{},stages:[
    {id:uid('stage'),from:1,to:20,tasks:[task('ointment_morning','משחה','08:00','daily',true,'בוקר'),task('ointment_evening','משחה','20:00','daily',true,'ערב'),task('powder_evening','אבקה','20:00','daily',true,'ערב')]},
    {id:uid('stage'),from:21,to:24,tasks:[task('ointment_evening','משחה','20:00','daily',true,'ערב'),task('powder_evening','אבקה','20:00','daily',true,'ערב')]},
    {id:uid('stage'),from:25,to:25,tasks:[task('powder_evening','אבקה','20:00','daily',true,'ערב')]},
    {id:uid('stage'),from:26,to:30,tasks:[task('ointment_evening','משחה','20:00','every_other',true,'ערב'),task('powder_evening','אבקה','20:00','daily',true,'ערב')]}
  ]};
}
function task(id,label,time,freq='daily',notify=true,periodLabel='',description=''){return {id,label,description,time,freq,everyN:2,weekdays:[0,1,2,3,4,5,6],notify,periodLabel}}
function trackerDay(tr,date=new Date()){const a=parseDate(tr.startDate),b=new Date(date.getFullYear(),date.getMonth(),date.getDate());return Math.floor((b-a)/DAY_MS)+1}
function trackerEndDay(tr){return tr.openEnded?Infinity:Number(tr.duration||1)}
function stageForDay(tr,day){if(tr.mode==='simple')return tr.stages[0];return tr.stages.find(s=>day>=Number(s.from)&&day<=Number(s.to))||null}
function taskOccurs(t,day,stage){
  if(t.freq==='daily')return true;
  if(t.freq==='every_other')return ((day-Number(stage.from))%2===0);
  if(t.freq==='every_n')return ((day-Number(stage.from))%Math.max(1,Number(t.everyN||1))===0);
  if(t.freq==='weekdays'){const d=parseDate(currentTrackerForDate.startDate);d.setDate(d.getDate()+day-1);return (t.weekdays||[]).includes(d.getDay())}
  return true;
}
let currentTrackerForDate=null;
function tasksForDay(tr,day){if(day<1||day>trackerEndDay(tr))return[];const s=stageForDay(tr,day);if(!s)return[];currentTrackerForDate=tr;return s.tasks.filter(t=>taskOccurs(t,day,s));}
function dayKey(day){return 'day_'+day}
function isDone(tr,day,id){return !!(tr.done&&tr.done[dayKey(day)]&&tr.done[dayKey(day)][id])}
function toggleDone(tr,day,id){tr.done ||= {};tr.done[dayKey(day)] ||= {};tr.done[dayKey(day)][id]=!tr.done[dayKey(day)][id];save();renderDetail();renderMain();}
function totalStats(tr){let total=0,done=0;const max=tr.openEnded?Math.max(1,trackerDay(tr)):trackerEndDay(tr);for(let d=1;d<=max;d++){for(const t of tasksForDay(tr,d)){total++;if(isDone(tr,d,t.id))done++;}}return{total,done,pct:total?Math.round(done/total*100):0}}
function todayStats(tr){const d=trackerDay(tr),ts=tasksForDay(tr,d),done=ts.filter(t=>isDone(tr,d,t.id)).length;return{day:d,total:ts.length,done}}
function trackerLabel(tr){const d=trackerDay(tr);if(d<1)return 'טרם התחיל';if(!tr.openEnded&&d>tr.duration)return 'הסתיים';return tr.openEnded?`יום ${d}`:`יום ${d} מתוך ${tr.duration}`}

function renderMain(){
  state.reminders||=[];
  const act=document.getElementById('activeTrackers'),arc=document.getElementById('archivedTrackers'),rem=document.getElementById('activeReminders'),doneRem=document.getElementById('completedReminders');
  act.innerHTML='';arc.innerHTML='';rem.innerHTML='';doneRem.innerHTML='';
  const active=state.trackers.filter(t=>t.status==='active'), archived=state.trackers.filter(t=>t.status==='archived');
  if(!active.length)act.innerHTML='<div class="empty">אין כרגע מעקבים פעילים.</div>'; else active.forEach(t=>act.appendChild(trackerCard(t)));
  if(!archived.length)arc.innerHTML='<div class="empty">אין מעקבים בארכיון.</div>'; else archived.forEach(t=>arc.appendChild(trackerCard(t,true)));
  const activeR=state.reminders.filter(r=>r.status!=='completed').sort((a,b)=>reminderSortKey(a).localeCompare(reminderSortKey(b)));
  const completedR=state.reminders.filter(r=>r.status==='completed').sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
  if(!activeR.length)rem.innerHTML='<div class="empty compact">אין כרגע תזכורות פעילות.</div>'; else activeR.forEach(r=>rem.appendChild(reminderCard(r,false)));
  if(!completedR.length)doneRem.innerHTML='<div class="empty compact">אין תזכורות שהושלמו.</div>'; else completedR.forEach(r=>doneRem.appendChild(reminderCard(r,true)));
  renderNotificationStatus();
}
function trackerCard(tr,archived=false){const el=document.createElement('div');el.className='tracker';const st=todayStats(tr),all=totalStats(tr);let todayText=st.day>=1&&st.total?`${st.done}/${st.total} היום`:(st.day<1?'טרם התחיל':'אין פעולות היום');
  el.innerHTML=`<div class="tracker-top"><div><div class="tracker-name">${esc(tr.name)}</div><div class="small">${trackerLabel(tr)} · ${todayText}</div></div><div class="badge ${st.total&&st.done===st.total?'ok':''}">${archived?'בארכיון':all.pct+'%'}</div></div><div class="progress"><div style="width:${all.pct}%"></div></div>${archived?'<div class="actions"><button class="btn ghost smallbtn" data-restore>החזר לפעילים</button></div>':''}`;
  el.onclick=()=>openTracker(tr.id);if(archived)el.querySelector('[data-restore]').onclick=(e)=>{e.stopPropagation();tr.status='active';save();renderMain();toast('המעקב הוחזר לפעילים')};return el;}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

function openTracker(id){pushRoute({route:'detail',trackerId:id,section:'today'});}
function renderTrackerRoute(id,section='today'){const tr=state.trackers.find(t=>t.id===id);if(!tr){replaceRoute({route:'main',view:'activeView'});return}currentTrackerId=id;editingTrackerId=null;detailSection=section||'today';showOnly('detailView');document.getElementById('bottomTabs').classList.add('hidden');renderDetail();}
function currentTracker(){return state.trackers.find(t=>t.id===currentTrackerId)}
function renderDetail(){const tr=currentTracker();if(!tr)return;document.getElementById('detailName').textContent=tr.name;document.getElementById('detailMeta').textContent=`${trackerLabel(tr)} · התחלה ${fmtDate(parseDate(tr.startDate),true)}`;document.getElementById('detailBadge').textContent=tr.status==='archived'?'בארכיון':'פעיל';const all=totalStats(tr);document.getElementById('detailProgress').style.width=all.pct+'%';document.querySelectorAll('.detail-nav button').forEach(b=>b.classList.toggle('active',b.dataset.detail===detailSection));document.getElementById('detailToday').classList.toggle('hidden',detailSection!=='today');document.getElementById('detailHistory').classList.toggle('hidden',detailSection!=='history');document.getElementById('detailSettings').classList.toggle('hidden',detailSection!=='settings');renderDetailToday(tr);renderDetailHistory(tr);renderDetailSettings(tr);}
function renderDetailToday(tr){const box=document.getElementById('detailToday'),day=trackerDay(tr);box.innerHTML='';const top=document.createElement('div');top.className='card';top.innerHTML=`<div class="section-title">${day<1?'המעקב עדיין לא התחיל':(!tr.openEnded&&day>tr.duration?'המעקב הסתיים':`היום · יום ${day}`)}</div><div class="small">${fmtDate(new Date())}</div>`;box.appendChild(top);const tasks=tasksForDay(tr,day);const c=document.createElement('div');c.className='card';c.innerHTML='<div class="section-title">הפעולות להיום</div>';if(!tasks.length)c.innerHTML+='<div class="empty">אין פעולות מתוכננות להיום.</div>';tasks.forEach(t=>c.appendChild(taskRow(tr,day,t)));if(tasks.length){const done=tasks.filter(t=>isDone(tr,day,t.id)).length;const s=document.createElement('div');s.className='summary';s.textContent=`${done} מתוך ${tasks.length} הושלמו היום`;c.appendChild(s)}box.appendChild(c);
  const pending=[];for(let d=1;d<Math.min(day,trackerEndDay(tr)+1);d++){const ts=tasksForDay(tr,d);if(ts.length&&ts.some(t=>!isDone(tr,d,t.id)))pending.push(d)}if(pending.length){const n=document.createElement('div');n.className='card notice';n.innerHTML=`<div class="section-title">יש פעולות קודמות שלא סומנו</div><div class="summary">${pending.length===1?`יום ${pending[0]} לא הושלם.`:`יש ${pending.length} ימים קודמים שלא הושלמו.`}</div><button class="btn secondary block">מעבר להיסטוריה</button>`;n.querySelector('button').onclick=()=>{detailSection='history';renderDetail();setTimeout(()=>openHistoryEditor(tr,pending[0]),20)};box.appendChild(n)}
}
function taskRow(tr,day,t){const done=isDone(tr,day,t.id),r=document.createElement('div');r.className='task'+(done?' done':'');r.innerHTML=`<div class="grow"><div class="task-label">${esc(t.label)}</div>${t.description?`<div class="task-description">${esc(t.description)}</div>`:''}<div class="task-meta">${t.periodLabel?esc(t.periodLabel)+' · ':''}${t.time||''}${t.notify?' · 🔔':''}</div></div><button class="check">${done?'✓':''}</button>`;r.querySelector('button').onclick=()=>toggleDone(tr,day,t.id);return r}
function renderDetailHistory(tr){const box=document.getElementById('detailHistory');box.innerHTML='<div class="card"><div class="section-title">היסטוריה</div><div id="historyRows"></div><div id="historyEditor"></div></div>';const rows=box.querySelector('#historyRows'),today=trackerDay(tr),max=tr.openEnded?Math.max(30,today):tr.duration;for(let d=1;d<=max;d++){const ts=tasksForDay(tr,d);const done=ts.filter(t=>isDone(tr,d,t.id)).length,date=parseDate(tr.startDate);date.setDate(date.getDate()+d-1);const row=document.createElement('div');row.className='history-day'+(d>today?' future':'');let txt=d===today?`היום · ${done}/${ts.length}`:`${done}/${ts.length}`,cls='';if(d<today&&ts.length){if(done===ts.length){txt='הושלם';cls='ok'}else cls='miss'}row.innerHTML=`<div><strong>יום ${d}</strong><div class="task-meta">${fmtDate(date,true)}</div></div><div class="status ${cls}">${txt}</div>`;if(d<=today)row.onclick=()=>openHistoryEditor(tr,d);rows.appendChild(row)}}
function openHistoryEditor(tr,day){const ed=document.getElementById('historyEditor');if(!ed)return;const date=parseDate(tr.startDate);date.setDate(date.getDate()+day-1);ed.innerHTML=`<div class="form-box"><h4>עדכון יום ${day}</h4><div class="small">${fmtDate(date)}</div><div id="editTasks"></div></div>`;const b=ed.querySelector('#editTasks');const ts=tasksForDay(tr,day);if(!ts.length)b.innerHTML='<div class="empty">לא היו פעולות ביום הזה.</div>';ts.forEach(t=>b.appendChild(taskRow(tr,day,t)));ed.scrollIntoView({behavior:'smooth',block:'nearest'});}
function renderDetailSettings(tr){const box=document.getElementById('detailSettings');box.innerHTML=`<div class="card"><div class="section-title">ניהול המעקב</div><div class="actions"><button class="btn secondary" data-edit>ערוך</button><button class="btn ghost" data-dup>שכפל</button><button class="btn ghost" data-archive>${tr.status==='archived'?'החזר לפעילים':'העבר לארכיון'}</button><button class="btn danger" data-delete>מחק</button></div></div><div class="card"><div class="section-title">תכנית</div><div class="small">${describeTracker(tr)}</div></div>`;box.querySelector('[data-edit]').onclick=()=>openEditor(tr.id);box.querySelector('[data-dup]').onclick=()=>duplicateTracker(tr);box.querySelector('[data-archive]').onclick=()=>{tr.status=tr.status==='archived'?'active':'archived';save();renderMain();renderDetail();toast(tr.status==='archived'?'הועבר לארכיון':'הוחזר לפעילים')};box.querySelector('[data-delete]').onclick=async()=>{const ok=await showConfirm({title:'למחוק את המעקב?',message:`"${tr.name}" יימחק יחד עם כל ההיסטוריה שלו. לא ניתן לשחזר את הנתונים לאחר המחיקה.`,confirmText:'מחק לצמיתות',danger:true});if(ok){state.trackers=state.trackers.filter(x=>x.id!==tr.id);save();goHome();toast('המעקב נמחק')}}}
function describeTracker(tr){if(tr.mode==='simple'){const s=tr.stages[0];return `מעקב פשוט · ${tr.openEnded?'ללא תאריך סיום':tr.duration+' ימים'} · ${s.tasks.length} פעולות.`}return `מעקב בשלבים · ${tr.stages.length} שלבים · ${tr.openEnded?'ללא תאריך סיום':tr.duration+' ימים'}.`}
function duplicateTracker(tr){const copy=JSON.parse(JSON.stringify(tr));copy.id=uid('tracker');copy.name=tr.name+' - עותק';copy.startDate=todayStr();copy.status='active';copy.done={};copy.createdAt=Date.now();copy.stages.forEach(s=>{s.id=uid('stage');s.tasks.forEach(t=>t.id=uid('task'))});state.trackers.push(copy);save();renderMain();toast('נוצר עותק חדש ללא היסטוריה');}


function reminderSortKey(r){return `${r.date||'9999-12-31'}T${r.time||'23:59'}|${r.title||''}`}
function reminderRepeatLabel(r){return r.repeat==='daily'?'כל יום':r.repeat==='weekly'?'כל שבוע':'חד־פעמית'}
function reminderDueToday(r){
  if(r.status==='completed'||!r.date)return false;const today=todayStr();if(today<r.date)return false;
  if(r.repeat==='once')return today===r.date;
  if(r.repeat==='daily')return true;
  if(r.repeat==='weekly')return parseDate(today).getDay()===parseDate(r.date).getDay();
  return false;
}
function reminderDoneToday(r){return !!(r.doneDates&&r.doneDates[todayStr()])}
function reminderCard(r,completed=false){
  const el=document.createElement('div');el.className='reminder-card'+(completed?' completed':'');const due=reminderDueToday(r),doneToday=reminderDoneToday(r);
  const when=r.repeat==='once'?`${fmtDate(parseDate(r.date),true)} · ${r.time}`:`${reminderRepeatLabel(r)} · ${r.time}`;
  el.innerHTML=`<div class="reminder-main"><div class="grow"><div class="tracker-name">${esc(r.title)}</div>${r.description?`<div class="reminder-description">${esc(r.description)}</div>`:''}<div class="task-meta">${when}${r.notify?' · 🔔':''}</div></div>${completed?'<span class="badge ok">הושלם</span>':`<button class="check reminder-check" aria-label="סימון בוצע">${doneToday?'✓':''}</button>`}</div>`;
  if(!completed)el.querySelector('.reminder-check').onclick=e=>{e.stopPropagation();completeReminder(r)};
  el.onclick=()=>openReminderEditor(r.id);return el;
}
async function completeReminder(r){
  if(r.repeat==='once'){r.status='completed';r.completedAt=Date.now();}
  else{r.doneDates||={};r.doneDates[todayStr()]=!r.doneDates[todayStr()];}
  save();renderMain();toast(r.repeat==='once'?'התזכורת הועברה להושלמו':(reminderDoneToday(r)?'סומן כבוצע להיום':'הסימון בוטל'));
}
function openReminderEditor(id=null){pushRoute({route:'reminderEditor',reminderId:id||null});}
function renderReminderEditorRoute(id=null){
  showOnly('reminderEditorView');document.getElementById('bottomTabs').classList.add('hidden');
  const found=id?(state.reminders||[]).find(r=>r.id===id):null;if(id&&!found){replaceRoute({route:'main',view:'activeView'});return}
  const r=found?JSON.parse(JSON.stringify(found)):{id:null,title:'',description:'',date:todayStr(),time:'20:00',repeat:'once',notify:true,status:'active',doneDates:{}};
  window.reminderDraft=r;document.getElementById('reminderEditorTitle').textContent=id?'עריכת תזכורת':'תזכורת חדשה';document.getElementById('reminderTitle').value=r.title;document.getElementById('reminderDescription').value=r.description||'';document.getElementById('reminderDate').value=r.date||todayStr();document.getElementById('reminderTime').value=r.time||'20:00';document.getElementById('reminderRepeat').value=r.repeat||'once';document.getElementById('reminderNotify').checked=r.notify!==false;document.getElementById('deleteReminderBtn').classList.toggle('hidden',!id);
}
function saveReminderEditor(){
  const r=window.reminderDraft;r.title=document.getElementById('reminderTitle').value.trim();r.description=document.getElementById('reminderDescription').value.trim();r.date=document.getElementById('reminderDate').value||todayStr();r.time=document.getElementById('reminderTime').value||'20:00';r.repeat=document.getElementById('reminderRepeat').value;r.notify=document.getElementById('reminderNotify').checked;
  if(!r.title){toast('צריך לתת שם לתזכורת.');return}
  state.reminders||=[];if(r.id){const i=state.reminders.findIndex(x=>x.id===r.id);state.reminders[i]=r}else{r.id=uid('reminder');r.createdAt=Date.now();r.status='active';r.doneDates={};state.reminders.push(r)}
  save();goHome();toast('התזכורת נשמרה');
}
async function deleteCurrentReminder(){
  const r=window.reminderDraft;if(!r?.id)return;const ok=await showConfirm({title:'למחוק את התזכורת?',message:`"${r.title}" תימחק לצמיתות.`,confirmText:'מחק לצמיתות',danger:true});if(!ok)return;state.reminders=state.reminders.filter(x=>x.id!==r.id);save();goHome();toast('התזכורת נמחקה');
}
function openEditor(id=null){pushRoute({route:'editor',trackerId:id||null});}
function renderEditorRoute(id=null){
  editingTrackerId=id;currentTrackerId=null;showOnly('editorView');document.getElementById('bottomTabs').classList.add('hidden');
  const found=id?state.trackers.find(t=>t.id===id):null;if(id&&!found){replaceRoute({route:'main',view:'activeView'});return}
  const tr=id?JSON.parse(JSON.stringify(found)):{id:null,name:'',startDate:todayStr(),duration:null,openEnded:false,mode:'simple',stages:[{id:uid('stage'),from:1,to:1,tasks:[newTask()]}]};
  window.editorDraft=tr;fillEditor();
}
function newTask(){return{id:uid('task'),label:'',description:'',time:'20:00',freq:'daily',everyN:2,weekdays:[0,1,2,3,4,5,6],notify:true,periodLabel:''}}
function fillEditor(){
  const tr=window.editorDraft;
  document.getElementById('editorTitle').textContent=editingTrackerId?'עריכת מעקב':'מעקב חדש';
  document.getElementById('trackerName').value=tr.name;
  document.getElementById('trackerStart').value=tr.startDate;
  document.getElementById('trackerDuration').value=tr.duration||'';
  document.getElementById('trackerOpenEnded').checked=!!tr.openEnded;
  document.getElementById('trackerDuration').disabled=!!tr.openEnded;
  document.getElementById('trackerMode').value=tr.mode;renderBuilder();
}
function syncBasicDraft(){
  const tr=window.editorDraft;
  tr.name=document.getElementById('trackerName').value.trim();
  tr.startDate=document.getElementById('trackerStart').value||todayStr();
  const raw=document.getElementById('trackerDuration').value.trim();
  tr.duration=raw?Math.max(1,Number(raw)):null;
  tr.openEnded=document.getElementById('trackerOpenEnded').checked;
}
function renderBuilder(){const tr=window.editorDraft,b=document.getElementById('builder');b.innerHTML='';if(tr.mode==='simple')renderSimpleBuilder(tr,b);else renderStagedBuilder(tr,b)}
function renderSimpleBuilder(tr,b){
  if(!tr.stages.length)tr.stages=[{id:uid('stage'),from:1,to:tr.openEnded?99999:(tr.duration||1),tasks:[newTask()]}];
  const s=tr.stages[0];s.from=1;s.to=tr.openEnded?99999:(tr.duration||1);
  const box=document.createElement('div');box.className='form-box';
  box.innerHTML='<h4>פעולות שחוזרות לאורך המעקב</h4><div class="small">אפשר להוסיף כמה פעולות עם שעות ותדירויות שונות.</div><div class="tasksHost"></div><button class="btn secondary block addTask">+ הוסף פעולה</button>';
  const host=box.querySelector('.tasksHost');s.tasks.forEach((t,i)=>host.appendChild(taskEditor(t,()=>{s.tasks.splice(i,1);renderBuilder()})));
  box.querySelector('.addTask').onclick=()=>{s.tasks.push(newTask());renderBuilder()};b.appendChild(box)
}
function normalizeStagesForDuration(tr){
  if(tr.openEnded||!tr.duration)return;
  tr.stages=tr.stages.filter(s=>Number(s.from)<=tr.duration);
  tr.stages.forEach(s=>{s.from=Math.max(1,Math.min(tr.duration,Number(s.from)||1));s.to=Math.max(s.from,Math.min(tr.duration,Number(s.to)||s.from))});
}
function renderStagedBuilder(tr,b){
  if(!tr.openEnded&&!tr.duration){
    b.innerHTML='<div class="form-box notice"><h4>קודם מגדירים את משך המעקב</h4><div class="small">אחרי שתזין מספר ימים למעלה, המערכת תציע טווחים שמתאימים בדיוק לאורך המעקב.</div></div>';return;
  }
  normalizeStagesForDuration(tr);
  if(!tr.stages.length)tr.stages=[{id:uid('stage'),from:1,to:tr.openEnded?1:tr.duration,tasks:[newTask()]}];
  tr.stages.forEach((s,si)=>{
    const maxAttr=tr.openEnded?'':`max="${tr.duration}"`;
    const box=document.createElement('div');box.className='form-box';
    box.innerHTML=`<div class="row"><h4 class="grow">שלב ${si+1}</h4>${tr.stages.length>1?'<button class="btn danger smallbtn delStage">הסר</button>':''}</div>
      <div class="field-grid"><div><label>מיום</label><input class="from" type="number" min="1" ${maxAttr} value="${s.from}"></div><div><label>עד יום</label><input class="to" type="number" min="1" ${maxAttr} value="${s.to}"></div></div>
      <div class="tasksHost"></div><button class="btn secondary block addTask">+ הוסף פעולה לשלב</button>`;
    box.querySelector('.from').onchange=e=>{let v=Math.max(1,Number(e.target.value||1));if(!tr.openEnded)v=Math.min(tr.duration,v);s.from=v;if(s.to<s.from)s.to=s.from;renderBuilder()};
    box.querySelector('.to').onchange=e=>{let v=Math.max(s.from,Number(e.target.value||s.from));if(!tr.openEnded)v=Math.min(tr.duration,v);s.to=v;renderBuilder()};
    const host=box.querySelector('.tasksHost');s.tasks.forEach((t,i)=>host.appendChild(taskEditor(t,()=>{s.tasks.splice(i,1);renderBuilder()})));
    box.querySelector('.addTask').onclick=()=>{s.tasks.push(newTask());renderBuilder()};
    if(box.querySelector('.delStage'))box.querySelector('.delStage').onclick=()=>{tr.stages.splice(si,1);renderBuilder()};
    b.appendChild(box)
  });
  const add=document.createElement('button');add.className='btn ghost block';add.textContent='+ הוסף שלב';
  add.onclick=()=>{
    const last=tr.stages[tr.stages.length-1],from=last?Number(last.to)+1:1;
    if(!tr.openEnded&&from>tr.duration){toast('כל ימי המעקב כבר מכוסים בשלבים הקיימים');return}
    tr.stages.push({id:uid('stage'),from,to:tr.openEnded?from:tr.duration,tasks:[newTask()]});renderBuilder()
  };b.appendChild(add)
}
function taskEditor(t,onDelete){
  if(t.description==null)t.description='';
  const w=document.createElement('div');w.className='task-form';
  w.innerHTML=`<div class="row"><div class="grow"><label>שם הפעולה</label><input class="label" value="${esc(t.label)}" placeholder="לדוגמה: לבצע תרגיל"></div><div style="width:120px"><label>שעה</label><input class="time" type="time" value="${t.time||'20:00'}"></div></div><label>תיאור / הערה <span class="optional">(אופציונלי)</span></label><textarea class="description" rows="2" placeholder="לדוגמה: 3 סטים של 10 חזרות">${esc(t.description)}</textarea><label>תדירות</label><select class="freq"><option value="daily">כל יום</option><option value="every_other">יום כן / יום לא</option><option value="every_n">כל X ימים</option><option value="weekdays">ימים מסוימים בשבוע</option></select><div class="freqExtra"></div><div class="switchline"><input class="notify" type="checkbox" ${t.notify?'checked':''}><span>התראה בשעה שנבחרה</span></div><button class="btn danger smallbtn del" style="margin-top:10px">הסר פעולה</button>`;
  w.querySelector('.freq').value=t.freq;w.querySelector('.label').oninput=e=>t.label=e.target.value;w.querySelector('.description').oninput=e=>t.description=e.target.value;w.querySelector('.time').oninput=e=>t.time=e.target.value;w.querySelector('.notify').onchange=e=>t.notify=e.target.checked;
  w.querySelector('.freq').onchange=e=>{t.freq=e.target.value;renderFreqExtra()};w.querySelector('.del').onclick=onDelete;
  function renderFreqExtra(){const ex=w.querySelector('.freqExtra');ex.innerHTML='';if(t.freq==='every_n'){ex.innerHTML=`<label>כל כמה ימים?</label><input class="everyN" type="number" min="1" value="${t.everyN||2}">`;ex.querySelector('.everyN').onchange=e=>t.everyN=Math.max(1,Number(e.target.value||1))}if(t.freq==='weekdays'){const names=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];const wrap=document.createElement('div');wrap.className='weekdays';names.forEach((n,i)=>{const l=document.createElement('label');l.className='weekday';l.innerHTML=`<input type="checkbox" ${t.weekdays.includes(i)?'checked':''}>${n}`;l.querySelector('input').onchange=e=>{if(e.target.checked&&!t.weekdays.includes(i))t.weekdays.push(i);if(!e.target.checked)t.weekdays=t.weekdays.filter(x=>x!==i)};wrap.appendChild(l)});ex.appendChild(wrap)}}renderFreqExtra();return w
}
function validateDraft(tr){
  if(!tr.name)return'צריך לתת שם למעקב.';
  if(!tr.startDate)return'צריך לבחור תאריך התחלה.';
  if(!tr.openEnded&&!tr.duration)return'צריך להגדיר את משך המעקב.';
  if(!tr.stages.length)return'צריך לפחות שלב אחד.';
  let prevTo=0;
  for(const [i,s] of tr.stages.entries()){
    if(!s.tasks.length)return`בשלב ${i+1} אין פעולות.`;
    for(const t of s.tasks)if(!t.label.trim())return'יש פעולה ללא שם.';
    if(tr.mode==='staged'){
      const from=Number(s.from),to=Number(s.to);
      if(to<from)return`טווח הימים בשלב ${i+1} אינו תקין.`;
      if(!tr.openEnded&&(from>tr.duration||to>tr.duration))return`שלב ${i+1} חורג ממשך המעקב.`;
      if(from<=prevTo)return`שלב ${i+1} חופף לשלב הקודם.`;
      prevTo=to;
    }
  }
  return null
}
function saveEditor(){
  syncBasicDraft();const tr=window.editorDraft;
  if(tr.mode==='simple'){tr.stages[0].from=1;tr.stages[0].to=tr.openEnded?99999:tr.duration}
  const err=validateDraft(tr);if(err){toast(err);return}
  if(editingTrackerId){const idx=state.trackers.findIndex(t=>t.id===editingTrackerId),old=state.trackers[idx];tr.id=old.id;tr.done=old.done||{};tr.status=old.status;tr.createdAt=old.createdAt;state.trackers[idx]=tr}
  else{tr.id=uid('tracker');tr.done={};tr.status='active';tr.createdAt=Date.now();state.trackers.push(tr)}
  save();renderMain();goHome();toast('המעקב נשמר')
}
function showOnly(id){document.querySelectorAll('main').forEach(m=>m.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}
function renderMainRoute(view='activeView'){currentTrackerId=null;editingTrackerId=null;showOnly(view);document.getElementById('bottomTabs').classList.remove('hidden');document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.main===view));renderMain();}
function applyRoute(r){if(!r||!r.app||r.route==='exit')return;renderedRoute=r;if(r.route==='main')renderMainRoute(r.view||'activeView');else if(r.route==='detail')renderTrackerRoute(r.trackerId,r.section||'today');else if(r.route==='editor')renderEditorRoute(r.trackerId||null);else if(r.route==='reminderEditor')renderReminderEditorRoute(r.reminderId||null);}
function pushRoute(route){const depth=(history.state&&history.state.app?Number(history.state.depth||0):0)+1;const r={app:true,depth,...route};history.pushState(r,'');applyRoute(r);}
function replaceRoute(route){const depth=(history.state&&history.state.app)?Number(history.state.depth||1):1;const r={app:true,depth,...route};history.replaceState(r,'');applyRoute(r);}
function goHome(){replaceRoute({route:'main',view:'activeView'});}
function setupNavigation(){if(!history.state||!history.state.app){history.replaceState({app:true,route:'exit',depth:0},'');history.pushState({app:true,route:'main',view:'activeView',depth:1},'');}else if(history.state.route==='exit'){history.pushState({app:true,route:'main',view:'activeView',depth:Number(history.state.depth||0)+1},'');}applyRoute(history.state);}
let exitPromptOpen=false;
window.addEventListener('popstate',e=>{
  if(isExiting)return;
  const dest=e.state;
  if(dest&&dest.app&&dest.route!=='exit'){applyRoute(dest);return}
  setTimeout(()=>history.forward(),0);
  if(exitPromptOpen)return;exitPromptOpen=true;
  showConfirm({title:'לצאת מהאפליקציה?',message:'הנתונים שלך נשמרו. אפשר לחזור ולהמשיך בכל רגע.',confirmText:'יציאה'}).then(ok=>{
    exitPromptOpen=false;
    if(ok){isExiting=true;setTimeout(()=>history.go(-2),0)}
  });
});

function exportData(){
  try{
    const payload={app:'personal-tracker',formatVersion:1,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`personal-tracker-backup-${todayStr()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
    toast('קובץ הגיבוי נשמר');
  }catch(e){toast('לא הצלחנו לייצא את הנתונים')}
}
async function importDataFile(file){
  if(!file)return;
  try{
    const raw=await file.text(),parsed=JSON.parse(raw);
    const imported=parsed&&parsed.state?parsed.state:parsed;
    if(!imported||!Array.isArray(imported.trackers))throw new Error('invalid');
    const ok=await showConfirm({title:'לייבא את הגיבוי?',message:'הייבוא יחליף את כל המעקבים והסימונים הקיימים במכשיר הזה.',confirmText:'ייבוא'});if(!ok)return;
    state=imported;state.settings||={theme:'system'};
    state.version=5;state.settings||={theme:'system'};state.reminders||=[];
    save();currentTrackerId=null;editingTrackerId=null;renderMain();goHome();renderNotificationStatus();
    toast('הגיבוי יובא בהצלחה');
  }catch(e){toast('קובץ הגיבוי אינו תקין')}
}

function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function getPushSubscription(){
  if(!PUSH_API||!('serviceWorker'in navigator)||!('PushManager'in window)||Notification.permission!=='granted')return null;
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(sub)return sub;
  const cfg=await fetch(PUSH_API+'/config').then(r=>{if(!r.ok)throw new Error('config');return r.json()});
  sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.publicKey)});return sub;
}
function schedulePushSync(){if(!PUSH_API)return;clearTimeout(pushSyncTimer);pushSyncTimer=setTimeout(()=>syncPushState().catch(()=>{}),700)}
async function syncPushState(){
  if(!PUSH_API||Notification.permission!=='granted')return false;
  const sub=await getPushSubscription();if(!sub)return false;
  const payload={deviceId:deviceId(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',subscription:sub.toJSON(),state:{version:state.version,trackers:state.trackers,reminders:state.reminders||[]}};
  const r=await fetch(PUSH_API+'/state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});return r.ok
}
async function renderNotificationStatus(){
  const e=document.getElementById('notificationStatus'),b=document.getElementById('permissionBtn'),note=document.getElementById('pushStatusNote');
  if(!('Notification'in window)){e.textContent='המכשיר/דפדפן אינו תומך בהתראות.';b.textContent='התראות אינן נתמכות';b.disabled=true;note.textContent='';return}
  if(Notification.permission==='denied'){e.textContent='ההתראות חסומות בהגדרות המכשיר.';b.textContent='התראות חסומות';b.disabled=true;note.textContent='יש לאפשר אותן דרך הגדרות Android כדי להשתמש בתזכורות.';return}
  if(Notification.permission!=='granted'){e.textContent='עדיין לא ניתנה הרשאה להתראות.';b.textContent='אפשר התראות';b.disabled=false;note.textContent=PUSH_API?'לאחר האישור נחבר גם תזכורות רקע.':'התראת בדיקה מקומית זמינה לאחר אישור.';return}
  b.textContent='התראות פעילות ✓';b.disabled=true;
  if(PUSH_API){
    try{const sub=await getPushSubscription();e.textContent=sub?'התראות פעילות ✓ · תזכורות רקע מחוברות':'התראות פעילות ✓';note.textContent=sub?'התזכורות יכולות להגיע גם כשהאפליקציה סגורה. פעולה שכבר סומנה כבוצעה לא אמורה לקבל תזכורת.':'יש הרשאה להתראות, אבל חיבור הרקע עדיין לא הושלם.'}
    catch{e.textContent='התראות פעילות ✓';note.textContent='הרשאת ההתראות תקינה, אבל שירות תזכורות הרקע אינו זמין כרגע.'}
  }else{e.textContent='התראות פעילות ✓';note.textContent='הרשאת ההתראות תקינה. שירות תזכורות הרקע עדיין לא הוגדר בגרסה הזו.'}
}
async function enableNotifications(){
  if(!('Notification'in window))return;
  const p=await Notification.requestPermission();if(p==='granted'){
    if(PUSH_API){try{await getPushSubscription();await syncPushState();toast('התראות הרקע הופעלו')}catch{toast('ההרשאה ניתנה, אך חיבור הרקע נכשל')}}
    else toast('התראות הופעלו');
  }renderNotificationStatus()
}
async function notifyTest(){
  if(!('Notification'in window)){toast('אין תמיכה בהתראות');return}
  if(Notification.permission!=='granted'){toast('צריך קודם לאפשר התראות');return}
  if(PUSH_API){
    try{await syncPushState();const r=await fetch(PUSH_API+'/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId:deviceId()})});if(r.ok){toast('נשלחה התראת בדיקה דרך הרקע');return}}catch{}
  }
  try{const reg=await navigator.serviceWorker?.ready;if(reg)await reg.showNotification('המעקבים שלי',{body:'התראת הבדיקה פועלת ✓',icon:'icon.svg',badge:'icon.svg'});else new Notification('המעקבים שלי',{body:'התראת הבדיקה פועלת ✓'});toast('נשלחה התראת בדיקה')}catch{new Notification('המעקבים שלי',{body:'התראת הבדיקה פועלת ✓'});}
}
// events
document.getElementById('newTrackerBtn').onclick=()=>openEditor();document.getElementById('newReminderBtn').onclick=()=>openReminderEditor();document.getElementById('backToTrackers').onclick=()=>history.back();document.getElementById('cancelEditor').onclick=()=>history.back();document.getElementById('saveTrackerBtn').onclick=saveEditor;
document.getElementById('trackerOpenEnded').onchange=e=>{window.editorDraft.openEnded=e.target.checked;document.getElementById('trackerDuration').disabled=e.target.checked;syncBasicDraft();renderBuilder()};
document.getElementById('trackerMode').onchange=e=>{syncBasicDraft();const tr=window.editorDraft;if(e.target.value!==tr.mode){tr.mode=e.target.value;if(tr.mode==='simple'){const allTasks=tr.stages.flatMap(s=>s.tasks);tr.stages=[{id:uid('stage'),from:1,to:tr.openEnded?99999:(tr.duration||1),tasks:allTasks.length?allTasks:[newTask()]}]}else{tr.stages=[{id:uid('stage'),from:1,to:tr.openEnded?1:(tr.duration||1),tasks:tr.stages[0]?.tasks||[newTask()]}]}}renderBuilder()};
document.getElementById('trackerDuration').oninput=()=>{syncBasicDraft();renderBuilder()};
document.getElementById('cancelReminderEditor').onclick=()=>history.back();document.getElementById('saveReminderBtn').onclick=saveReminderEditor;document.getElementById('deleteReminderBtn').onclick=deleteCurrentReminder;
document.querySelectorAll('.detail-nav button').forEach(b=>b.onclick=()=>{const section=b.dataset.detail;if(section===detailSection)return;pushRoute({route:'detail',trackerId:currentTrackerId,section});});document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{const view=t.dataset.main;if(renderedRoute&&renderedRoute.route==='main'&&renderedRoute.view===view)return;pushRoute({route:'main',view});});
document.getElementById('permissionBtn').onclick=enableNotifications;document.getElementById('testNotifyBtn').onclick=notifyTest;
document.getElementById('themeSelect').onchange=e=>{state.settings||={};state.settings.theme=e.target.value;save();applyTheme()};
document.getElementById('exportDataBtn').onclick=exportData;document.getElementById('importDataBtn').onclick=()=>document.getElementById('importDataFile').click();document.getElementById('importDataFile').onchange=e=>{const f=e.target.files&&e.target.files[0];importDataFile(f);e.target.value=''};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if((state.settings?.theme||'system')==='system')applyTheme()});
applyTheme();setupNavigation();setTimeout(()=>{renderNotificationStatus();syncPushState().catch(()=>{})},1200);
