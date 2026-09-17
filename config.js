// Personal Tracker background push service.
window.PERSONAL_TRACKER_PUSH_API = 'https://personal-tracker-push.yanivba10.workers.dev';

// Load UI polish after the main app script has initialized.
window.addEventListener('DOMContentLoaded',()=>{
  const s=document.createElement('script');
  s.src='polish.js?v=5.5.2';
  s.defer=true;
  document.body.appendChild(s);
});
