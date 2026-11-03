// Keep the screen on while a game screen is visible (Screen Wake Lock).
// Fails silently where unsupported; re-requested when the app comes back.
import { getSettings } from './settings.js';

let lock = null;
let wanted = false;

async function request() {
  if (!wanted || document.visibilityState !== 'visible' || lock) return;
  try {
    if (!('wakeLock' in navigator)) return;
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { lock = null; }
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', request);

export function keepAwake(on) {
  wanted = on && getSettings().keepAwake;
  if (wanted) request();
  else if (lock) { lock.release().catch(() => {}); lock = null; }
}
