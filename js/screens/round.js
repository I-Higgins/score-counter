// End round (design screens 2 and 16): confirm each player's round score on a keypad.
// The half-entered round is saved on every key, so a relaunch comes straight back here.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, announce } from '../ui.js';
import { setUpdateBannerAllowed } from '../pwa.js';
import { keepAwake } from '../wake.js';
import { errorState, setFlash } from './common.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '⌫'];

export async function renderRound(root, ctx) {
  let match;
  try {
    match = await data.currentMatch();
    if (match) await data.prepareUndo(match.id);
  } catch {
    root.replaceChildren(errorState('This round couldn’t be opened'));
    return;
  }
  if (!match || match.endedAt) { location.replace('#/'); return; }
  const group = match.groupId ? await data.getGroup(match.groupId).catch(() => null) : null;
  setUpdateBannerAllowed(false); // held back while a round is half-entered
  keepAwake(true);
  ctx.onLeave(() => keepAwake(false));

  const ids = match.players.map((p) => p.id);
  let entry = match.entry;
  if (!entry || !Array.isArray(entry.order) || entry.order.slice().sort().join() !== ids.slice().sort().join()) {
    const order = M.sortOrder(match.players, M.shownTotals(match), match.sort);
    const values = {};
    for (const id of order) values[id] = match.pending[id] ? String(match.pending[id]) : (id in match.pending ? '0' : '');
    entry = { order, values, sel: 0, fresh: true };
    match = data.change(match, (m) => ({ ...m, entry }), { undoable: false });
  }
  const totals = M.totals(match);
  const name = (id) => data.displayName(match, id, group);
  const colour = (id) => match.players.find((p) => p.id === id).color;
  const hand = !match.game.rounds.show;
  const title = M.endLabel(match);

  const view = el(`<main class="screen round" aria-labelledby="re-title">
    <header class="head">
      <a class="chip chip-round" href="#/" data-cancel aria-label="Cancel and go back">${icon('close', 20)}</a>
      <div class="head-text"><h1 id="re-title">${esc(title)}</h1>
        <span class="head-sub"><span class="sub-phone">Enter each player’s score for this ${hand ? 'hand' : 'round'}</span><span class="sub-tablet">Tap a player or use Next. Amounts tapped in during the ${hand ? 'hand' : 'round'} are already filled in.</span></span></div>
    </header>
    <div class="re-body">
      <ol class="re-rows" aria-label="${hand ? 'Hand' : 'Round'} scores"></ol>
      <div class="re-pad">
        <div class="re-for" aria-live="polite"><span>Entering for</span><strong data-for></strong></div>
        <div class="keypad" role="group" aria-label="Number pad">
          ${KEYS.map((k) => `<button type="button" class="key" data-k="${k}" aria-label="${k === '±' ? 'Make negative or positive' : k === '⌫' ? 'Delete' : k}">${k === '⌫' ? icon('backspace', 28) : k}</button>`).join('')}
        </div>
        <div class="re-grow"></div>
        <button type="button" class="btn btn-primary btn-end" data-next></button>
      </div>
    </div>
  </main>`);
  const rows = view.querySelector('.re-rows');

  function save() {
    match = data.change(match, (m) => ({ ...m, entry }), { undoable: false });
  }

  function paint() {
    rows.innerHTML = entry.order.map((id, i) => {
      const v = entry.values[id] || '';
      const n = M.entryValue(v);
      const on = i === entry.sel;
      return `<li><button type="button" class="re-row${on ? ' on' : ''}" data-i="${i}" aria-label="${esc(name(id))}, ${hand ? 'hand' : 'round'} score ${v === '' ? 'not entered' : esc(M.fmt(n))}${on ? ', editing' : ''}" aria-pressed="${on}">
        <span class="re-bar" style="--pc: var(--p-${esc(colour(id))})"></span>
        <span class="re-name"><strong>${esc(name(id))}</strong><span>Total ${M.fmt(totals[id])} → ${M.fmt(totals[id] + n)}</span></span>
        <span class="re-val">${v === '' ? '—' : esc(v.replace('-', '−'))}</span>
      </button></li>`;
    }).join('');
    const last = entry.sel >= entry.order.length - 1;
    const nextBtn = view.querySelector('[data-next]');
    if (!last) nextBtn.textContent = `Next: ${name(entry.order[entry.sel + 1])}`;
    else {
      const after = M.saveRound(match, {});
      const ends = !!after.endedAt || (match.game.end.kind === 'lastRound' && match.game.rounds.end != null && M.currentRoundNumber(match) >= match.game.rounds.end);
      nextBtn.textContent = hand ? 'Save hand' : ends ? 'Save round' : `Save round · start round ${M.currentRoundNumber(match) + 1}`;
    }
    view.querySelector('[data-for]').textContent = name(entry.order[entry.sel]);
  }

  // The first key on a newly selected row replaces its value (like a selected text
  // field), so typing 5 over a pre-filled −1 gives 5, not −15.
  function press(k) {
    const id = entry.order[entry.sel];
    const cur = entry.values[id] || '';
    const val = entry.fresh && /^\d$/.test(k) ? M.keyEntry('', k) : entry.fresh && k === '⌫' ? '' : M.keyEntry(cur, k);
    entry = { ...entry, fresh: false, values: { ...entry.values, [id]: val } };
    save();
    paint();
  }

  function next() {
    if (entry.sel < entry.order.length - 1) {
      entry = { ...entry, sel: entry.sel + 1, fresh: true };
      save();
      paint();
      announce(`Entering for ${name(entry.order[entry.sel])}`);
      rows.querySelector('.re-row.on')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const scores = Object.fromEntries(entry.order.map((id) => [id, M.entryValue(entry.values[id])]));
    const n = M.currentRoundNumber(match);
    match = data.change(match, (m) => M.saveRound(m, scores));
    if (match.endedAt) { location.hash = `#/match/${encodeURIComponent(match.id)}`; return; }
    setFlash({ text: hand ? 'Hand saved' : `Round ${n} saved`, undoable: true });
    location.hash = '#/';
  }

  rows.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    entry = { ...entry, sel: Number(b.dataset.i), fresh: true };
    save();
    paint();
  });
  view.querySelector('.keypad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) press(b.dataset.k);
  });
  view.querySelector('[data-next]').addEventListener('click', next);
  view.querySelector('[data-cancel]').addEventListener('click', (e) => {
    e.preventDefault();
    match = data.change(match, (m) => ({ ...m, entry: null }), { undoable: false });
    location.hash = '#/';
  });
  // A hardware keyboard works too.
  const onKey = (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('⌫');
    else if (e.key === '-') press('±');
    else if (e.key === 'Enter' && !e.target.closest('button, a')) next();
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  ctx.onLeave(() => document.removeEventListener('keydown', onKey));

  paint();
  root.replaceChildren(view);
}
