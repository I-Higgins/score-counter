// Service-worker registration, the "new version" banner, install detection
// and persistent-storage requests.
//
// Updates never interrupt the person: the new worker waits until they tap
// "Tap to refresh". Screens where even the banner would be a distraction
// (mid-game, mid-form) call setUpdateBannerAllowed(false) and true again after.
import { el } from './ui.js';
import { icon } from './icons.js';

export function isStandalone() {
  return (typeof navigator !== 'undefined' && navigator.standalone === true) ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
}

let waitingWorker = null;
let bannerAllowed = true;
let updateAccepted = false;

export function setUpdateBannerAllowed(on) {
  bannerAllowed = on;
  if (!on) document.querySelector('.banner')?.remove();
  else if (waitingWorker) showUpdate(waitingWorker);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only ever happens after the person tapped "Tap to refresh".
    if (refreshing || !updateAccepted) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
    const track = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
    // Check for updates when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
}

function showUpdate(worker) {
  waitingWorker = worker;
  if (!bannerAllowed || document.querySelector('.banner')) return;
  const b = el(`<div class="banner" role="status">
    ${icon('refresh', 30)}
    <span>A new version is ready</span>
    <button type="button" class="btn">Tap to refresh</button></div>`);
  b.querySelector('button').addEventListener('click', () => {
    updateAccepted = true;
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
  });
  document.body.appendChild(b);
}

/** Ask for persistent storage; returns true/false/null (unsupported). */
export async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted() {
  try {
    if (!navigator.storage || !navigator.storage.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

export async function storageEstimate() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
