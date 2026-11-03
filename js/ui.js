// Small DOM helpers: escaping, dialogs (focus moves in, scrim never closes),
// a polite live region, and object-URL bookkeeping.

import { icon } from './icons.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- object URLs: revoked when the screen changes ----
let screenUrls = [];
export function objectUrl(blob) {
  const u = URL.createObjectURL(blob);
  screenUrls.push(u);
  return u;
}
/** Detach the current screen's URLs; call the returned function to revoke them. */
export function takeScreenUrls() {
  const old = screenUrls;
  screenUrls = [];
  return () => old.forEach((u) => URL.revokeObjectURL(u));
}

// ---- live region ----
export function announce(text) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}

// ---- dialogs ----
const stack = [];

/**
 * Open a modal dialog. `build(close)` returns the dialog element (role dialog).
 * Returns { close, el }. Tapping the scrim does nothing (by design).
 */
export function openDialog(dialogEl, { onClose, role = 'dialog' } = {}) {
  const scrim = el('<div class="scrim"></div>');
  dialogEl.setAttribute('role', dialogEl.getAttribute('role') || role);
  dialogEl.setAttribute('aria-modal', 'true');
  dialogEl.classList.add('dialog');
  scrim.appendChild(dialogEl);
  const previous = document.activeElement;
  document.body.appendChild(scrim);
  setInert(true);
  const entry = { scrim, previous };
  stack.push(entry);
  const focusFirst = () => {
    const f = dialogEl.querySelector('[autofocus], input, button, [href], [tabindex]:not([tabindex="-1"])');
    (f || dialogEl).focus({ preventScroll: true });
  };
  if (!dialogEl.hasAttribute('tabindex')) dialogEl.setAttribute('tabindex', '-1');
  requestAnimationFrame(focusFirst);
  scrim.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialogEl.querySelectorAll('input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scrim.remove();
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) setInert(false);
    if (previous && previous.isConnected && previous.focus) previous.focus({ preventScroll: true });
    onClose && onClose();
  };
  return { close, el: dialogEl, scrim };
}

export function closeAllDialogs() {
  while (stack.length) {
    const { scrim } = stack.pop();
    scrim.remove();
  }
  setInert(false);
}

function setInert(on) {
  const app = document.getElementById('app');
  if (!app) return;
  if (on) app.setAttribute('inert', ''); else app.removeAttribute('inert');
  app.setAttribute('aria-hidden', on ? 'true' : 'false');
  if (!on) app.removeAttribute('aria-hidden');
}

/** Simple two-button (or one-button) dialog. Resolves true for the action. */
export function confirmDialog({ title, text, cancel = 'Cancel', action = 'OK', danger = false, icon: ic, alert = false, wide = false }) {
  return new Promise((resolve) => {
    const d = el(`<div class="${wide ? 'wide' : ''} sheet-body" aria-labelledby="dlg-t">
      ${ic ? `<span class="dialog-icon">${icon(ic, 44)}</span>` : ''}
      <h2 id="dlg-t">${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <div class="row">
        ${cancel ? `<button type="button" class="btn btn-quiet btn-dialog" data-r="0">${esc(cancel)}</button>` : ''}
        <button type="button" class="btn ${danger ? 'btn-danger-quiet' : 'btn-primary'} btn-dialog" data-r="1">${esc(action)}</button>
      </div></div>`);
    let result = false;
    const dlg = openDialog(d, { role: alert ? 'alertdialog' : 'dialog', onClose: () => resolve(result) });
    dlg.scrim.classList.add('scrim-sheet');
    d.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { result = b.dataset.r === '1'; dlg.close(); }));
  });
}

/** Switch markup: role="switch" with the word On/Off beside it. */
export function switchHtml(id, labelId, on) {
  return `<span class="switch-wrap"><span class="switch-word" aria-hidden="true">${on ? 'On' : 'Off'}</span><button type="button" class="switch" role="switch" id="${id}" aria-checked="${on}" aria-labelledby="${labelId}"><span class="knob"></span></button></span>`;
}

export function bindSwitch(root, id, onChange) {
  const b = root.querySelector('#' + id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(on));
    b.previousElementSibling.textContent = on ? 'On' : 'Off';
    onChange(on, b);
  });
  return b;
}

/** Segmented control: real buttons with aria-pressed inside a labelled group (design spec). */
export function segHtml(name, label, options, value, { hideLabel = false } = {}) {
  return `<div class="seg-group"><span class="seg-label${hideLabel ? ' sr-only' : ''}" id="seg-${name}">${esc(label)}</span>
    <div class="seg" role="group" aria-labelledby="seg-${name}">
    ${options.map(([v, l]) => `<button type="button" data-seg="${name}" data-v="${esc(v)}" aria-pressed="${String(v) === String(value)}">${esc(l)}</button>`).join('')}
    </div></div>`;
}

export function bindSeg(root, name, onChange) {
  const btns = [...root.querySelectorAll(`[data-seg="${name}"]`)];
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onChange(b.dataset.v);
  }));
}

// ---- toast: one at a time, 5 s, optional Undo ----
let toastTimer = null;
export function toast(text, { action, onAction, ms = 5000 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = el(`<div class="toast" role="status"><span>${esc(text)}</span>${action ? `<button type="button" class="toast-btn">${esc(action)}</button>` : ''}</div>`);
  const close = () => { clearTimeout(toastTimer); t.remove(); };
  t.querySelector('button')?.addEventListener('click', () => { close(); onAction && onAction(); });
  document.body.appendChild(t);
  toastTimer = setTimeout(close, ms);
  return close;
}

/** A sheet: a dialog with a grabber, from the bottom on phones. `html` is the inner markup. */
export function openSheet(html, opts = {}) {
  const d = el(`<div class="sheet-body">${html}</div>`);
  const dlg = openDialog(d, opts);
  d.closest('.scrim').classList.add('scrim-sheet');
  return dlg;
}

/** The app mark (the same art as the app icon), sized for headers and the install card. */
export function appMark(size) {
  return `<img class="app-mark" src="assets/app/app-icon.svg" width="${size}" height="${size}" alt="">`;
}
