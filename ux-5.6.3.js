/* Personal Tracker focused UX polish — 5.6.3 */
(()=>{
  'use strict';

  function polishAddMenu(){
    const task=document.getElementById('addNewTaskFromMain');
    const reminder=document.getElementById('addNewReminderFromMain');
    const tracker=document.getElementById('addNewTrackerFromMain');
    const modal=document.querySelector('#addMenuBackdrop .modal');
    if(!task||!reminder||!tracker||!modal)return;

    task.className='btn ghost block add-kind add-kind-task';
    reminder.className='btn ghost block add-kind add-kind-reminder';
    tracker.className='btn ghost block add-kind add-kind-tracker';
    task.innerHTML='<span class="add-kind-icon" aria-hidden="true">▣</span><span><strong>משימה</strong><small>דבר שצריך להשלים</small></span>';
    reminder.innerHTML='<span class="add-kind-icon" aria-hidden="true">🔔</span><span><strong>תזכורת</strong><small>משהו שצריך לקפוץ בזמן</small></span>';
    tracker.innerHTML='<span class="add-kind-icon" aria-hidden="true">◉</span><span><strong>מעקב</strong><small>תהליך שחוזר לאורך זמן</small></span>';
    [task,reminder,tracker].forEach(b=>b.classList.add('add-kind-ready'));
  }

  function humanDiagnosticsSummary(raw){
    const text=(raw||'').toLowerCase();
    const bad=/שגיאה|נכשל|failed|error|לא מחובר|מנותק/.test(text);
    if(bad)return {cls:'diag-bad',title:'נמצאה בעיה בחיבור להתראות',body:'כדאי לנסות שוב בעוד רגע. אם הבעיה חוזרת, הפרטים הטכניים למטה יעזרו לנו לבדוק אותה.'};
    const waiting=(raw||'').match(/פעולות ממתינות[:\s]*([0-9]+)/i)?.[1];
    const due=(raw||'').match(/דחיות בתור[:\s]*([0-9]+)/i)?.[1];
    return {cls:'diag-good',title:'ההתראות מחוברות ונראות תקינות ✓',body:`${waiting!=null?`פעולות שממתינות לסנכרון: ${waiting}. `:''}${due!=null?`דחיות שממתינות: ${due}.`:''}`.trim()||'החיבור לשירות ההתראות פעיל.'};
  }

  function beautifyDiagnostics(){
    const box=document.getElementById('diagnosticsBox');
    if(!box||box.classList.contains('hidden'))return;
    if(box.dataset.friendly==='1')return;
    const raw=box.innerText.trim();
    if(!raw)return;
    const summary=humanDiagnosticsSummary(raw);
    box.innerHTML=`<div class="diag-summary ${summary.cls}"><strong>${summary.title}</strong><div>${summary.body}</div></div><details class="diag-details"><summary>פרטים טכניים</summary><pre></pre></details>`;
    box.querySelector('pre').textContent=raw;
    box.dataset.friendly='1';
  }

  function polishDiagnostics(){
    const btn=document.getElementById('diagnosticsBtn');
    const box=document.getElementById('diagnosticsBox');
    if(!btn||!box||btn.dataset.friendlyReady)return;
    btn.textContent='בדיקת תקינות ההתראות';
    btn.dataset.friendlyReady='1';

    btn.addEventListener('click',e=>{
      if(!box.classList.contains('hidden')&&box.dataset.friendly==='1'){
        e.preventDefault();e.stopImmediatePropagation();
        box.classList.add('hidden');
        box.dataset.friendly='0';
        box.innerHTML='';
        return;
      }
      box.dataset.friendly='0';
      setTimeout(beautifyDiagnostics,80);
      setTimeout(beautifyDiagnostics,350);
      setTimeout(beautifyDiagnostics,900);
    },true);
  }

  function polishBackupCopy(){
    const restore=document.getElementById('importDataBtn');
    const exportBtn=document.getElementById('exportDataBtn');
    const share=document.getElementById('shareBackupBtn');
    const status=document.getElementById('backupLastStatus');
    const localTitle=document.querySelector('#localRecoveryWrap .backup-subtitle');
    const localNote=document.querySelector('#localRecoveryWrap .backup-warning');
    if(exportBtn)exportBtn.textContent='הורד גיבוי';
    if(share)share.textContent='שתף גיבוי';
    if(restore)restore.textContent='שחזר מגיבוי';
    if(status&&!status.dataset.copyPolished){
      const txt=status.textContent.trim();
      if(/עדיין לא/.test(txt))status.innerHTML='<strong>גיבוי חיצוני:</strong> עדיין לא בוצע.';
      status.dataset.copyPolished='1';
    }
    if(localTitle)localTitle.textContent='רשת ביטחון במכשיר';
    if(localNote)localNote.textContent='נקודות השחזור נשמרות רק במכשיר הזה. הן לא יישמרו אם האפליקציה תוסר או שהנתונים יימחקו, ולכן מומלץ לשמור גם גיבוי חיצוני.';
  }

  const css=document.createElement('style');
  css.textContent=`
    #addMenuBackdrop .modal{max-width:480px}
    #addMenuBackdrop .section-actions{display:grid;grid-template-columns:1fr;gap:10px}
    #addMenuBackdrop .add-kind{margin:0!important;width:100%;display:flex;align-items:center;gap:13px;text-align:right;padding:14px 15px;background:var(--surface);color:var(--text);border:1px solid var(--line);box-shadow:none}
    #addMenuBackdrop .add-kind:active{background:color-mix(in srgb,var(--accent) 7%,var(--surface));border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
    #addMenuBackdrop .add-kind-icon{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 9%,var(--card));color:var(--accent);font-size:19px}
    #addMenuBackdrop .add-kind strong{display:block;font-size:16px;color:var(--text)}
    #addMenuBackdrop .add-kind small{display:block;margin-top:3px;font-size:12px;font-weight:500;color:var(--muted)}
    #addMenuBackdrop .modal-actions{margin-top:13px}

    #diagnosticsBtn{min-width:150px}
    #diagnosticsBox{padding:0;background:transparent}
    .diag-summary{padding:12px 13px;border-radius:14px;background:var(--surface);border:1px solid var(--line);line-height:1.5}
    .diag-summary strong{display:block;color:var(--text);margin-bottom:4px}
    .diag-summary div{font-size:12px;color:var(--muted)}
    .diag-summary.diag-good{border-color:color-mix(in srgb,var(--ok) 35%,var(--line));background:color-mix(in srgb,var(--ok) 7%,var(--card))}
    .diag-summary.diag-bad{border-color:color-mix(in srgb,var(--danger) 38%,var(--line));background:color-mix(in srgb,var(--danger) 7%,var(--card))}
    .diag-details{margin-top:9px;padding:9px 11px;border:1px solid var(--line);border-radius:13px;background:var(--surface)}
    .diag-details summary{cursor:pointer;font-size:12px;font-weight:800;color:var(--muted)}
    .diag-details pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;line-height:1.55;color:var(--muted);direction:ltr;text-align:left;margin:10px 0 0}

    #appSettingsView .backup-recovery{margin-top:18px;padding-top:18px}
    #appSettingsView .backup-subtitle{font-size:16px}
    #appSettingsView .backup-status strong{color:var(--text)}
  `;
  document.head.appendChild(css);

  const refresh=()=>{polishAddMenu();polishDiagnostics();polishBackupCopy();};
  refresh();
  setTimeout(refresh,250);
  setTimeout(refresh,900);
  document.addEventListener('click',e=>{
    if(e.target.closest('#openToolsBtn,#toolsSettingsBtn,.tab'))setTimeout(refresh,60);
  });
  window.addEventListener('popstate',()=>setTimeout(refresh,60));
})();
