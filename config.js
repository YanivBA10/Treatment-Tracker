// Personal Tracker background push service.
window.PERSONAL_TRACKER_PUSH_API = 'https://personal-tracker-push.yanivba10.workers.dev';

// Keep the app hidden until all UX layers are loaded and the current route is
// rendered once with the final implementations. This prevents old-UI flashes
// and refreshes that briefly render legacy route content.
document.documentElement.classList.add('pt-ui-booting');
(()=>{
  const style=document.createElement('style');
  style.id='ptBootStyle';
  style.textContent='html.pt-ui-booting body{visibility:hidden}';
  document.head.appendChild(style);
})();

window.addEventListener('DOMContentLoaded',async()=>{
  const layers=[
    'polish.js?v=5.6.35',
    'backup.js?v=5.6.2',
    'ux-5.6.3.js?v=5.6.3',
    'ui-5.6.4.js?v=5.6.22',
    'tracker-ux-5.6.8.js?v=5.6.11',
    'task-ux-5.6.12.js?v=5.6.28',
    'reminder-ux-5.6.15.js?v=5.6.17'
  ];

  const load=(src)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.onload=resolve;
    s.onerror=()=>reject(new Error('Failed to load '+src));
    document.body.appendChild(s);
  });

  try{
    for(const src of layers) await load(src);

    // app.js performs the initial route before the enhancement layers exist.
    // Re-render the exact current route now that every override is installed.
    if(typeof applyRoute==='function' && history.state?.app){
      applyRoute(history.state);
    }else if(typeof renderMain==='function'){
      renderMain();
    }
    window.__PERSONAL_TRACKER_UI_READY__=true;
  }catch(err){
    console.error('Personal Tracker UI boot failed',err);
    // Never leave the app unusable if an optional layer fails.
    window.__PERSONAL_TRACKER_UI_READY__=false;
  }finally{
    document.documentElement.classList.remove('pt-ui-booting');
    document.getElementById('ptBootStyle')?.remove();
  }
});
