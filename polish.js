/* Personal Tracker UI polish patch — 5.5.3 */
(()=>{
  'use strict';

  const fmtFullDate=(dateStr)=>{
    if(!dateStr)return '';
    const d=typeof parseDate==='function'?parseDate(dateStr):new Date(dateStr);
    if(!(d instanceof Date)||Number.isNaN(d.getTime()))return dateStr;
    return d.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
  };
  const fmtClock=(ms)=>new Date(Number(ms)).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false});
  const fmtShortDate=(ms)=>new Date(Number(ms)).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});

  // Clearer snooze wording.
  window.snoozeLabel=function(ms){
    const n=Number(ms||0);if(!n||n<=Date.now())return '';
    const d=new Date(n),today=new Date();
    const same=d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate();
    return same?`נדחתה ל־${fmtClock(n)}`:`נדחתה ל־${fmtShortDate(n)} ${fmtClock(n)}`;
  };

  function reminderMetaHtml(r){
    const repeat=(typeof reminderRepeatLabel==='function'?reminderRepeatLabel(r):(r.repeat==='daily'?'כל יום':r.repeat==='weekly'?'כל שבוע':'חד־פעמית'));
    const datePart=r.repeat==='once'?fmtFullDate(r.date):repeat;
    const timePart=r.time||'';
    const snz=window.snoozeLabel(r.snoozedUntil);
    return `<span class="meta-main">${r.notify?'🔔 ':''}<span class="meta-date">${datePart}</span>${timePart?`<span class="meta-sep">•</span><span class="meta-time">${timePart}</span>`:''}</span>${snz?`<span class="snooze-pill">${snz}</span>`:''}`;
  }

  // Improve reminder date/time hierarchy everywhere reminder cards are rendered.
  if(typeof window.reminderCard==='function'){
    const originalReminderCard=window.reminderCard;
    window.reminderCard=function(r,completed=false){
      const el=originalReminderCard(r,completed);
      const meta=el?.querySelector('.task-meta');
      if(meta){meta.innerHTML=reminderMetaHtml(r);meta.classList.add('reminder-meta-polished');}
      return el;
    };
  }

  // Surface snooze state on the Home dashboard as well.
  if(typeof window.renderTodayDashboard==='function'){
    const originalToday=window.renderTodayDashboard;
    window.renderTodayDashboard=function(){
      originalToday();
      try{
        const reminders=(state.reminders||[]).filter(r=>r.status!=='completed'&&reminderDueToday(r)&&!reminderDoneToday(r));
        const cards=[...document.querySelectorAll('#mainAttention .focus-item.reminder-focus')];
        cards.forEach((card,i)=>{
          const r=reminders[i];if(!r)return;
          const meta=card.querySelector('.task-meta');if(!meta)return;
          const snz=window.snoozeLabel(r.snoozedUntil);
          meta.innerHTML=`<span class="meta-main"><span>${reminderRepeatLabel(r)}</span><span class="meta-sep">•</span><span class="meta-time">${r.time||''}</span></span>${snz?`<span class="snooze-pill">${snz}</span>`:''}`;
          meta.classList.toggle('snoozed-meta',!!snz);
        });
      }catch(err){console.warn('home snooze polish',err)}
    };
  }

  // Clear, useful feedback when an action from a system notification is synced back into the app.
  if(typeof window.applyNotificationActionLocally==='function'){
    const originalApply=window.applyNotificationActionLocally;
    window.applyNotificationActionLocally=function(a){
      const changed=originalApply(a);
      if(changed&&a){
        if(a.action==='done')toast('סומן כבוצע ✓');
        else if(a.action==='snooze'){
          const until=Number(a.snoozedUntil)||((Number(a.at)||Date.now())+3600000);
          toast(`נדחתה ל־${fmtClock(until)} ✓`);
        } else if(a.action==='cancel')toast('התזכורת בוטלה');
      }
      return changed;
    };
  }

  // Tools menu behaves like a normal popover: outside click, tab switch, navigation and Back all close it.
  const tools=document.getElementById('toolsMenu');
  const toolsBtn=document.getElementById('openToolsBtn');
  const closeTools=()=>tools?.classList.add('hidden');
  document.addEventListener('pointerdown',e=>{
    if(!tools||tools.classList.contains('hidden'))return;
    if(tools.contains(e.target)||toolsBtn?.contains(e.target))return;
    closeTools();
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest('.tab,[data-view],[data-route],a,button')&&!e.target.closest('#toolsMenu,#openToolsBtn'))closeTools();
  },true);
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',closeTools,true));
  window.addEventListener('popstate',closeTools);

  // Simplify the relative-time area without removing any capability.
  const customBtn=document.getElementById('customRelativeToggleBtn');
  if(customBtn){customBtn.textContent='זמן אחר';customBtn.setAttribute('aria-label','קביעת זמן יחסי אחר');}
  const relWrap=document.getElementById('relativeCustomWrap');
  if(relWrap)relWrap.classList.add('polish-relative-custom');

  const css=document.createElement('style');
  css.textContent=`
    .task-meta{line-height:1.5;letter-spacing:.01em}
    .reminder-card .task-meta{margin-top:7px;font-variant-numeric:tabular-nums}
    .reminder-meta-polished{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
    .meta-main{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .meta-sep{opacity:.55;font-size:.9em}
    .meta-date,.meta-time{font-variant-numeric:tabular-nums;white-space:nowrap}
    .snooze-pill{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-weight:800;font-size:.9em;white-space:nowrap}
    .snoozed-meta{color:inherit!important}
    #mainAttention .focus-item .task-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:5px}
    #toolsMenu{z-index:70}
    .polish-relative-custom{margin-top:8px;padding-top:10px;border-top:1px solid var(--line)}
    #customRelativeToggleBtn{margin-top:6px}
    .quick-time{margin-bottom:10px}
    #todayView .today-group{margin-bottom:18px}
  `;
  document.head.appendChild(css);

  // Re-render once so the polish applies immediately to an already-open screen.
  try{renderMain();}catch{}
})();
