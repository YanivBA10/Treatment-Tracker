/* Personal Tracker — reminders UX + lifecycle polish 5.6.17 */
(()=>{
  'use strict';

  const RECENT_COMPLETED_LIMIT=5;

  function shortDate(dateStr){
    if(!dateStr)return '';
    const p=String(dateStr).split('-').map(Number);
    if(p.length!==3||p.some(Number.isNaN))return dateStr;
    return `${String(p[2]).padStart(2,'0')}.${String(p[1]).padStart(2,'0')}.${String(p[0]).slice(-2)}`;
  }

  function formatCompletedAt(ts){
    if(!ts)return '';
    const d=new Date(Number(ts));
    if(Number.isNaN(d.getTime()))return '';
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function reminderWhen(r){
    if(r.repeat==='daily')return `כל יום · ${r.time||''}`;
    if(r.repeat==='weekly')return `כל שבוע · ${r.time||''}`;
    return `${shortDate(r.date)}${r.time?` · ${r.time}`:''}`;
  }

  function ensureViews(){
    const app=document.querySelector('.app');
    if(!app)return;

    if(!document.getElementById('reminderDetailView')){
      const detail=document.createElement('main');
      detail.id='reminderDetailView';
      detail.className='hidden';
      detail.innerHTML=`
        <div class="card reminder-detail-card">
          <div class="reminder-detail-state" id="reminderDetailState"></div>
          <div class="tracker-name" id="reminderDetailTitle"></div>
          <div class="reminder-description hidden" id="reminderDetailDescription"></div>
          <div class="reminder-detail-meta" id="reminderDetailWhen"></div>
          <div class="reminder-detail-meta hidden" id="reminderDetailRepeat"></div>
          <div class="reminder-detail-meta hidden" id="reminderDetailSnooze"></div>
          <div class="reminder-detail-meta hidden" id="reminderDetailCompletedAt"></div>
        </div>
        <div class="card">
          <div class="section-title">פעולות</div>
          <div class="reminder-detail-actions" id="reminderDetailActions"></div>
        </div>`;
      app.appendChild(detail);
    }

    if(!document.getElementById('completedRemindersView')){
      const all=document.createElement('main');
      all.id='completedRemindersView';
      all.className='hidden';
      all.innerHTML=`
        <div class="card">
          <div class="section-title">תזכורות שהושלמו</div>
          <div class="small completed-reminders-note">התזכורות האחרונות שהשלמת, מהחדשה לישנה.</div>
          <div id="allCompletedReminders"></div>
        </div>`;
      app.appendChild(all);
    }
  }

  function setHeader(title,subtitle){
    const t=document.getElementById('appTitle'),s=document.getElementById('appSubtitle');
    if(t)t.textContent=title;
    if(s)s.textContent=subtitle;
  }

  const directOpenReminderEditor=typeof window.openReminderEditor==='function'?window.openReminderEditor:null;

  function openReminderDetail(id){
    if(typeof pushRoute==='function')pushRoute({route:'reminderDetail',reminderId:id});
  }
  window.openReminderDetail=openReminderDetail;

  // Existing dashboard code opens a reminder by calling openReminderEditor(id).
  // Keep creation (no id) opening the editor, but route existing reminders to details.
  if(directOpenReminderEditor){
    window.openReminderEditor=function(id=null){
      if(id)return openReminderDetail(id);
      return directOpenReminderEditor(id);
    };
  }

  function reopenReminder(r){
    r.status='active';
    r.completedAt=null;
    if(r.doneDates&&r.date)delete r.doneDates[r.date];
    save();
    renderMain();
    renderReminderDetailRoute(r.id);
    toast('התזכורת נפתחה מחדש');
  }

  async function deleteReminderFromDetail(r){
    const ok=await showConfirm({
      title:'למחוק את התזכורת?',
      message:`"${r.title}" תימחק לצמיתות.`,
      confirmText:'מחק לצמיתות',
      danger:true
    });
    if(!ok)return;
    state.reminders=(state.reminders||[]).filter(x=>x.id!==r.id);
    save();
    renderMain();
    replaceRoute({route:'main',view:'remindersView'});
    toast('התזכורת נמחקה');
  }

  function renderReminderDetailRoute(id){
    ensureViews();
    const r=(state.reminders||[]).find(x=>x.id===id);
    if(!r){replaceRoute({route:'main',view:'remindersView'});return;}
    showOnly('reminderDetailView');
    document.getElementById('bottomTabs')?.classList.add('hidden');
    setHeader('תזכורות','פרטי תזכורת');

    const completed=r.status==='completed';
    const doneToday=!completed&&r.repeat!=='once'&&typeof reminderDoneToday==='function'&&reminderDoneToday(r);
    const stateEl=document.getElementById('reminderDetailState');
    stateEl.textContent=completed?'הושלמה':doneToday?'הושלמה להיום':'פעילה';
    stateEl.className='reminder-detail-state '+(completed||doneToday?'done':'active');

    document.getElementById('reminderDetailTitle').textContent=r.title||'';
    const desc=document.getElementById('reminderDetailDescription');
    desc.textContent=r.description||'';
    desc.classList.toggle('hidden',!r.description);

    document.getElementById('reminderDetailWhen').textContent=`מועד: ${r.repeat&&r.repeat!=='once'?(r.time||''):reminderWhen(r)}`;

    const repeat=document.getElementById('reminderDetailRepeat');
    if(r.repeat&&r.repeat!=='once'){
      repeat.textContent=`חזרה: ${r.repeat==='daily'?'כל יום':'כל שבוע'}${r.date?` · החל מ־${shortDate(r.date)}`:''}`;
      repeat.classList.remove('hidden');
    }else repeat.classList.add('hidden');

    const snooze=document.getElementById('reminderDetailSnooze');
    const snz=typeof snoozeLabel==='function'?snoozeLabel(r.snoozedUntil):'';
    snooze.textContent=snz||'';
    snooze.classList.toggle('hidden',!snz);

    const completedAt=document.getElementById('reminderDetailCompletedAt');
    const completedText=completed&&r.completedAt?formatCompletedAt(r.completedAt):'';
    completedAt.textContent=completedText?`הושלמה: ${completedText}`:'';
    completedAt.classList.toggle('hidden',!completedText);

    const actions=document.getElementById('reminderDetailActions');
    actions.innerHTML='';
    if(completed){
      const reopen=document.createElement('button');
      reopen.className='btn secondary';
      reopen.textContent='פתח מחדש';
      reopen.onclick=()=>reopenReminder(r);
      const del=document.createElement('button');
      del.className='btn danger';
      del.textContent='מחק';
      del.onclick=()=>deleteReminderFromDetail(r);
      actions.append(reopen,del);
    }else{
      const edit=document.createElement('button');
      edit.className='btn secondary';
      edit.textContent='ערוך';
      edit.onclick=()=>directOpenReminderEditor?.(r.id);
      const done=document.createElement('button');
      const undoToday=doneToday&&r.repeat!=='once';
      done.className=undoToday?'btn secondary':'btn';
      done.textContent=r.repeat==='once'?'סמן כהושלמה':(undoToday?'בטל השלמה להיום':'סמן כהושלמה להיום');
      done.onclick=async()=>{await completeReminder(r); if((state.reminders||[]).some(x=>x.id===r.id))renderReminderDetailRoute(r.id);};
      actions.append(edit,done);
    }
  }
  window.renderReminderDetailRoute=renderReminderDetailRoute;

  function renderAllCompletedReminders(){
    ensureViews();
    showOnly('completedRemindersView');
    document.getElementById('bottomTabs')?.classList.add('hidden');
    setHeader('תזכורות','היסטוריית תזכורות');
    const host=document.getElementById('allCompletedReminders');
    host.innerHTML='';
    const arr=(state.reminders||[]).filter(r=>r.status==='completed').sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    if(!arr.length){
      host.innerHTML='<div class="empty">אין תזכורות שהושלמו.</div>';
      return;
    }
    arr.forEach(r=>host.appendChild(reminderCard(r,true)));
  }

  function openAllCompletedReminders(){
    if(typeof pushRoute==='function')pushRoute({route:'completedReminders'});
  }
  window.openAllCompletedReminders=openAllCompletedReminders;

  if(typeof window.applyRoute==='function'){
    const originalApplyRoute=window.applyRoute;
    window.applyRoute=function(r){
      if(r?.route==='reminderDetail'){renderReminderDetailRoute(r.reminderId);return;}
      if(r?.route==='completedReminders'){renderAllCompletedReminders();return;}
      originalApplyRoute(r);
    };
  }

  if(typeof window.reminderCard==='function'){
    window.reminderCard=function(r,completed=false){
      const el=document.createElement('div');
      const overdue=!completed&&(r.repeat||'once')==='once'&&r.date&&r.date<todayStr();
      el.className='reminder-card'+(completed?' completed':'')+(overdue?' overdue':'');
      const doneToday=typeof reminderDoneToday==='function'&&reminderDoneToday(r);
      const when=reminderWhen(r);
      const snz=typeof snoozeLabel==='function'?snoozeLabel(r.snoozedUntil):'';
      el.innerHTML=`<div class="reminder-main"><div class="grow"><div class="reminder-title-line"><div class="tracker-name">${esc(r.title)}</div>${overdue?'<span class="reminder-overdue-chip">באיחור</span>':''}</div>${r.description?`<div class="reminder-description">${esc(r.description)}</div>`:''}<div class="task-meta reminder-time-row"><span>${esc(when)}</span>${snz?`<span class="reminder-snooze-chip">${esc(snz)}</span>`:''}</div></div>${completed?'<span class="badge ok">הושלם</span>':`<button class="check reminder-check" aria-label="סימון בוצע">${doneToday?'✓':''}</button>`}</div>`;
      if(!completed){
        el.querySelector('.reminder-check').onclick=e=>{e.stopPropagation();completeReminder(r)};
      }
      el.onclick=()=>openReminderDetail(r.id);
      return el;
    };
  }

  function trimCompletedList(){
    const host=document.getElementById('completedReminders');
    if(!host)return;
    const arr=(state.reminders||[]).filter(r=>r.status==='completed').sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    host.innerHTML='';
    if(!arr.length){
      host.innerHTML='<div class="empty compact">אין תזכורות שהושלמו.</div>';
      return;
    }
    arr.slice(0,RECENT_COMPLETED_LIMIT).forEach(r=>host.appendChild(reminderCard(r,true)));
    if(arr.length>RECENT_COMPLETED_LIMIT){
      const btn=document.createElement('button');
      btn.className='btn ghost block completed-reminders-more';
      btn.textContent=`הצג את כל ההושלמו (${arr.length})`;
      btn.onclick=openAllCompletedReminders;
      host.appendChild(btn);
    }
  }

  if(typeof window.renderMain==='function'){
    const originalRenderMain=window.renderMain;
    window.renderMain=function(){
      originalRenderMain();
      trimCompletedList();
    };
  }

  function polishReminderEditor(){
    const view=document.getElementById('reminderEditorView');
    if(!view||view.classList.contains('hidden'))return;
    const date=document.getElementById('reminderDate');
    const dateLabel=date?.parentElement?.querySelector('label');
    if(dateLabel)dateLabel.textContent='תאריך';

    const notify=document.getElementById('reminderNotify');
    if(notify){
      notify.checked=true;
      const row=notify.closest('.switchline');
      if(row)row.classList.add('reminder-notify-hidden');
    }
  }

  if(typeof window.renderReminderEditorRoute==='function'){
    const originalEditor=window.renderReminderEditorRoute;
    window.renderReminderEditorRoute=function(id=null){
      originalEditor(id);
      setHeader('תזכורות','דברים שחשוב לזכור בזמן');
      polishReminderEditor();
    };
  }

  if(typeof window.saveReminderEditor==='function'){
    const originalSave=window.saveReminderEditor;
    window.saveReminderEditor=function(){
      const notify=document.getElementById('reminderNotify');
      if(notify)notify.checked=true;
      return originalSave();
    };
  }

  const css=document.createElement('style');
  css.textContent=`
    .reminder-notify-hidden{display:none!important}
    .reminder-time-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px;direction:rtl}
    .reminder-time-row>span:first-child{unicode-bidi:plaintext}
    .reminder-snooze-chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 9%,var(--card));color:var(--accent);font-size:11px;font-weight:800}
    .reminder-title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .reminder-overdue-chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:color-mix(in srgb,var(--danger) 10%,var(--card));color:var(--danger);font-size:11px;font-weight:850}
    .reminder-card.overdue{border-color:color-mix(in srgb,var(--danger) 34%,var(--line))}
    .completed-reminders-more{margin-top:12px!important}
    .completed-reminders-note{margin-bottom:12px}
    .reminder-detail-state{display:inline-flex;width:max-content;padding:5px 9px;border-radius:999px;margin-bottom:10px;font-size:12px;font-weight:800}
    .reminder-detail-state.active{background:var(--soft);color:var(--accent)}
    .reminder-detail-state.done{background:color-mix(in srgb,var(--ok) 12%,var(--card));color:var(--ok)}
    .reminder-detail-card .tracker-name{font-size:22px;margin-bottom:7px}
    .reminder-detail-meta{font-size:13px;color:var(--muted);margin-top:8px;line-height:1.5}
    .reminder-detail-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .reminder-detail-actions .btn{width:100%;min-height:48px}
    @media(max-width:420px){.reminder-detail-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  ensureViews();
  polishReminderEditor();
  try{if(typeof renderMain==='function')renderMain();}catch{}
})();