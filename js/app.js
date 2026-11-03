// Entry point: a tiny hash router + boot.
// Add a screen: write js/screens/<name>.js exporting render(root, ctx), then add a route below.
import { APP_NAME } from './config.js';
import { applySettings, watchSystem } from './settings.js';
import { takeScreenUrls, closeAllDialogs, esc } from './ui.js';
import { registerServiceWorker, requestPersist, setUpdateBannerAllowed } from './pwa.js';
import { renderHome } from './screens/home.js';
import { renderSettings } from './screens/settings-screen.js';

// [pattern, render, title]. Patterns are hash paths; ":x" segments become ctx.params.x.
const ROUTES = [
  ['/', renderHome, null],
  ['/settings', renderSettings, 'Settings'],
];

const root = document.getElementById('app');
let leaveHandlers = [];
let renderToken = 0;

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, render, title] of ROUTES) {
    const want = pattern.split('/').filter(Boolean);
    if (want.length !== parts.length) continue;
    const params = {};
    if (want.every((w, i) => (w.startsWith(':') ? ((params[w.slice(1)] = decodeURIComponent(parts[i])), true) : w === parts[i]))) {
      return { render, title, params };
    }
  }
  return null;
}

async function route() {
  const token = ++renderToken;
  leaveHandlers.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  leaveHandlers = [];
  closeAllDialogs();
  setUpdateBannerAllowed(true);
  const revokeOld = takeScreenUrls();
  const path = location.hash.replace(/^#/, '') || '/';
  const found = match(path);
  if (!found) { location.replace('#/'); return; }
  const holder = document.createElement('div');
  const ctx = {
    params: found.params,
    onLeave: (fn) => leaveHandlers.push(fn),
    refresh: () => route(),
  };
  try {
    await found.render(holder, ctx);
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
    holder.innerHTML = `<main class="screen"><div class="empty-state" role="alert">
      <h1>Something went wrong</h1>
      <p>Nothing you saved has been lost. Try going back to the start.</p>
      <a class="btn btn-primary btn-main" href="#/">Back to ${esc(APP_NAME)}</a></div></main>`;
  }
  if (token !== renderToken) return; // a newer navigation won
  revokeOld();
  const view = holder.firstElementChild;
  if (view) root.replaceChildren(view);
  document.title = found.title ? `${found.title} · ${APP_NAME}` : APP_NAME;
  window.scrollTo(0, 0);
  root.dataset.route = path;
  const h1 = root.querySelector('h1');
  if (h1 && document.activeElement === document.body) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  window.dispatchEvent(new CustomEvent('app:rendered', { detail: { route: path } }));
}

applySettings();
watchSystem(() => {});
// No pinch or double-tap zoom (big, fixed layouts instead): the viewport tag covers
// most of it; Safari also needs these. Text size settings replace pinch zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
window.addEventListener('hashchange', route);
route();
registerServiceWorker();
requestPersist();
