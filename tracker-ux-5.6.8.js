/* Personal Tracker — tracker UX polish 5.6.10 */
(()=>{
  'use strict';

  function trackerModeCopy(mode){
    return mode==='staged'?'הפעולות יכולות להשתנות במהלך המעקב.':'אותן פעולות לאורך כל התקופה.';
  }

  function ensureHelper(){
    const mode=document.getElementById('trackerMode');
    if(!mode)return;
    const label=mode.previousElementSibling;
    if(label?.tagName==='LABEL'&&(label.textContent.trim()==='סוג המעקב'||label.textContent.trim()==='מבנה המעקב')) label.textContent='מבנה המעקב';
    let help=mode.nextElementSibling;
    if(!help?.classList?.contains('tracker-mode-help')){
      help=document.createElement('div');
      help.className='small tracker-mode-help';
      mode.insertAdjacentElement('afterend',help);
    }
    help.textContent=trackerModeCopy(mode.value);
    if(!mode.dataset.helperBound){
      mode.addEventListener('change',()=>{help.textContent=trackerModeCopy(mode.value);});
      mode.dataset.helperBound='1';
    }
  }

  function polishBuilder(){
    const builder=document.getElementById('builder');
    if(!builder)return;
    builder.querySelectorAll('.form-box h4').forEach(h=>{
      if(h.textContent.trim()==='פעולות שחוזרות לאורך המעקב') h.textContent='פעולות במעקב';
    });
    builder.querySelectorAll('.form-box .small').forEach(s=>{
      if(s.textContent.includes('אפשר להוסיף כמה פעולות עם שעות ותדירויות שונות')) s.textContent='מה תרצה לבצע, מתי ובאיזו תדירות?';
    });
  }

  function polishDetailNav(){
    const btn=document.querySelector('.detail-nav button[data-detail="settings"]');
    if(btn&&btn.textContent.trim()!=='ניהול') btn.textContent='ניהול';
  }

  function polishManagement(){
    const box=document.getElementById('detailSettings');
    if(!box)return;
    const edit=box.querySelector('[data-edit]');
    const dup=box.querySelector('[data-dup]');
    const archive=box.querySelector('[data-archive]');
    const del=box.querySelector('[data-delete]');
    if(edit){edit.classList.remove('secondary','ghost');edit.classList.add('tracker-manage-primary');}
    [dup,archive].forEach(b=>b?.classList.add('tracker-manage-secondary'));
    if(del){
      del.classList.add('tracker-manage-danger');
      const actions=del.parentElement;
      if(actions&&!actions.classList.contains('tracker-manage-actions')) actions.classList.add('tracker-manage-actions');
    }
  }

  function shortDateWithYear(dateStr){
    if(!dateStr)return '';
    const parts=String(dateStr).split('-').map(Number);
    if(parts.length!==3||parts.some(Number.isNaN))return dateStr;
    const [y,m,d]=parts;
    return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${String(y).slice(-2)}`;
  }

  function polishTrackerDate(){
    const meta=document.getElementById('detailMeta');
    if(!meta||typeof currentTracker!=='function')return;
    const tr=currentTracker();
    if(!tr?.startDate)return;
    const prefix=meta.textContent.split(' · התחלה')[0];
    meta.textContent=`${prefix} · התחלה ${shortDateWithYear(tr.startDate)}`;
  }

  function polish(){
    ensureHelper();
    polishBuilder();
    polishDetailNav();
    polishManagement();
    polishTrackerDate();
  }

  const css=document.createElement('style');
  css.textContent=`
    .tracker-mode-help{margin:7px 2px 2px;line-height:1.55}
    #builder{margin-top:14px}
    #builder .form-box>h4{font-size:17px;margin-bottom:5px}
    #builder .form-box>.small{margin-bottom:10px}

    /* Tracker detail tabs — active tab visually belongs to the content below */
    #detailView .detail-nav{gap:8px;margin-bottom:0;position:relative;z-index:2;align-items:end}
    #detailView .detail-nav button{border-radius:14px 14px 0 0;margin-bottom:0;min-height:50px}
    #detailView .detail-nav button:not(.active){border-bottom-color:var(--line);transform:translateY(0)}
    #detailView .detail-nav button.active{background:var(--card);border-color:var(--line);border-bottom-color:var(--card);transform:translateY(1px);box-shadow:none}
    #detailView #detailToday:not(.hidden),#detailView #detailHistory:not(.hidden),#detailView #detailSettings:not(.hidden){margin-top:0}
    #detailView #detailToday:not(.hidden)>.card:first-child,#detailView #detailHistory:not(.hidden)>.card:first-child,#detailView #detailSettings:not(.hidden)>.card:first-child{margin-top:0}
    #detailView:has(.detail-nav button[data-detail="today"].active) #detailToday:not(.hidden)>.card:first-child{border-top-right-radius:0}
    #detailView:has(.detail-nav button[data-detail="settings"].active) #detailSettings:not(.hidden)>.card:first-child{border-top-left-radius:0}

    /* Tracker management hierarchy */
    #detailSettings .tracker-manage-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}
    #detailSettings .tracker-manage-actions .btn{margin:0;width:100%;min-height:48px}
    #detailSettings .tracker-manage-primary{grid-column:1/-1;background:var(--accent);color:#fff}
    #detailSettings .tracker-manage-danger{grid-column:1/-1;margin-top:8px!important;background:color-mix(in srgb,var(--danger) 10%,var(--card));color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 24%,var(--line));box-shadow:none}

    /* Header alignment — align mark with the title, not the whole title/subtitle block */
    .app>header{align-items:flex-start}
    .header-brand{align-items:flex-start!important}
    .appmark.appmark-image{width:38px;height:38px;flex-basis:38px;margin-top:1px}
    .header-brand .title{line-height:1.08}
    .app>header>.row{margin-top:1px}

    /* Builder pages should end shortly after their content */
    .app:has(#builder:not(.hidden)){min-height:auto;padding-bottom:28px}
    #builder{padding-bottom:0}

    @media(max-width:420px){
      #detailSettings .tracker-manage-actions{grid-template-columns:1fr}
      .tracker-manage-primary,.tracker-manage-danger{grid-column:1}
    }
  `;
  document.head.appendChild(css);

  const observer=new MutationObserver(()=>requestAnimationFrame(polish));
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  polish();
  setTimeout(polish,250);
  setTimeout(polish,900);
})();
