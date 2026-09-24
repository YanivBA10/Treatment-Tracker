/* Personal Tracker icon + feedback polish — 5.6.22 */
(()=>{
  'use strict';

  const BELL_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

  function bellNode(){
    const span=document.createElement('span');
    span.className='ui-bell';
    span.setAttribute('aria-hidden','true');
    span.innerHTML=BELL_SVG;
    return span;
  }

  function replaceBellText(el){
    if(!el)return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())if(walker.currentNode.nodeValue?.includes('🔔'))nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parts=node.nodeValue.split('🔔');
      const frag=document.createDocumentFragment();
      parts.forEach((part,i)=>{
        if(i)frag.appendChild(bellNode());
        if(part)frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    });
  }

  function polishBellIcons(){
    document.querySelectorAll('.tab span,.task-meta,.add-kind-icon,.reminder-meta-polished').forEach(el=>{
      if(el.textContent?.includes('🔔'))replaceBellText(el);
    });
  }

  let bellQueued=false;
  const queueBellPolish=()=>{
    if(bellQueued)return;
    bellQueued=true;
    requestAnimationFrame(()=>{bellQueued=false;polishBellIcons();});
  };

  const observer=new MutationObserver(queueBellPolish);
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});

  let toastTimer=null;
  window.toast=function(msg){
    const el=document.getElementById('toast');
    if(!el)return;
    const text=String(msg??'');
    const important=/גיבוי|שוחזר|שחזור|נשמר|סומן כבוצע|נדחתה ל/.test(text);
    el.textContent=text;
    el.classList.toggle('important',important);
    el.classList.add('show');
    if(toastTimer)clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{
      el.classList.remove('show','important');
      toastTimer=null;
    },important?3200:2200);
  };

  /* Trackers UX: keep two clear metrics only — process day + today's completion. */
  trackerCard=function(tr,archived=false){
    const el=document.createElement('div');
    el.className='tracker';
    const st=todayStats(tr);
    const completedToday=st.day>=1&&st.total>0&&st.done===st.total;
    const todayText=completedToday?'הושלם להיום ✓':(st.day>=1&&st.total?`${st.done}/${st.total} היום`:(st.day<1?'טרם התחיל':'אין פעולות היום'));
    const statusText=archived?'בארכיון':(completedToday?'✓ היום':'פעיל');
    const dayProgress=(!tr.openEnded&&Number(tr.duration)>0&&st.day>=1)
      ?Math.max(0,Math.min(100,Math.round((Math.min(st.day,Number(tr.duration))/Number(tr.duration))*100)))
      :null;
    el.innerHTML=`<div class="tracker-top"><div><div class="tracker-name">${esc(tr.name)}</div><div class="small">${trackerLabel(tr)} · ${todayText}</div></div><div class="badge ${completedToday?'ok':''}">${statusText}</div></div>${dayProgress!==null?`<div class="progress" aria-label="התקדמות בזמן"><div style="width:${dayProgress}%"></div></div>`:''}${archived?'<div class="actions"><button class="btn ghost smallbtn" data-restore>החזר לפעילים</button></div>':''}`;
    el.onclick=()=>openTracker(tr.id);
    if(archived)el.querySelector('[data-restore]').onclick=(e)=>{e.stopPropagation();tr.status='active';save();renderMain();toast('המעקב הוחזר לפעילים')};
    return el;
  };

  /* History is history: show elapsed days and today only, never future rows.
     Past actions can be explicitly acknowledged as "לא בוצע" without being marked done. */
  renderDetailHistory=function(tr){
    const box=document.getElementById('detailHistory');
    const archived=tr.status==='archived';
    box.innerHTML=`<div class="card"><div class="section-title">היסטוריה</div><div class="small history-hint">${archived?'היסטוריית המעקב נשמרת לקריאה בלבד.':'לחץ על יום כדי לעדכן את הפעולות שלו.'}</div><div id="historyRows"></div></div>`;
    const rows=box.querySelector('#historyRows');
    const today=trackerDay(tr);
    const max=today<1?0:(tr.openEnded?today:Math.min(Number(tr.duration||0),today));
    if(max<1){
      rows.innerHTML='<div class="empty compact">עדיין אין ימים בהיסטוריה.</div>';
      return;
    }
    for(let d=1;d<=max;d++){
      const ts=tasksForDay(tr,d);
      const done=ts.filter(t=>isDone(tr,d,t.id)).length;
      const skipped=ts.filter(t=>typeof isSkipped==='function'&&isSkipped(tr,d,t.id)).length;
      const unresolved=Math.max(0,ts.length-done-skipped);
      const date=parseDate(tr.startDate);date.setDate(date.getDate()+d-1);
      const row=document.createElement('div');row.className='history-day'+(archived?' history-day-readonly':'');
      let txt=d===today?`היום · ${done}/${ts.length}`:`${done}/${ts.length}`,cls='';
      if(d<today&&ts.length){
        if(done===ts.length){txt='הושלם';cls='ok'}
        else if(unresolved===0){txt=`טופל · ${done}/${ts.length}`;cls='acknowledged'}
        else{txt=`${done}/${ts.length} · ${unresolved} לבדיקה`;cls='miss'}
      }
      row.innerHTML=`<div><strong>יום ${d}</strong><div class="task-meta">${fmtDate(date,true)}</div></div><div class="status ${cls}">${txt}</div>`;
      if(!archived)row.onclick=()=>openHistoryEditor(tr,d);
      rows.appendChild(row);
    }
  };

  const css=document.createElement('style');
  css.textContent=`
    .ui-bell{display:inline-flex;align-items:center;justify-content:center;width:1.05em;height:1.05em;vertical-align:-.13em;color:currentColor;flex:0 0 auto}
    .ui-bell svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .task-meta .ui-bell,.reminder-meta-polished .ui-bell{color:var(--muted);opacity:.92}
    .tab .ui-bell{width:20px;height:20px;color:currentColor;vertical-align:0;transform:translateY(2px)}
    .history-modal-tasks{padding-left:12px!important;padding-right:2px!important;padding-bottom:18px;scrollbar-gutter:stable}
    .history-modal .modal-actions{padding-top:10px}
    .history-modal .task.history-task{align-items:center;padding:10px 12px;margin:7px 0;border-radius:16px;background:var(--surface)}
    .history-task.done{background:var(--surface);border-color:color-mix(in srgb,var(--ok) 20%,var(--line))}
    .history-task.skipped{background:var(--surface);border-color:color-mix(in srgb,var(--warn) 20%,var(--line))}
    .tracker-action-row{align-items:center;background:var(--surface);padding:11px 12px}
    .tracker-action-row.done{background:var(--surface);border-color:color-mix(in srgb,var(--ok) 20%,var(--line))}
    .today-choice-group{flex:0 0 auto;min-width:92px}
    .today-choice-group .history-choice{width:100%;border:1px solid var(--line);border-radius:12px}
    .history-choice-group{display:grid;grid-template-columns:1fr 1fr;gap:0;min-width:184px;flex:0 0 auto;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)}
    .history-choice{min-height:36px;padding:7px 10px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:800;white-space:nowrap}
    .history-choice+ .history-choice{border-inline-start:1px solid var(--line)}
    .history-choice.done-choice.selected{background:color-mix(in srgb,var(--ok) 14%,var(--card));color:var(--ok)}
    .history-choice.skipped-choice.selected{background:color-mix(in srgb,var(--warn) 14%,var(--card));color:var(--warn)}
    .history-choice:active{background:var(--soft)}
    .status.acknowledged{background:color-mix(in srgb,var(--warn) 10%,var(--card));color:var(--warn)}
    .history-day-readonly{cursor:default!important}
    @media(max-width:430px){
      .history-modal-tasks{padding-left:11px!important;padding-bottom:20px}
      .history-modal .task.history-task{align-items:stretch;flex-direction:column;padding:10px 11px}
      .history-choice-group{min-width:0;width:100%;margin-top:8px}
      .today-choice-group{width:100%;min-width:0;margin-top:8px}
      .tracker-action-row{align-items:stretch;flex-direction:column}
      .tracker-action-row .today-choice-group{margin-top:8px}
      .history-choice{min-height:35px;padding-block:6px}
    }

    #addMenuBackdrop .add-kind-icon .ui-bell{width:20px;height:20px;color:var(--accent);vertical-align:0}

    .toast{top:max(18px,env(safe-area-inset-top));min-width:min(300px,calc(100vw - 32px));max-width:min(460px,calc(100vw - 32px));padding:14px 18px;border-radius:16px;font-size:15px;font-weight:700;line-height:1.45;text-align:center;box-shadow:0 14px 38px rgba(18,29,49,.24);z-index:160}
    .toast.important{background:var(--accent);color:#fff;font-size:16px;font-weight:850;padding:16px 20px;box-shadow:0 16px 42px color-mix(in srgb,var(--accent) 34%,transparent)}
    html[data-theme="dark"] .toast{box-shadow:0 16px 42px rgba(0,0,0,.42)}
  `;
  document.head.appendChild(css);

  polishBellIcons();
  setTimeout(polishBellIcons,250);
  setTimeout(polishBellIcons,900);
})();
