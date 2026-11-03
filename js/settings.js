// Small preferences in localStorage. Big or precious data goes in IndexedDB (store.js).
// Add your app's own settings to APP_DEFAULTS; the shared ones are always there.
import { APP_ID } from './config.js';

const KEY = `${APP_ID}:settings`;

const SHARED_DEFAULTS = {
  textSize: 'normal', // normal | large | xl
  theme: null, // null = follow the system (light/dark) | light | dark | contrast
  sound: false,
  installDismissed: false,
  lastBackup: null, // ms timestamp of the last backup the person saved
};

// ↓ Your app's settings go here.
const APP_DEFAULTS = {};

export const DEFAULTS = Object.freeze({ ...SHARED_DEFAULTS, ...APP_DEFAULTS });
const TEXT_SIZES = ['normal', 'large', 'xl'];
const THEMES = [null, 'light', 'dark', 'contrast'];

let cache;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; /* full, private mode etc. */ }
}

/** Keep only known keys with values of the right type; anything odd falls back to the default. */
export function sanitiseSettings(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (k === 'textSize') { if (TEXT_SIZES.includes(v)) out[k] = v; continue; }
    if (k === 'theme') { if (THEMES.includes(v)) out[k] = v; continue; }
    if (def === null || typeof v === typeof def) out[k] = v;
  }
  return out;
}

export function getSettings() {
  if (!cache) {
    let stored = {};
    try { stored = JSON.parse(safeGet(KEY) || '{}'); } catch { stored = {}; }
    cache = sanitiseSettings(stored);
  }
  return cache;
}

export function setSettings(changes) {
  cache = sanitiseSettings({ ...getSettings(), ...changes });
  safeSet(KEY, JSON.stringify(cache));
  applySettings();
  return cache;
}

/** Replace everything (used by Restore). */
export function replaceSettings(all) {
  cache = sanitiseSettings(all);
  safeSet(KEY, JSON.stringify(cache));
  applySettings();
}

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function effectiveTheme() {
  const s = getSettings();
  if (s.theme) return s.theme;
  return darkQuery && darkQuery.matches ? 'dark' : 'light';
}

export function reducedMotion() {
  return !!(motionQuery && motionQuery.matches);
}

/** Put theme / text size / reduced motion on <html> so tokens.css can switch. */
export function applySettings() {
  if (typeof document === 'undefined') return;
  const s = getSettings();
  const root = document.documentElement;
  const theme = effectiveTheme();
  if (theme === 'light') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  if (s.textSize === 'normal') root.removeAttribute('data-text');
  else root.setAttribute('data-text', s.textSize);
  root.classList.toggle('reduce-motion', reducedMotion());
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

export function watchSystem(onChange) {
  const cb = () => { applySettings(); onChange && onChange(); };
  darkQuery && darkQuery.addEventListener && darkQuery.addEventListener('change', cb);
  motionQuery && motionQuery.addEventListener && motionQuery.addEventListener('change', cb);
}
