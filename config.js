// Personal Tracker background push service.
window.PERSONAL_TRACKER_PUSH_API = 'https://personal-tracker-push.yanivba10.workers.dev';

// Load optional UI and backup layers after the main app script has initialized.
window.addEventListener('DOMContentLoaded',()=>{
  const load=(src)=>{const s=document.createElement('script');s.src=src;s.defer=true;document.body.appendChild(s)};
  load('polish.js?v=5.6.1');
  load('backup.js?v=5.6.2');
  load('ux-5.6.3.js?v=5.6.3');
  load('ui-5.6.4.js?v=5.6.7');
  load('tracker-ux-5.6.8.js?v=5.6.10');
  load('task-ux-5.6.12.js?v=5.6.13');
});
