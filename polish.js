/* Personal Tracker UI polish patch — 5.5.2 */
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

  function reminderMetaText(r){
    const repeat=(typeof reminderRepeatLabel==='function'?reminderRepeatLabel(r):(r.repeat==='daily'?'כל יום':r.repeat==='weekly'?'כל שבוע':'חד־פעמית'));
    const base=r.repeat==='once'?`${fmtFullDate(r.date)}  |  ${r.time||''}`:`${repeat}  |  ${r.time||''}`;
    const snz=window.snoozeLabel(r.snoozedUntil);
    return `${r.notify?'🔔  ':''}${base}${snz?`  •  ${snz}`:''}`;
  }

  // Improve reminder date/time hierarchy everywhere reminder cards are rendered.
  if(typeof window.reminderCard==='function'){
    const originalReminderCard=window.reminderCard;
    window.reminderCard=function(r,completed=false){
      const el=originalReminderCard(r,completed);
      const meta=el?.querySelector('.task-meta');
      if(meta)meta.textContent=reminderMetaText(r);
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
          meta.textContent=snz?`${reminderRepeatLabel(r)} · ${r.time} · ${snz}`:`${reminderRepeatLabel(r)} · ${r.time}`;
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

  // Tools menu behaves like a normal popover: outside click, tab switch and Back all close it.
  const tools=document.getElementById('toolsMenu');
  const toolsBtn=document.getElementById('openToolsBtn');
  const closeTools=()=>tools?.classList.add('hidden');
  document.addEventListener('pointerdown',e=>{
    if(!tools||tools.classList.contains('hidden'))return;
    if(tools.contains(e.target)||toolsBtn?.contains(e.target))return;
    closeTools();
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
    .task-meta{line-height:1.55;letter-spacing:.01em}
    .reminder-card .task-meta{margin-top:7px;font-variant-numeric:tabular-nums}
    .snoozed-meta{color:var(--accent)!important;font-weight:750}
    #toolsMenu{z-index:70}
    .polish-relative-custom{margin-top:8px;padding-top:10px;border-top:1px solid var(--line)}
    #customRelativeToggleBtn{margin-top:6px}
    .quick-time{margin-bottom:10px}
    #todayView .today-group{margin-bottom:18px}
    #mainAttention .focus-item .task-meta{margin-top:5px}
  `;
  document.head.appendChild(css);

  // Re-render once so the polish applies immediately to an already-open screen.
  try{renderMain();}catch{}
})();
