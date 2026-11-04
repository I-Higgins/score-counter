// Scoreboard (design screens 1, 15, 17, 18): grand totals, this-round amounts,
// debounced re-sort that never moves a row while a finger is down.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, announce, openSheet, toast } from '../ui.js';
import { getSettings, SORT_DELAYS, reducedMotion } from '../settings.js';
import { keepAwake } from '../wake.js';
import { errorState, takeFlash } from './common.js';

const SORT_LABELS = { asc: 'Lowest first', desc: 'Highest first', manual: 'Manual order' };
const NEXT_SORT = { asc: 'desc', desc: 'manual', manual: 'asc' };

export async function renderScore(root, ctx, match) {
  let group = null;
  try {
    group = match.groupId ? await data.getGroup(match.groupId) : null;
    await data.prepareUndo(match.id);
  } catch {
    root.replaceChildren(errorState('Your game couldn’t be opened'));
    return;
  }
  const settings = getSettings();
  const delay = SORT_DELAYS[settings.sortDelay] || 900;

  // Display order and ranks only change when a re-sort runs.
  let order = M.sortOrder(match.players, M.shownTotals(match), match.sort);
  let rankMap = {};
  let leadSet = new Set();
  let timer = null;
  let sortWaiting = false;
  let animatingUntil = 0;
  const fingers = new Set();

  const view = el(`<main class="screen score" aria-labelledby="sc-title">
    <h1 id="sc-title" class="sr-only"></h1>
    <header class="sc-top">
      <button type="button" class="chip chip-round" data-act="menu" aria-label="Menu">${icon('menu', 22)}</button>
      <a class="chip chip-game" href="#/new" data-game-chip>
        <span class="chip-game-text"><span class="chip-game-name"></span><span class="chip-game-sub"></span></span>${icon('chevron-down', 14)}
      </a>
      <button type="button" class="chip chip-round chip-sort" data-act="sort">${icon('sort', 22)}<span class="chip-sort-label"></span></button>
      <button type="button" class="chip chip-round" data-act="undo" aria-label="Undo last change">${icon('undo', 22)}</button>
      <a class="chip chip-round" href="#/player/new" aria-label="Add player">${icon('add', 22)}</a>
    </header>
    <section class="sc-round" aria-label="Round"></section>
    <div class="sc-sortline"><span data-sortline></span><span data-resorting></span></div>
    <ol class="sc-list" aria-label="Players"></ol>
    <section class="sc-sofar" aria-labelledby="sofar-h"><h2 id="sofar-h">This game so far</h2><div data-sofar></div></section>
    <div class="sc-actions">
      <a class="btn btn-secondary sc-full" href="#/match/${esc(match.id)}">Full table</a>
      <a class="btn btn-primary btn-end" href="#/round" data-end></a>
    </div>
  </main>`);
  const list = view.querySelector('.sc-list');

  function cardHtml(p) {
    const quick = match.game.quick.length > 0;
    const scoreInner = `<span class="c-total"></span><span class="c-rd"></span>`;
    return `<li class="card" data-id="${esc(p.id)}">
      <a class="c-head" href="#/player/${encodeURIComponent(p.id)}">
        <span class="c-rank" aria-hidden="true"></span>
        <span class="c-namewrap"><span class="c-name"></span><span class="c-badges" aria-hidden="true"></span></span>
      </a>
      <button type="button" class="plate" data-d="-1">${icon('minus', 26)}</button>
      ${quick ? `<button type="button" class="c-score c-score-btn" data-quick>${scoreInner}</button>` : `<div class="c-score">${scoreInner}</div>`}
      <button type="button" class="plate" data-d="1">${icon('plus', 26)}</button>
    </li>`;
  }

  function buildCards() {
    list.innerHTML = order.map((id) => cardHtml(match.players.find((p) => p.id === id))).join('');
  }

  function computeRanks() {
    const shown = M.shownTotals(match);
    rankMap = M.ranks(order, shown, match.sort);
    leadSet = new Set(M.leaders(match.players, shown, match.game.winner));
  }

  /** Update everything in place (no reordering). */
  function paint() {
    const shown = M.shownTotals(match);
    const marker = M.markerId(match);
    const markerWord = match.game.marker === 'dealer' ? 'Dealer' : 'First';
    const info = M.roundInfo(match);
    const name = (id) => data.displayName(match, id, group);
    const compact = M.isCompact(match.players.length, getSettings().textSize);
    list.classList.toggle('compact', compact);
    view.querySelector('#sc-title').textContent = `${match.game.name} scores`;
    view.querySelector('.chip-game-name').textContent = match.game.name;
    view.querySelector('.chip-game-sub').textContent = group ? group.name : 'Quick game';
    view.querySelector('[data-game-chip]').setAttribute('aria-label', `Change game. Current: ${match.game.name}${group ? ` with ${group.name}` : ''}`);
    view.querySelector('.chip-sort-label').textContent = SORT_LABELS[match.sort];
    view.querySelector('[data-act="sort"]').setAttribute('aria-label', `Sort order: ${SORT_LABELS[match.sort]}. Tap to change`);
    const undoBtn = view.querySelector('[data-act="undo"]');
    undoBtn.disabled = !data.canUndo(match.id);
    view.querySelector('[data-sortline]').textContent = `${SORT_LABELS[match.sort]} · totals include this round`;

    const strip = view.querySelector('.sc-round');
    strip.hidden = !info;
    if (info) {
      const markerText = marker ? `${esc(name(marker))} ${match.game.marker === 'dealer' ? 'deals' : 'goes first'}` : '';
      strip.innerHTML = `<span class="rs-n">Round ${info.n}${info.of ? ` <span class="muted">of ${info.of}</span>` : ''}</span>
        <span class="rs-detail">${[esc(info.detail), markerText ? `<span class="rs-marker">${markerText}</span>` : ''].filter(Boolean).join('<span class="rs-marker"> · </span>')}</span>`;
    }
    view.querySelector('[data-end]').innerHTML = `${esc(M.endLabel(match))}${icon('chevron-right', 20)}`;

    for (const li of list.children) {
      const id = li.dataset.id;
      const p = match.players.find((x) => x.id === id);
      const total = shown[id];
      const pend = match.pending[id] || 0;
      const nm = name(id);
      li.style.setProperty('--pc', `var(--p-${p.color})`);
      li.querySelector('.c-name').textContent = nm;
      li.querySelector('.c-rank').textContent = rankMap[id] ?? '';
      const lead = leadSet.has(id);
      const badges = [lead ? '<span class="badge badge-lead">Leading</span>' : '', id === marker ? `<span class="badge badge-mark">${markerWord === 'Dealer' ? 'Dealer' : 'First'}</span>` : ''].join('');
      const b = li.querySelector('.c-badges');
      if (b.innerHTML !== badges) b.innerHTML = badges;
      li.querySelector('.c-head').setAttribute('aria-label', `${nm}, position ${rankMap[id]}${lead ? ', leading' : ''}${id === marker ? (match.game.marker === 'dealer' ? ', dealer' : ', first player') : ''}. Edit player`);
      const t = li.querySelector('.c-total');
      t.textContent = M.fmt(total);
      t.classList.toggle('neg', total < 0);
      li.querySelector('.c-rd').innerHTML = pend ? `${esc(M.fmtSigned(pend))} <span class="rd-short">this rd</span><span class="rd-long">this round</span>` : '';
      const scoreText = `${M.fmt(total)} points${pend ? `, ${M.fmtSigned(pend)} this round` : ''}`;
      const sc = li.querySelector('.c-score');
      if (sc.matches('button')) sc.setAttribute('aria-label', `${nm}: ${scoreText}. Quick buttons`);
      else { sc.setAttribute('role', 'img'); sc.setAttribute('aria-label', `${nm}: ${scoreText}`); }
      li.querySelector('[data-d="-1"]').setAttribute('aria-label', `Minus one for ${nm} this round`);
      li.querySelector('[data-d="1"]').setAttribute('aria-label', `Plus one for ${nm} this round`);
    }
    const fresh = M.sortOrder(match.players, shown, match.sort);
    view.querySelector('[data-resorting]').textContent = timer && fresh.join() !== order.join() ? 'Re-sorting…' : '';
    paintSoFar(shown);
  }

  function paintSoFar(shown) {
    const name = (id) => data.displayName(match, id, group);
    const seats = match.players;
    const last = match.rounds.slice(-3);
    const totals = M.totals(match);
    const dot = (p) => `<span class="dot" style="--pc: var(--p-${p.color})"></span>`;
    const label = (r) => (match.game.rounds.show ? r.n : `Hand ${r.n}`);
    const curLabel = match.game.rounds.show ? `${M.currentRoundNumber(match)} so far` : 'This hand';
    // Portrait: rounds down, players across. Landscape: players down, last rounds across.
    const byRound = `<table class="mini mini-rounds"><thead><tr><th scope="col">Round</th>${seats.map((p) => `<th scope="col"><span class="th-name">${dot(p)}${esc(name(p.id))}</span></th>`).join('')}</tr></thead>
      <tbody>${last.map((r) => `<tr><th scope="row">${label(r)}</th>${seats.map((p) => `<td>${M.fmt(r.scores[p.id] || 0)}</td>`).join('')}</tr>`).join('')}
      <tr class="live"><th scope="row">${curLabel}</th>${seats.map((p) => `<td>${match.pending[p.id] ? M.fmt(match.pending[p.id]) : '·'}</td>`).join('')}</tr></tbody></table>`;
    const two = match.rounds.slice(-2);
    const byPlayer = `<table class="mini mini-players"><thead><tr><th scope="col">Player</th>${two.map((r) => `<th scope="col">${match.game.rounds.show ? `R${r.n}` : `H${r.n}`}</th>`).join('')}<th scope="col">Total</th></tr></thead>
      <tbody>${order.map((id) => seats.find((p) => p.id === id)).map((p) => `<tr><th scope="row"><span class="th-name">${dot(p)}${esc(name(p.id))}</span></th>${two.map((r) => `<td>${M.fmt(r.scores[p.id] || 0)}</td>`).join('')}<td class="strong">${M.fmt(totals[p.id])}</td></tr>`).join('')}</tbody></table>`;
    view.querySelector('[data-sofar]').innerHTML = byRound + byPlayer;
    void shown;
  }

  /** Re-sort now, with a FLIP move (or an in-place swap with reduced motion). */
  function reorder() {
    clearTimeout(timer); timer = null; sortWaiting = false;
    const shown = M.shownTotals(match);
    const next = M.sortOrder(match.players, shown, match.sort);
    const moved = next.filter((id, i) => order[i] !== id);
    order = next;
    computeRanks();
    if (moved.length) {
      const before = new Map([...list.children].map((li) => [li.dataset.id, li.getBoundingClientRect()]));
      const byId = new Map([...list.children].map((li) => [li.dataset.id, li]));
      for (const id of order) list.appendChild(byId.get(id));
      const still = reducedMotion();
      if (!still) {
        animatingUntil = performance.now() + 240;
        for (const li of list.children) {
          const a = before.get(li.dataset.id); const b = li.getBoundingClientRect();
          const dx = a.left - b.left; const dy = a.top - b.top;
          if (!dx && !dy) continue;
          li.style.transition = 'none';
          li.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        list.getBoundingClientRect();
        for (const li of list.children) { li.style.transition = ''; li.style.transform = ''; }
      }
      for (const id of moved) {
        const li = byId.get(id);
        li.classList.remove('moved'); void li.offsetWidth; li.classList.add('moved');
        setTimeout(() => li.classList.remove('moved'), 600 + 240);
      }
    }
    paint();
  }

  function scheduleSort() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (fingers.size) { sortWaiting = true; return; } // never reorder under a finger
      reorder();
    }, delay);
  }

  function bump(id, d) {
    match = data.change(match, (m) => M.bump(m, id, d));
    scheduleSort();
    paint();
    const shown = M.shownTotals(match);
    const pend = match.pending[id] || 0;
    announce(`${data.displayName(match, id, group)}: ${M.fmt(shown[id])}${pend ? `, ${M.fmtSigned(pend)} this round` : ''}`);
  }

  // ---- events ----
  const down = (e) => fingers.add(e.pointerId);
  const up = (e) => {
    fingers.delete(e.pointerId);
    if (!fingers.size && sortWaiting) reorder();
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  ctx.onLeave(() => {
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
    clearTimeout(timer);
    keepAwake(false);
  });

  list.addEventListener('click', (e) => {
    const plate = e.target.closest('.plate');
    const quick = e.target.closest('[data-quick]');
    if (!plate && !quick) return;
    if (performance.now() < animatingUntil) return; // shaky hands: ignore taps while rows move
    const id = e.target.closest('.card').dataset.id;
    if (plate) bump(id, Number(plate.dataset.d));
    else quickSheet(id);
  });

  view.querySelector('[data-act="undo"]').addEventListener('click', () => {
    const back = data.undo(match);
    if (!back) return;
    match = back;
    if (match.players.map((p) => p.id).sort().join() !== order.slice().sort().join()) {
      order = M.sortOrder(match.players, M.shownTotals(match), match.sort);
      buildCards();
    }
    reorder();
    announce('Undone');
  });

  view.querySelector('[data-act="sort"]').addEventListener('click', () => cycleSort());
  function cycleSort() {
    match = data.change(match, (m) => ({ ...m, sort: NEXT_SORT[m.sort] }));
    reorder();
    announce(SORT_LABELS[match.sort]);
  }

  view.querySelector('[data-act="menu"]').addEventListener('click', () => menuSheet());

  function menuSheet() {
    const item = (href, ic, text) => `<li><a class="menu-item" href="${href}">${icon(ic, 22)}<span>${esc(text)}</span>${icon('chevron-right', 16)}</a></li>`;
    const dlg = openSheet(`<h2 id="menu-t">Menu</h2>
      <ul class="menu-list">
        ${item('#/new', 'play', 'New game')}
        ${item(`#/match/${encodeURIComponent(match.id)}`, 'table', 'Full table')}
        <li><button type="button" class="menu-item" data-sort>${icon('sort', 22)}<span>Sort: ${esc(SORT_LABELS[match.sort])}</span></button></li>
        ${group ? item(`#/group/${encodeURIComponent(group.id)}`, 'people', `${group.name}: stats`) : ''}
        ${item('#/groups', 'people', 'Groups')}
        ${item('#/games', 'cards', 'Games')}
        ${item('#/settings', 'settings', 'Settings')}
      </ul>
      <button type="button" class="btn btn-secondary btn-wide" data-close>Close</button>`);
    dlg.el.setAttribute('aria-labelledby', 'menu-t');
    dlg.el.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    const s = dlg.el.querySelector('[data-sort]');
    s.addEventListener('click', () => { cycleSort(); s.querySelector('span').textContent = `Sort: ${SORT_LABELS[match.sort]}`; });
  }

  function quickSheet(id) {
    const nm = data.displayName(match, id, group);
    const dlg = openSheet(`<h2 id="q-t">${esc(nm)}</h2>
      <p class="q-now" data-now aria-live="polite"></p>
      <div class="quick-grid">${match.game.quick.map((q) => `<button type="button" class="key" data-q="${q}" aria-label="${q < 0 ? 'Minus' : 'Plus'} ${Math.abs(q)} for ${esc(nm)}">${esc(M.fmtSigned(q))}</button>`).join('')}</div>
      <button type="button" class="btn btn-primary btn-wide" data-close>Done</button>`);
    dlg.el.setAttribute('aria-labelledby', 'q-t');
    const now = () => {
      const pend = match.pending[id] || 0;
      dlg.el.querySelector('[data-now]').textContent = `This round: ${pend ? M.fmtSigned(pend) : '0'} · Total ${M.fmt(M.shownTotals(match)[id])}`;
    };
    now();
    dlg.el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { bump(id, Number(b.dataset.q)); now(); }));
    dlg.el.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  }

  buildCards();
  computeRanks();
  paint();
  root.replaceChildren(view);
  keepAwake(true);
  const flash = takeFlash();
  if (flash) {
    toast(flash.text, flash.undoable ? { action: 'Undo', onAction: () => {
      const back = data.undo(match);
      if (back) { data.flush().then(() => ctx.refresh()); announce('Undone'); }
    } } : {});
  }
}
