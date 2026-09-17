/* Personal Tracker — tracker UX polish 5.6.8 */
(()=>{
  'use strict';

  function ensureHelper(){
    const mode=document.getElementById('trackerMode');
    if(!mode)return;
    const label=mode.previousElementSibling;
    if(label?.tagName==='LABEL'&&label.textContent.trim()==='סוג המעקב') label.textContent='מבנה המעקב';
    if(!mode.nextElementSibling?.classList?.contains('tracker-mode-help')){
      const help=document.createElement('div');
      help.className='small tracker-mode-help';
      help.innerHTML='<strong>פשוט</strong> — אותן פעולות לאורך כל התקופה. <strong>בשלבים</strong> — הפעולות משתנות במהלך המעקב.';
      mode.insertAdjacentElement('afterend',help);
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

  function polish(){
    ensureHelper();
    polishBuilder();
    polishDetailNav();
    polishManagement();
  }

  const css=document.createElement('style');
  css.textContent=`
    .tracker-mode-help{margin:7px 2px 2px;line-height:1.55}
    .tracker-mode-help strong{color:var(--text);font-weight:750}
    #builder{margin-top:14px}
    #builder .form-box>h4{font-size:17px;margin-bottom:5px}
    #builder .form-box>.small{margin-bottom:10px}
    #detailSettings .tracker-manage-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}
    #detailSettings .tracker-manage-actions .btn{margin:0;width:100%;min-height:48px}
    #detailSettings .tracker-manage-primary{grid-column:1/-1;background:var(--accent);color:#fff}
    #detailSettings .tracker-manage-danger{grid-column:1/-1;margin-top:8px!important;background:color-mix(in srgb,var(--danger) 10%,var(--card));color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 24%,var(--line));box-shadow:none}
    @media(max-width:420px){#detailSettings .tracker-manage-actions{grid-template-columns:1fr}.tracker-manage-primary,.tracker-manage-danger{grid-column:1}}
  `;
  document.head.appendChild(css);

  const observer=new MutationObserver(()=>requestAnimationFrame(polish));
  if(document.body)observer.observe(document.body,{subtree:true,childList:true});
  polish();
  setTimeout(polish,250);
  setTimeout(polish,900);
})();
