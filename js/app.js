// Entry point: a tiny hash router + boot.
// Add a screen: write js/screens/<name>.js exporting render(root, ctx), then add a route below.
import { APP_ID, APP_NAME } from './config.js';
import { applySettings, watchSystem } from './settings.js';
import { takeScreenUrls, closeAllDialogs, esc, toast } from './ui.js';
import { registerServiceWorker, requestPersist, setUpdateBannerAllowed } from './pwa.js';
import * as data from './data.js';
import { sharePayload, decodeShare } from './model.js';
import { renderHome } from './screens/home.js';
import { renderSettings, renderHelp } from './screens/settings-screen.js';
import { renderRound } from './screens/round.js';
import { renderMatch } from './screens/match.js';
import { renderNewGame } from './screens/new-game.js';
import { renderGames } from './screens/games.js';
import { renderGameEdit } from './screens/game-edit.js';
import { renderGroups, renderGroup, renderGroupEdit } from './screens/groups.js';
import { renderPlayer } from './screens/player.js';
import { showImport, badImport } from './screens/import.js';

// [pattern, render, title]. Patterns are hash paths; ":x" segments become ctx.params.x.
const ROUTES = [
  ['/', renderHome, null],
  ['/round', renderRound, 'End round'],
  ['/match/:id', renderMatch, 'Scores'],
  ['/new', renderNewGame, 'New game'],
  ['/new/:mode', renderNewGame, 'New game'],
  ['/games', renderGames, 'Games'],
  ['/game/:id', renderGameEdit, 'Game'],
  ['/groups', renderGroups, 'Groups'],
  ['/group/:id', renderGroup, 'Group'],
  ['/group/:id/edit', renderGroupEdit, 'Group'],
  ['/group/:gid/player/:pid', renderPlayer, 'Player'],
  ['/player/:pid', renderPlayer, 'Player'],
  ['/settings', renderSettings, 'Settings'],
  ['/help', renderHelp, 'Privacy and help'],
];

const ROUTE_KEY = `${APP_ID}:route`;
const root = document.getElementById('app');
let leaveHandlers = [];
let renderToken = 0;
let prevPath = null;

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

function savedRoute() {
  try { return localStorage.getItem(ROUTE_KEY); } catch { return null; }
}

/** A shared game link (#game=…): open the import sheet over the last screen. */
function takeShareLink() {
  const payload = sharePayload(location.hash);
  if (!payload) return null;
  history.replaceState(null, '', `${location.pathname}${location.search}#${savedRoute() || '/'}`);
  try { return { game: decodeShare(payload) }; } catch { return { bad: true }; }
}

async function route() {
  const shared = takeShareLink();
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
    prev: prevPath,
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
      <a class="btn btn-primary btn-wide" href="#/">Back to ${esc(APP_NAME)}</a></div></main>`;
  }
  if (token !== renderToken) return; // a newer navigation won
  revokeOld();
  const view = holder.firstElementChild;
  if (!view) return; // the screen redirected
  root.replaceChildren(view);
  document.title = found.title ? `${found.title} · ${APP_NAME}` : APP_NAME;
  root.scrollTop = 0;
  root.dataset.route = path;
  if (prevPath !== path) prevPath = path;
  try { localStorage.setItem(ROUTE_KEY, path); } catch { /* private mode */ }
  const h1 = root.querySelector('h1');
  if (h1 && (document.activeElement === document.body || !document.activeElement)) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  window.dispatchEvent(new CustomEvent('app:rendered', { detail: { route: path } }));
  if (shared) shared.bad ? badImport() : showImport(shared.game);
}

async function boot() {
  applySettings();
  watchSystem(() => {});
  // No pinch or double-tap zoom (big, fixed layouts instead): the viewport tag covers
  // most of it; Safari also needs these. Text size settings replace pinch zoom.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  data.onSaveError(() => toast('That change couldn’t be saved. The phone may be low on storage.'));
  try { await data.ensureSeeded(); } catch { /* shown as an error state by the screens */ }
  // Relaunching from the Home Screen opens at the start URL: go back to exactly where it was.
  const saved = savedRoute();
  if ((!location.hash || location.hash === '#' || location.hash === '#/') && saved && saved !== '/' && match(saved)) {
    history.replaceState(null, '', `${location.pathname}${location.search}#${saved}`);
  }
  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker();
  requestPersist();
}

boot();
