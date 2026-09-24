/* Personal Tracker backup + recovery — 5.6.2 */
(()=>{
  'use strict';

  const LAST_BACKUP_KEY='personalTrackerLastExternalBackup_v1';
  const SNAPSHOTS_KEY='personalTrackerRecoverySnapshots_v1';
  const MAX_SNAPSHOTS=3;
  const DAY_MS=86400000;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const nowIso=()=>new Date().toISOString();
  const fileStamp=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const fmtDateTime=ms=>new Date(Number(ms)).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'});

  function buildPayload(){
    return {
      app:'personal-tracker',
      formatVersion:2,
      exportedAt:nowIso(),
      appStateVersion:Number(state?.version||0),
      state:clone(state),
      summary:{
        trackers:Array.isArray(state?.trackers)?state.trackers.length:0,
        reminders:Array.isArray(state?.reminders)?state.reminders.length:0,
        tasks:Array.isArray(state?.tasks)?state.tasks.length:0
      }
    };
  }

  function makeFile(){
    const payload=buildPayload();
    const text=JSON.stringify(payload,null,2);
    const name=`Personal-Tracker-backup-${fileStamp()}.json`;
    return {payload,text,name,file:new File([text],name,{type:'application/json'})};
  }

  function markExternalBackup(method){
    const rec={at:Date.now(),method};
    localStorage.setItem(LAST_BACKUP_KEY,JSON.stringify(rec));
    refreshBackupStatus();
  }

  function downloadBackup(){
    try{
      const {text,name}=makeFile();
      const blob=new Blob([text],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),800);
      markExternalBackup('download');
      toast('הגיבוי נשמר ✓');
    }catch(err){
      console.warn('backup download',err);
      toast('לא הצלחנו ליצור את הגיבוי');
    }
  }

  async function shareBackup(){
    try{
      const {file}=makeFile();
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({title:'גיבוי Personal Tracker',text:'קובץ גיבוי של Personal Tracker',files:[file]});
        markExternalBackup('share');
        toast('הגיבוי שותף ✓');
        return;
      }
      downloadBackup();
      toast('שיתוף קובץ אינו נתמך כאן — הגיבוי הורד למכשיר');
    }catch(err){
      if(err?.name==='AbortError')return;
      console.warn('backup share',err);
      downloadBackup();
    }
  }

  function validateBackup(parsed){
    const imported=parsed&&parsed.state?parsed.state:parsed;
    if(!imported||typeof imported!=='object'||!Array.isArray(imported.trackers))throw new Error('invalid-state');
    if(imported.reminders!=null&&!Array.isArray(imported.reminders))throw new Error('invalid-reminders');
    if(imported.tasks!=null&&!Array.isArray(imported.tasks))throw new Error('invalid-tasks');
    for(const tr of imported.trackers){
      if(!tr||typeof tr!=='object'||!Array.isArray(tr.stages))throw new Error('invalid-tracker');
    }
    const clean=clone(imported);
    clean.version=6;
    clean.trackers=clean.trackers||[];
    clean.reminders=clean.reminders||[];
    clean.tasks=clean.tasks||[];
    clean.settings=clean.settings&&typeof clean.settings==='object'?clean.settings:{theme:'system'};
    if(!clean.settings.theme)clean.settings.theme='system';
    return clean;
  }

  function readSnapshots(){
    try{
      const arr=JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)||'[]');
      return Array.isArray(arr)?arr:[];
    }catch{return[]}
  }

  function makeSnapshot(reason='automatic'){
    try{
      const snapshots=readSnapshots();
      snapshots.unshift({at:Date.now(),reason,state:clone(state)});
      localStorage.setItem(SNAPSHOTS_KEY,JSON.stringify(snapshots.slice(0,MAX_SNAPSHOTS)));
      refreshRecoveryButton();
      return true;
    }catch(err){
      console.warn('snapshot failed',err);
      return false;
    }
  }

  function ensureDailySnapshot(){
    const snapshots=readSnapshots();
    const latest=Number(snapshots[0]?.at||0);
    if(!latest||Date.now()-latest>=DAY_MS)makeSnapshot('daily');
  }

  async function importBackupFile(file){
    if(!file)return;
    try{
      const raw=await file.text();
      const parsed=JSON.parse(raw);
      const imported=validateBackup(parsed);
      const exportedAt=parsed?.exportedAt?new Date(parsed.exportedAt).toLocaleString('he-IL'):'לא ידוע';
      const counts=`${imported.trackers.length} מעקבים, ${imported.tasks.length} משימות, ${imported.reminders.length} תזכורות`;
      const ok=await showConfirm({
        title:'לשחזר מהגיבוי?',
        message:`נמצא גיבוי (${counts}). תאריך הגיבוי: ${exportedAt}. הנתונים הנוכחיים במכשיר יוחלפו, ולפני כן תישמר נקודת שחזור מקומית.`,
        confirmText:'שחזר גיבוי'
      });
      if(!ok)return;
      makeSnapshot('before-import');
      state=imported;
      localStorage.setItem(APP_KEY,JSON.stringify(state));
      try{await syncPushState({reason:'backup-import'})}catch{}
      toast('הגיבוי שוחזר ✓');
      setTimeout(()=>location.reload(),550);
    }catch(err){
      console.warn('backup import',err);
      toast('קובץ הגיבוי אינו תקין או אינו מתאים');
    }
  }

  async function restoreLatestSnapshot(){
    const snapshots=readSnapshots();
    const snap=snapshots[0];
    if(!snap){toast('אין כרגע נקודת שחזור מקומית');return}
    try{
      const restored=validateBackup(snap.state);
      const ok=await showConfirm({
        title:'לשחזר נקודה מקומית?',
        message:`נקודת השחזור האחרונה נשמרה ב־${fmtDateTime(snap.at)}. השחזור יחליף את הנתונים הנוכחיים.`,
        confirmText:'שחזר'
      });
      if(!ok)return;
      makeSnapshot('before-local-recovery');
      state=restored;
      localStorage.setItem(APP_KEY,JSON.stringify(state));
      try{await syncPushState({reason:'local-recovery'})}catch{}
      toast('נקודת השחזור הוחזרה ✓');
      setTimeout(()=>location.reload(),550);
    }catch{toast('נקודת השחזור המקומית אינה תקינה')}
  }

  function refreshBackupStatus(){
    const el=document.getElementById('backupLastStatus');
    if(!el)return;
    let rec=null;
    try{rec=JSON.parse(localStorage.getItem(LAST_BACKUP_KEY)||'null')}catch{}
    if(!rec?.at){
      el.innerHTML='<strong>גיבוי חיצוני:</strong> עדיין לא בוצע במכשיר הזה.';
      return;
    }
    const days=Math.floor((Date.now()-Number(rec.at))/DAY_MS);
    const age=days>=30?` · עברו ${days} ימים — מומלץ לגבות שוב`:'';
    el.innerHTML=`<strong>גיבוי חיצוני אחרון:</strong> ${fmtDateTime(rec.at)}${age}`;
  }

  function refreshRecoveryButton(){
    const btn=document.getElementById('restoreLocalSnapshotBtn');
    const note=document.getElementById('localSnapshotStatus');
    if(!btn||!note)return;
    const snaps=readSnapshots();
    btn.disabled=!snaps.length;
    if(snaps.length){
      note.textContent=`נקודת שחזור מקומית אחרונה: ${fmtDateTime(snaps[0].at)} · נשמרות עד ${MAX_SNAPSHOTS} נקודות במכשיר.`;
    }else{
      note.textContent='עדיין אין נקודת שחזור מקומית.';
    }
  }

  function enhanceBackupUi(){
    const exportBtn=document.getElementById('exportDataBtn');
    const importBtn=document.getElementById('importDataBtn');
    const input=document.getElementById('importDataFile');
    if(!exportBtn||!importBtn||!input)return;

    const card=exportBtn.closest('.card');
    if(!card)return;
    const intro=card.querySelector('.small');
    if(intro)intro.textContent='הנתונים נשמרים מקומית במכשיר. גיבוי חיצוני מאפשר לשחזר אותם גם אחרי החלפת מכשיר, ניקוי נתונים או התקנה מחדש.';

    exportBtn.textContent='הורד גיבוי';
    exportBtn.onclick=downloadBackup;
    importBtn.textContent='שחזר מגיבוי';
    importBtn.onclick=()=>input.click();
    input.onchange=e=>{const f=e.target.files?.[0];importBackupFile(f);e.target.value=''};

    let actions=exportBtn.closest('.actions');
    if(actions&&!document.getElementById('shareBackupBtn')){
      const share=document.createElement('button');
      share.id='shareBackupBtn';share.className='btn secondary';share.textContent='שתף גיבוי';share.onclick=shareBackup;
      actions.insertBefore(share,importBtn);
    }

    if(!document.getElementById('backupLastStatus')){
      const status=document.createElement('div');status.id='backupLastStatus';status.className='setting-note backup-status';
      actions?.insertAdjacentElement('afterend',status);
    }

    const existingNote=[...card.querySelectorAll('.setting-note')].find(x=>x.id!=='backupLastStatus');
    if(existingNote)existingNote.textContent='שחזור מגיבוי מחליף את הנתונים הקיימים. לפני כל שחזור נשמרת אוטומטית נקודת שחזור מקומית.';

    if(!document.getElementById('localRecoveryWrap')){
      const wrap=document.createElement('div');wrap.id='localRecoveryWrap';wrap.className='backup-recovery';
      wrap.innerHTML='<div class="backup-subtitle">רשת ביטחון מקומית</div><div id="localSnapshotStatus" class="small"></div><button class="btn ghost" id="restoreLocalSnapshotBtn">שחזור מקומי אחרון</button><div class="small backup-warning">נקודות שחזור מקומיות לא ישרדו הסרת אפליקציה או ניקוי נתונים — לכן הן אינן תחליף לגיבוי חיצוני.</div>';
      card.appendChild(wrap);
      wrap.querySelector('#restoreLocalSnapshotBtn').onclick=restoreLatestSnapshot;
    }

    refreshBackupStatus();refreshRecoveryButton();
  }

  const style=document.createElement('style');
  style.textContent=`
    #appSettingsView .backup-status{margin-top:12px}
    .backup-recovery{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
    .backup-subtitle{font-weight:850;margin-bottom:6px}
    .backup-recovery .btn{margin-top:10px}
    .backup-warning{margin-top:9px;color:var(--muted)}
    #shareBackupBtn{background:color-mix(in srgb,var(--accent) 11%,var(--card));color:var(--accent)}
    @media(max-width:430px){#appSettingsView .actions{display:grid;grid-template-columns:1fr 1fr}#appSettingsView .actions .btn{width:100%}#shareBackupBtn{grid-column:1/-1}}
  `;
  document.head.appendChild(style);

  ensureDailySnapshot();
  enhanceBackupUi();
  window.addEventListener('popstate',()=>setTimeout(enhanceBackupUi,0));
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>setTimeout(enhanceBackupUi,0)));
})();
