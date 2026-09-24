/* Personal Tracker — tasks + depth navigation polish 5.6.23 */
(()=>{
  'use strict';

  const TOP_LEVEL=new Set(['todayView','trackersView','tasksView','remindersView']);
  const EDIT_VIEWS=new Set(['editorView','reminderEditorView','taskEditorView']);
  const BACK_SELECTORS=['#backToTrackers','#cancelEditor','#cancelReminderEditor','#cancelTaskEditor','#taskDetailBack','#archiveView .back','#appSettingsView .back'];

  function shortDate(dateStr){
    if(!dateStr)return '';
    const p=String(dateStr).split('-').map(Number);
    if(p.length!==3||p.some(Number.isNaN))return dateStr;
    return `${String(p[2]).padStart(2,'0')}.${String(p[1]).padStart(2,'0')}.${String(p[0]).slice(-2)}`;
  }
  function dateTimeHtml(dateStr,time){
    const d=shortDate(dateStr),tm=String(time||'');
    if(d&&tm)return `<span class="task-date-time" dir="ltr">${d} · ${tm}</span>`;
    if(d)return `<span class="task-date-time" dir="ltr">${d}</span>`;
    if(tm)return `<span class="task-date-time" dir="ltr">${tm}</span>`;
    return '';
  }

  function ensureDepthNav(){
    const header=document.querySelector('.app>header');
    const row=header?.querySelector(':scope>.row');
    if(!row)return null;
    let btn=document.getElementById('depthNavBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='depthNavBtn';
      btn.type='button';
      btn.className='btn ghost depth-nav-btn hidden';
      btn.onclick=()=>history.back();
      row.prepend(btn);
    }
    return btn;
  }

  function visibleMainId(){
    const el=[...document.querySelectorAll('.app>main')].find(m=>!m.classList.contains('hidden'));
    return el?.id||'';
  }

  function syncHeaderMode(){
    const view=visibleMainId();
    if(!view)return;
    const btn=ensureDepthNav();
    const tools=document.querySelector('.app>header .tools-wrap');
    const top=TOP_LEVEL.has(view);
    tools?.classList.toggle('hidden',!top);
    btn?.classList.toggle('hidden',top);
    if(btn&&!top)btn.textContent=EDIT_VIEWS.has(view)?'ביטול':'← חזרה';
    BACK_SELECTORS.forEach(sel=>document.querySelector(sel)?.classList.toggle('depth-inline-back-hidden',!top));
  }

  if(typeof window.showOnly==='function'){
    const originalShowOnly=window.showOnly;
    window.showOnly=function(id){originalShowOnly(id);requestAnimationFrame(syncHeaderMode);};
  }

  function statusChipForTask(t){
    const due=typeof taskDueState==='function'?taskDueState(t):'open';
    if(t.status==='completed')return '<span class="task-state-chip done">הושלמה</span>';
    if(due==='overdue')return '<span class="task-state-chip overdue">באיחור</span>';
    return '';
  }

  function taskMetaParts(t){
    const due=typeof taskDueState==='function'?taskDueState(t):'open';
    const primary=[];
    if(t.dueDate)primary.push(due==='today'?'יעד היום':`יעד ${dateTimeHtml(t.dueDate,'')}`);
    if(t.reminderDate&&t.reminderTime)primary.push(`🔔 ${dateTimeHtml(t.reminderDate,t.reminderTime)}`);
    const snz=typeof snoozeLabel==='function'?snoozeLabel(t.snoozedUntil):'';
    if(snz)primary.push(snz);
    const secondary=[];
    const pr=typeof taskProgress==='function'?taskProgress(t):{done:0,total:0};
    if(pr.total)secondary.push(`${pr.done}/${pr.total} שלבים`);
    if(t.showOnMain&&t.status!=='completed')secondary.push('פעיל עכשיו');
    return {primary,secondary};
  }

  if(typeof window.taskCard==='function'){
    window.taskCard=function(t,compact=false){
      const el=document.createElement('div');
      const due=taskDueState(t),m=taskMetaParts(t);
      el.className='work-task'+(t.status==='completed'?' completed':'')+(due==='overdue'?' overdue':'');
      el.innerHTML=`<div class="reminder-main"><div class="grow"><div class="task-title-line"><div class="tracker-name">${esc(t.title)}</div>${statusChipForTask(t)}</div>${!compact&&t.description?`<div class="reminder-description">${esc(t.description)}</div>`:''}${m.primary.length?`<div class="task-meta task-primary-meta">${m.primary.map(x=>`<span class="task-meta-item">${x}</span>`).join('<span class="task-meta-sep">•</span>')}</div>`:''}${m.secondary.length?`<div class="task-secondary-meta">${m.secondary.map(x=>`<span class="task-mini-chip">${x}</span>`).join('')}</div>`:''}</div><button class="check reminder-check" aria-label="סימון בוצע">${t.status==='completed'?'✓':''}</button></div>`;
      el.querySelector('.reminder-check').onclick=e=>{e.stopPropagation();setWholeTaskDone(t,t.status!=='completed')};
      el.onclick=()=>openTaskDetail(t.id);
      return el;
    };
  }

  let showAllCompletedTasks=false;

  function taskBucket(t){
    if(!t.dueDate)return 'nodate';
    const today=parseDate(todayStr());
    const due=parseDate(t.dueDate);
    const delta=Math.round((due-today)/86400000);
    if(delta<0)return 'overdue';
    if(delta===0)return 'today';
    if(delta<=7)return 'soon';
    return 'later';
  }

  function taskGroupBlock(title,items,key){
    if(!items.length)return null;
    const wrap=document.createElement('section');
    wrap.className='task-time-group task-time-'+key;
    const head=document.createElement('div');
    head.className='task-time-group-head';
    head.innerHTML=`<span>${title}</span><span class="task-time-count">${items.length}</span>`;
    wrap.appendChild(head);
    const list=document.createElement('div');
    list.className='task-time-group-list';
    items.forEach(t=>list.appendChild(taskCard(t)));
    wrap.appendChild(list);
    return wrap;
  }

  if(typeof window.renderTasksList==='function'){
    window.renderTasksList=function(){
      const box=document.getElementById('tasksList'),done=document.getElementById('completedTasks');
      if(!box)return;
      box.innerHTML='';
      const active=(state.tasks||[]).filter(t=>t.status!=='completed');
      const groups=[
        ['באיחור',active.filter(t=>taskBucket(t)==='overdue'),'overdue'],
        ['היום',active.filter(t=>taskBucket(t)==='today'),'today'],
        ['בקרוב',active.filter(t=>taskBucket(t)==='soon'),'soon'],
        ['בהמשך',active.filter(t=>taskBucket(t)==='later'),'later'],
        ['ללא תאריך',active.filter(t=>taskBucket(t)==='nodate'),'nodate']
      ];
      const sorter=(a,b)=>(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')||((a.createdAt||0)-(b.createdAt||0));
      groups.forEach(g=>g[1].sort(sorter));
      if(!active.length){
        box.innerHTML='<div class="empty">אין משימות פתוחות.</div>';
      }else{
        groups.forEach(([title,items,key])=>{const block=taskGroupBlock(title,items,key);if(block)box.appendChild(block);});
      }

      if(done){
        done.innerHTML='';
        const arr=(state.tasks||[]).filter(t=>t.status==='completed').sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
        if(!arr.length){
          done.innerHTML='<div class="empty compact">אין משימות שהושלמו.</div>';
        }else{
          const visible=showAllCompletedTasks?arr:arr.slice(0,5);
          visible.forEach(t=>done.appendChild(taskCard(t,true)));
          if(arr.length>5){
            const btn=document.createElement('button');
            btn.className='btn ghost block task-completed-toggle';
            btn.textContent=showAllCompletedTasks?'הצג פחות':`הצג את כל ההושלמו (${arr.length})`;
            btn.onclick=()=>{showAllCompletedTasks=!showAllCompletedTasks;renderTasksList();};
            done.appendChild(btn);
          }
        }
      }
    };
  }

  if(typeof window.renderTaskDetailRoute==='function'){
    const originalDetail=window.renderTaskDetailRoute;
    window.renderTaskDetailRoute=function(id){
      originalDetail(id);
      const t=(state.tasks||[]).find(x=>x.id===id);if(!t)return;
      const top=document.getElementById('taskDetailTitle')?.closest('.card');
      if(top){
        let chip=top.querySelector('.task-detail-state');
        if(!chip){chip=document.createElement('div');chip.className='task-detail-state';top.prepend(chip);}
        const due=taskDueState(t);
        chip.textContent=t.status==='completed'?'הושלמה':due==='overdue'?'באיחור':'פתוחה';
        chip.className='task-detail-state '+(t.status==='completed'?'done':due==='overdue'?'overdue':'open');
      }
      const meta=document.getElementById('taskDetailMeta');
      if(meta){
        const parts=[];
        const due=taskDueState(t);
        if(t.dueDate)parts.push(due==='today'?'יעד היום':`יעד ${dateTimeHtml(t.dueDate,'')}`);
        if(t.reminderDate&&t.reminderTime)parts.push(`🔔 ${dateTimeHtml(t.reminderDate,t.reminderTime)}`);
        meta.innerHTML=parts.join('<span class="task-detail-sep">•</span>');
        meta.classList.toggle('hidden',!parts.length);
      }
      const host=document.getElementById('taskDetailSubtasks');
      const section=host?.closest('.card');
      const pr=taskProgress(t);
      if(section&&pr.total){
        let prog=section.querySelector('.task-detail-progress-visual');
        if(!prog){prog=document.createElement('div');prog.className='task-detail-progress-visual';section.querySelector('.section-title')?.insertAdjacentElement('afterend',prog);}
        const pct=Math.round(pr.done/pr.total*100);
        prog.innerHTML=`<div class="task-progress-head"><span>${pr.done} מתוך ${pr.total} שלבים</span></div><div class="task-progress-bar"><div style="width:${pct}%"></div></div>`;
      }else section?.querySelector('.task-detail-progress-visual')?.remove();
      const old=document.getElementById('taskDetailProgress');if(old)old.classList.add('hidden');
      syncHeaderMode();
    };
  }

  function ensureTimingSection(){
    const due=document.getElementById('workTaskDueDate');
    const reminderDate=document.getElementById('workTaskReminderDate');
    const reminderTime=document.getElementById('workTaskReminderTime');
    const grid=due?.closest('.field-grid');
    if(!due||!reminderDate||!reminderTime||!grid)return;
    if(grid.closest('.task-timing-section'))return;
    const timeLabel=reminderTime.previousElementSibling;
    const wrap=document.createElement('div');
    wrap.className='task-timing-section';
    const head=document.createElement('div');head.className='task-timing-title';head.textContent='זמן ותזכורת';
    const help=document.createElement('div');help.className='small task-timing-help';help.textContent='יעד הוא מועד הסיום. תזכורת קובעת מתי לקבל התראה.';
    grid.parentElement.insertBefore(wrap,grid);
    wrap.append(head,help,grid);
    if(timeLabel?.tagName==='LABEL')wrap.appendChild(timeLabel);
    wrap.appendChild(reminderTime);
  }

  function polishTaskEditor(){
    const view=document.getElementById('taskEditorView');if(!view||view.classList.contains('hidden'))return;
    const subHost=document.getElementById('subtasksEditor');
    const subLabel=subHost?.previousElementSibling;
    if(subLabel?.tagName==='LABEL')subLabel.innerHTML='שלבים <span class="optional">(אופציונלי)</span>';
    subHost?.querySelectorAll('input').forEach(i=>i.placeholder='שם השלב');

    const due=document.getElementById('workTaskDueDate');
    const reminderDate=document.getElementById('workTaskReminderDate');
    const reminderTime=document.getElementById('workTaskReminderTime');
    const dueLabel=due?.parentElement?.querySelector('label');
    const reminderDateLabel=reminderDate?.parentElement?.querySelector('label');
    const reminderTimeLabel=reminderTime?.previousElementSibling;
    if(dueLabel)dueLabel.innerHTML='תאריך יעד <span class="optional">(אופציונלי)</span>';
    if(reminderDateLabel)reminderDateLabel.innerHTML='תאריך תזכורת <span class="optional">(אופציונלי)</span>';
    if(reminderTimeLabel?.tagName==='LABEL')reminderTimeLabel.innerHTML='שעת תזכורת <span class="optional">(אופציונלי)</span>';
    ensureTimingSection();

    const showLabel=document.querySelector('label[for="workTaskShowOnMain"]');
    if(showLabel)showLabel.textContent='הצג ב״פעיל עכשיו״';
    syncHeaderMode();
  }

  if(typeof window.renderTaskEditorRoute==='function'){
    const originalEditor=window.renderTaskEditorRoute;
    window.renderTaskEditorRoute=function(id=null){originalEditor(id);polishTaskEditor();};
  }
  if(typeof window.renderSubtaskEditor==='function'){
    const originalSubtasks=window.renderSubtaskEditor;
    window.renderSubtaskEditor=function(){originalSubtasks();polishTaskEditor();};
  }

  const css=document.createElement('style');
  css.textContent=`
    .depth-inline-back-hidden{display:none!important}
    .depth-nav-btn{min-width:0!important;height:38px;padding:0 4px!important;border:0!important;background:transparent!important;box-shadow:none!important;color:var(--accent)!important;font-weight:800;font-size:15px}
    .depth-nav-btn:active{opacity:.65}
    .task-title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .task-state-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:850;line-height:1.2;background:var(--soft);color:var(--muted)}
    .task-state-chip.overdue,.task-detail-state.overdue{background:color-mix(in srgb,var(--danger) 10%,var(--card));color:var(--danger)}
    .task-state-chip.done,.task-detail-state.done{background:color-mix(in srgb,var(--ok) 12%,var(--card));color:var(--ok)}
    .task-primary-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px 7px;margin-top:7px}
    .task-meta-item{display:inline-flex;align-items:center;gap:4px;unicode-bidi:isolate}
    .task-date-time{display:inline-block;white-space:nowrap;font-variant-numeric:tabular-nums;unicode-bidi:isolate}
    .task-meta-sep,.task-detail-sep{opacity:.45;margin-inline:6px}
    .task-secondary-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .task-mini-chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 8%,var(--card));color:var(--muted);font-size:11px;font-weight:700}
    .work-task.overdue{border-color:color-mix(in srgb,var(--danger) 32%,var(--line))}
    .task-time-group{margin-top:18px}
    .task-time-group:first-child{margin-top:8px}
    .task-time-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 8px;font-size:14px;font-weight:850;color:var(--text)}
    .task-time-count{display:inline-flex;min-width:24px;height:24px;padding:0 7px;align-items:center;justify-content:center;border-radius:999px;background:var(--soft);color:var(--muted);font-size:11px;font-weight:800}
    .task-time-overdue .task-time-group-head{color:var(--danger)}
    .task-time-group-list{display:grid;gap:10px}
    .task-time-group-list .work-task{margin:0}
    .task-completed-toggle{margin-top:10px}
    .task-detail-state{display:inline-flex;width:max-content;padding:5px 9px;border-radius:999px;margin-bottom:9px;background:var(--soft);color:var(--muted);font-size:12px;font-weight:800}
    #taskDetailMeta{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-top:7px}
    .task-detail-progress-visual{margin:2px 0 16px}
    .task-progress-head{color:var(--muted);font-size:12px;font-weight:750;margin-bottom:7px}
    .task-progress-bar{height:7px;border-radius:99px;overflow:hidden;background:color-mix(in srgb,var(--line) 72%,transparent)}
    .task-progress-bar>div{height:100%;border-radius:inherit;background:var(--accent)}
    .task-timing-section{margin-top:22px;padding:15px;border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--surface) 82%,var(--card))}
    .task-timing-title{font-size:17px;font-weight:850;margin-bottom:3px}
    .task-timing-help{margin-bottom:4px;line-height:1.45}
    .task-timing-section .field-grid{margin-top:4px;align-items:end}
    .task-timing-section>label{margin-top:12px}
    #taskEditorView .show-main-line{margin-top:16px}
    #taskEditorView .card{padding-bottom:20px}
    @media(max-width:480px){.depth-nav-btn{padding-inline:2px!important}}
  `;
  document.head.appendChild(css);

  syncHeaderMode();polishTaskEditor();
  try{if(typeof renderMain==='function')renderMain();}catch{}
})();
