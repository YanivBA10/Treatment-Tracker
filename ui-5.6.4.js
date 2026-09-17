/* Personal Tracker icon + feedback polish — 5.6.7 */
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
    if(!el||el.dataset.bellPolished==='1')return;
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
    if(nodes.length)el.dataset.bellPolished='1';
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

  /* History is history: show elapsed days and today only, never future 0/3 rows. */
  renderDetailHistory=function(tr){
    const box=document.getElementById('detailHistory');
    box.innerHTML='<div class="card"><div class="section-title">היסטוריה</div><div class="small history-hint">לחץ על יום כדי לעדכן את הפעולות שלו.</div><div id="historyRows"></div></div>';
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
      const date=parseDate(tr.startDate);date.setDate(date.getDate()+d-1);
      const row=document.createElement('div');row.className='history-day';
      let txt=d===today?`היום · ${done}/${ts.length}`:`${done}/${ts.length}`,cls='';
      if(d<today&&ts.length){if(done===ts.length){txt='הושלם';cls='ok'}else cls='miss'}
      row.innerHTML=`<div><strong>יום ${d}</strong><div class="task-meta">${fmtDate(date,true)}</div></div><div class="status ${cls}">${txt}</div>`;
      row.onclick=()=>openHistoryEditor(tr,d);
      rows.appendChild(row);
    }
  };

  const css=document.createElement('style');
  css.textContent=`
    .ui-bell{display:inline-flex;align-items:center;justify-content:center;width:1.05em;height:1.05em;vertical-align:-.13em;color:currentColor;flex:0 0 auto}
    .ui-bell svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .task-meta .ui-bell,.reminder-meta-polished .ui-bell{color:var(--muted);opacity:.92}
    .tab .ui-bell{width:20px;height:20px;color:currentColor;vertical-align:0;transform:translateY(2px)}
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
