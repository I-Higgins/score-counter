// Bits shared by several screens.
import { icon } from '../icons.js';
import { el, esc } from '../ui.js';

/** Header with a round back/close chip and a title. */
export function headHtml({ back = '#/', backLabel = 'Back', title, sub = '', right = '', close = false, titleId = 'page-title' }) {
  return `<header class="head">
    <a class="chip chip-round" href="${back}" aria-label="${esc(backLabel)}">${icon(close ? 'close' : 'back', 20)}</a>
    <div class="head-text"><h1 id="${titleId}">${esc(title)}</h1>${sub ? `<span class="head-sub">${esc(sub)}</span>` : ''}</div>
    ${right}
  </header>`;
}

export function errorState(title, text = 'Nothing has been deleted. This can happen in private browsing or when the phone is very low on storage.') {
  return el(`<main class="screen"><div class="empty-state" role="alert">${icon('file-error', 44)}
    <h1>${esc(title)}</h1><p>${esc(text)}</p>
    <a class="btn btn-primary btn-wide" href="#/">Back to the start</a></div></main>`);
}

export const dot = (color) => `<span class="dot" style="--pc: var(--p-${esc(color)})" aria-hidden="true"></span>`;

// A message for the next screen (e.g. "Round 5 saved · Undo").
let pendingFlash = null;
export function setFlash(f) { pendingFlash = f; }
export function takeFlash() { const f = pendingFlash; pendingFlash = null; return f; }

export function shortDate(ts) {
  return new Date(ts).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function monthYear(ts) {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-AU', sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' });
}
