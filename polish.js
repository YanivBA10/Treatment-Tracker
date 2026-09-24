/* Personal Tracker visual + UX polish — 5.6.34 */
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

  if(typeof window.reminderCard==='function'){
    const originalReminderCard=window.reminderCard;
    window.reminderCard=function(r,completed=false){
      const el=originalReminderCard(r,completed);
      const meta=el?.querySelector('.task-meta');
      if(meta){meta.innerHTML=reminderMetaHtml(r);meta.classList.add('reminder-meta-polished');}
      return el;
    };
  }

  function enhanceHomeCards(){
    document.querySelectorAll('#mainAttention .focus-item,#mainLater .focus-item').forEach(card=>{
      const dot=card.querySelector('.focus-dot');
      if(dot){
        let label='פריט';
        if(card.classList.contains('tracker-focus'))label='מעקב';
        else if(card.classList.contains('reminder-focus'))label='תזכורת';
        else if(card.classList.contains('task-focus'))label='משימה';
        dot.textContent=label;
        dot.classList.add('type-chip');
        dot.setAttribute('aria-label',label);
      }
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      if(!card.dataset.keyboardReady){
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});
        card.dataset.keyboardReady='1';
      }
    });

    document.querySelectorAll('#mainActive .work-task').forEach(card=>{
      card.classList.add('home-work-task');
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
    });
  }

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
        enhanceHomeCards();
      }catch(err){console.warn('home polish',err)}
    };
  }

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

  const header=document.querySelector('.app > header');
  const appMark=document.querySelector('.appmark');
  if(appMark){
    appMark.innerHTML='<img src="icon.svg" alt="" aria-hidden="true">';
    appMark.classList.add('appmark-image');
  }
  if(header&&!header.querySelector('.header-brand')){
    const titleBlock=header.firstElementChild;
    const actionRow=header.querySelector(':scope > .row');
    if(titleBlock&&actionRow&&appMark){
      const brand=document.createElement('div');
      brand.className='header-brand';
      brand.appendChild(appMark);
      brand.appendChild(titleBlock);
      header.insertBefore(brand,actionRow);
    }
  }

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

  if(tools&&!document.getElementById('toolsShareBtn')){
    const shareBtn=document.createElement('button');
    shareBtn.id='toolsShareBtn';
    shareBtn.textContent='↗ שיתוף האפליקציה';
    shareBtn.onclick=async()=>{
      closeTools();
      const url='https://personal-tracker-app.pages.dev/';
      try{
        if(navigator.share){
          await navigator.share({title:'Personal Tracker',text:'אפליקציה לניהול מעקבים, משימות ותזכורות אישיות במקום אחד.',url});
        }else if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(url);toast('הקישור הועתק ✓');
        }else prompt('העתק את הקישור:',url);
      }catch(err){if(err?.name!=='AbortError')toast('לא ניתן היה לשתף כרגע');}
    };
    tools.appendChild(shareBtn);
  }

  if(tools&&!document.getElementById('headerQuickActions')){
    const wrap=document.createElement('div');
    wrap.id='headerQuickActions';
    wrap.className='header-quick-actions';
    // One optical icon family: 24px viewBox, round caps/joins and the same
    // stroke weight. Keeping the SVGs structurally consistent prevents one
    // action (notably Settings) from looking heavier or vertically misaligned.
    const icon=(kind)=>{
      if(kind==='settings')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      if(kind==='archive')return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3" width="19" height="5" rx="1.5"></rect><path d="M4.5 8v10.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V8"></path><path d="M9.5 12h5"></path></svg>';
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"></path></svg>';
    };
    [
      ['headerSettingsBtn','settings','הגדרות',()=>document.getElementById('toolsSettingsBtn')?.click()],
      ['headerArchiveBtn','archive','ארכיון',()=>document.getElementById('toolsArchiveBtn')?.click()],
      ['headerShareBtn','share','שיתוף האפליקציה',()=>document.getElementById('toolsShareBtn')?.click()]
    ].forEach(([id,kind,label,fn])=>{
      const b=document.createElement('button');
      b.type='button';b.id=id;b.className='header-quick-action';b.setAttribute('aria-label',label);b.title=label;
      b.innerHTML=icon(kind);b.onclick=fn;wrap.appendChild(b);
    });
    tools.prepend(wrap);
    toolsBtn?.classList.add('quick-actions-replaced');
    tools.classList.add('quick-actions-mode');
  }

  const customBtn=document.getElementById('customRelativeToggleBtn');
  if(customBtn){customBtn.textContent='זמן אחר';customBtn.setAttribute('aria-label','קביעת זמן יחסי אחר');}
  const relWrap=document.getElementById('relativeCustomWrap');
  if(relWrap)relWrap.classList.add('polish-relative-custom');

  // Keep the primary save action one tap away in long editors.
  // Destructive actions stay in the form body so they are deliberate, not persistent.
  const editorSaveMap={
    editorView:{buttonId:'saveTrackerBtn',label:'שמור מעקב'},
    reminderEditorView:{buttonId:'saveReminderBtn',label:'שמור תזכורת'},
    taskEditorView:{buttonId:'saveTaskBtn',label:'שמור משימה'}
  };

  function ensureStickyEditorSave(){
    let dock=document.getElementById('editorStickySaveDock');
    if(!dock){
      dock=document.createElement('div');
      dock.id='editorStickySaveDock';
      dock.className='editor-sticky-save hidden';
      dock.innerHTML='<button type="button" class="btn block" id="editorStickySaveBtn"></button>';
      document.body.appendChild(dock);
      dock.querySelector('button').onclick=()=>{
        const targetId=dock.dataset.target;
        if(targetId)document.getElementById(targetId)?.click();
      };
    }
    return dock;
  }

  function syncStickyEditorSave(){
    const dock=ensureStickyEditorSave();
    const visible=Object.keys(editorSaveMap).find(id=>{
      const el=document.getElementById(id);
      return el&&!el.classList.contains('hidden');
    });
    if(!visible){
      dock.classList.add('hidden');
      dock.dataset.target='';
      return;
    }
    const cfg=editorSaveMap[visible];
    dock.dataset.target=cfg.buttonId;
    dock.querySelector('button').textContent=cfg.label;
    dock.classList.remove('hidden');
  }

  // showOnly is the central view switcher; wrap it once here and also observe
  // class changes as a safety net for later UX layers.
  if(typeof window.showOnly==='function'){
    const stickyOriginalShowOnly=window.showOnly;
    window.showOnly=function(id){
      stickyOriginalShowOnly(id);
      requestAnimationFrame(syncStickyEditorSave);
    };
  }
  const editorVisibilityObserver=new MutationObserver(syncStickyEditorSave);
  ['editorView','reminderEditorView','taskEditorView'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)editorVisibilityObserver.observe(el,{attributes:true,attributeFilter:['class']});
  });
  syncStickyEditorSave();

  const css=document.createElement('style');
  css.textContent=`
    :root{--muted:#596579;--home-card-radius:26px}
    html[data-theme="dark"]{--muted:#b1bac9}
    body{background:radial-gradient(circle at 82% -8%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 34%),var(--bg)}
    .app{padding-inline:18px}

    /* Header — slightly calmer than 5.6.0 */
    .app>header{direction:rtl;align-items:flex-start;margin-bottom:30px;padding-top:7px;gap:16px}
    .header-brand{display:flex;align-items:center;gap:11px;min-width:0}
    .header-brand .title{font-size:31px;line-height:1.05;letter-spacing:-.7px}
    .header-brand .subtitle{font-size:14px;color:var(--muted);margin-top:7px}
    .appmark.appmark-image{width:40px;height:40px;flex:0 0 40px;padding:0;overflow:hidden;background:transparent;border-radius:13px;box-shadow:0 7px 18px rgba(53,105,232,.14)}
    .appmark.appmark-image img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}

    .tools-wrap{display:flex;align-items:center}
    .quick-actions-replaced{display:none!important}
    .tools-menu.quick-actions-mode{position:static;display:block!important;min-width:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
    .tools-menu.quick-actions-mode>button{display:none!important}
    .header-quick-actions{display:flex;align-items:center;gap:0;direction:rtl;padding:3px;border:1px solid var(--line);border-radius:14px;background:color-mix(in srgb,var(--card) 92%,transparent);box-shadow:0 5px 16px rgba(31,45,72,.06);overflow:hidden}
    .header-quick-action{width:40px;height:38px;flex:0 0 40px;border:0;border-radius:10px;background:transparent;color:var(--text);display:grid;place-items:center;padding:0;position:relative;line-height:0}
    .header-quick-action+.header-quick-action:before{content:"";position:absolute;inset-inline-start:-1px;top:9px;bottom:9px;width:1px;background:var(--line)}
    .header-quick-action:active{background:var(--surface);transform:translateY(1px)}
    .header-quick-action:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:-2px}
    .header-quick-action svg{display:block;width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    .app>header>.row{direction:rtl;flex:0 0 auto}
    .tools-btn{width:38px;height:38px;border-radius:13px;background:color-mix(in srgb,var(--card) 96%,transparent);box-shadow:var(--shadow-soft);font-size:18px}
    #toolsMenu{z-index:70;min-width:190px;padding:8px;border-radius:18px;box-shadow:0 18px 46px rgba(25,43,72,.16)}
    #toolsMenu button{font-weight:700;padding:12px 11px;border-radius:11px}

    /* Home hierarchy */
    #todayView{padding-bottom:26px}
    #todayView .main-section{margin-bottom:29px}
    #todayView .main-section-head{display:block;margin:0 4px 11px;text-align:right}
    #todayView .main-section-title{font-size:22px;font-weight:900;letter-spacing:-.35px;line-height:1.2}
    #todayView .main-section-note{font-size:13px;color:var(--muted);margin-top:5px;line-height:1.45}
    #todayView .focus-list{border-radius:var(--home-card-radius);padding:4px 17px;background:var(--card);border:1px solid color-mix(in srgb,var(--line) 72%,transparent);box-shadow:0 10px 30px rgba(28,48,80,.075);overflow:hidden}
    #todayView .focus-item{min-height:88px;padding:16px 1px;gap:12px;border-bottom-color:color-mix(in srgb,var(--line) 78%,transparent);transition:background .16s,transform .12s}
    #todayView .focus-item:active{transform:scale(.994);background:color-mix(in srgb,var(--accent) 4%,transparent)}
    #todayView .focus-title{font-size:19px;font-weight:850;letter-spacing:-.15px}
    #todayView .focus-item .task-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:5px;color:var(--muted);font-size:13px;line-height:1.45}

    /* Quieter affordances */
    #todayView .focus-arrow{width:24px;height:32px;border-radius:0;display:grid;place-items:center;background:transparent;font-size:22px;color:#687589;flex:0 0 24px;opacity:.86}
    #todayView .focus-dot.type-chip{width:auto;height:auto;border-radius:999px;padding:4px 7px;font-size:9.5px;font-weight:850;line-height:1;background:var(--soft);color:var(--accent);white-space:nowrap;flex:0 0 auto}
    #todayView .tracker-focus .focus-dot.type-chip{background:color-mix(in srgb,var(--ok) 10%,var(--card));color:var(--ok)}
    #todayView .reminder-focus .focus-dot.type-chip{background:color-mix(in srgb,#db8b2d 11%,var(--card));color:#9b5b09}
    #todayView .task-focus .focus-dot.type-chip{background:color-mix(in srgb,#8065cb 11%,var(--card));color:#6848b6}

    /* Active task card */
    #mainActive .work-task{border-radius:24px;background:var(--card);padding:17px 18px;margin:0;border:1px solid color-mix(in srgb,var(--line) 72%,transparent);box-shadow:0 9px 28px rgba(28,48,80,.065);transition:transform .12s}
    #mainActive .work-task:active{transform:scale(.994)}
    #mainActive .tracker-name{font-size:19px;font-weight:850}
    #mainActive .task-meta{font-size:12.5px;color:var(--muted);line-height:1.65;margin-top:6px;max-width:360px}
    #mainActive .check{width:39px;height:39px;border-radius:13px;border-width:2px;flex:0 0 39px}

    /* Empty states */
    #mainLater{margin-bottom:42px}
    #mainLater .empty,#mainAttention .empty,#mainActive .empty{font-size:14px;color:var(--muted);padding:25px 10px;line-height:1.55}
    #mainLater .empty:before{content:'◷';display:block;margin:0 auto 8px;font-size:25px;color:color-mix(in srgb,var(--accent) 45%,var(--muted))}

    /* FAB and nav */
    .main-add{width:56px;height:56px;border-radius:18px;font-size:30px;bottom:calc(112px + env(safe-area-inset-bottom));left:max(24px,calc((100vw - 600px)/2 + 24px));box-shadow:0 14px 30px rgba(53,105,232,.27)}
    .tabs{border-top-color:color-mix(in srgb,var(--line) 72%,transparent);box-shadow:0 -10px 32px rgba(25,43,72,.06)}
    .tab{padding-top:11px;color:#687589}
    .tab span{width:39px;height:32px;border-radius:13px;font-size:19px}
    .tab.active{color:var(--accent)}
    .tab.active span{background:color-mix(in srgb,var(--accent) 10%,var(--card))}

    /* Reminder metadata */
    .task-meta{line-height:1.5;letter-spacing:.01em}
    .reminder-card .task-meta{margin-top:7px;font-variant-numeric:tabular-nums}
    .reminder-meta-polished{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
    .meta-main{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .meta-sep{opacity:.55;font-size:.9em}
    .meta-date,.meta-time{font-variant-numeric:tabular-nums;white-space:nowrap}
    .snooze-pill{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-weight:800;font-size:.88em;white-space:nowrap}
    .snoozed-meta{color:inherit!important}

    .polish-relative-custom{margin-top:8px;padding-top:10px;border-top:1px solid var(--line)}
    #customRelativeToggleBtn{margin-top:6px}
    .quick-time{margin-bottom:10px}

    /* Long editor actions */
    #editorView #saveTrackerBtn,
    #reminderEditorView #saveReminderBtn,
    #taskEditorView #saveTaskBtn{display:none!important}
    #editorView .card,
    #reminderEditorView .card,
    #taskEditorView .card{padding-bottom:calc(104px + env(safe-area-inset-bottom))}
    .editor-sticky-save{
      position:fixed;
      z-index:85;
      inset-inline:50% auto;
      transform:translateX(50%);
      bottom:calc(12px + env(safe-area-inset-bottom));
      width:min(calc(100vw - 28px),588px);
      padding:7px;
      border:1px solid color-mix(in srgb,var(--line) 82%,transparent);
      border-radius:18px;
      background:color-mix(in srgb,var(--card) 90%,transparent);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      box-shadow:0 12px 34px rgba(25,43,72,.16)
    }
    .editor-sticky-save .btn{
      margin:0!important;
      min-height:52px;
      border-radius:14px;
      font-size:17px;
      box-shadow:0 8px 22px rgba(53,105,232,.18)
    }

    @media(max-width:480px){
      .app{padding-inline:14px}
      .app>header{margin-bottom:25px}
      .header-brand{gap:9px}
      .header-brand .title{font-size:29px}
      .appmark.appmark-image{width:37px;height:37px;flex-basis:37px;border-radius:12px}
      .tools-btn{width:36px;height:36px;border-radius:12px}
      #todayView .main-section-title{font-size:20px}
      #todayView .focus-title,#mainActive .tracker-name{font-size:18px}
      #todayView .focus-item{min-height:82px}
      .main-add{bottom:calc(108px + env(safe-area-inset-bottom))}
    }
  `;
  document.head.appendChild(css);

  try{renderMain();enhanceHomeCards();}catch{}
})();