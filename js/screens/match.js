// Game over + full round-by-round table (design screen 3). Also the "Full table"
// for a game still being played, and past games from a group. Tap a round to fix it.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, openSheet, confirmDialog, announce } from '../ui.js';
import { errorState, headHtml, shortDate, dot } from './common.js';

export async function renderMatch(root, ctx) {
  let match; let group = null; let app;
  try {
    match = await data.getMatch(ctx.params.id);
    app = await data.getApp();
    if (match) {
      group = match.groupId ? await data.getGroup(match.groupId) : null;
      await data.prepareUndo(match.id);
    }
  } catch {
    root.replaceChildren(errorState('This game couldn’t be opened'));
    return;
  }
  if (!match) { root.replaceChildren(errorState('That game isn’t here any more', 'It may have been deleted.')); return; }
  const isCurrent = app.currentMatchId === match.id;
  const name = (id) => data.displayName(match, id, group);
  const t = M.totals(match);
  const ended = !!match.endedAt;
  const phased = M.hasPhases(match.game);
  const done = M.phasesDone(match);
  const players = ended
    ? M.sortOrder(match.players, t, M.defaultSort(match.game), M.phaseKey(match)).map((id) => match.players.find((p) => p.id === id))
    : match.players;
  const winIds = match.winnerIds || [];
  const hand = !match.game.rounds.show;
  const backHref = isCurrent && !ended ? '#/' : group ? `#/group/${encodeURIComponent(group.id)}` : '#/';

  let head;
  if (ended) {
    const w = winIds.map(name);
    const first = match.players.find((p) => p.id === winIds[0]);
    const wins = w.length > 1 ? `${w.slice(0, -1).join(', ')} & ${w.at(-1)} tie` : `${w[0] || 'Nobody'} wins`;
    head = `<div class="winner" style="--pc: var(--p-${esc(first ? first.color : 'silver')})">
      ${icon('crown', 40)}
      <div><h1 id="page-title">${esc(wins)}</h1>
      <span>${phased ? `${done[winIds[0]] ?? 0} of ${match.game.phases} phases · ${M.fmt(t[winIds[0]] ?? 0)} points` : `${M.fmt(t[winIds[0]] ?? 0)} points · ${match.game.winner === 'low' ? 'lowest' : 'highest'} score wins`}</span></div>
    </div>`;
  } else {
    head = headHtml({ back: backHref, backLabel: 'Back to the game', title: 'Full table', sub: `${match.game.name} · so far` });
  }
  const meta = [match.game.name, group ? group.name : 'Quick game', `${match.rounds.length} ${hand ? (match.rounds.length === 1 ? 'hand' : 'hands') : (match.rounds.length === 1 ? 'round' : 'rounds')}`, shortDate(match.startedAt)];
  if (match.early) meta.push('ended early');

  const view = el(`<main class="screen match" aria-labelledby="page-title">
    ${ended && !isCurrent ? `<div class="head head-back">${`<a class="chip chip-round" href="${backHref}" aria-label="Back">${icon('back', 20)}</a>`}</div>` : ''}
    ${head}
    ${ended ? `<span class="meta">${esc(meta.join(' · '))}</span>` : ''}
    ${match.rounds.length ? `<div class="table-card">
      <table class="full">
        <caption class="sr-only">${hand ? 'Hand' : 'Round'} by ${hand ? 'hand' : 'round'} scores</caption>
        <thead><tr><th scope="col" class="rd">${hand ? 'Hand' : 'Rd'}</th>${players.map((p) => `<th scope="col"><span class="th-name">${dot(p.color)}${esc(name(p.id))}</span></th>`).join('')}</tr></thead>
        <tbody>${M.startScore(match.game) ? `<tr class="start-row"><th scope="row" class="rd">Start</th>${players.map(() => `<td>${M.fmt(M.startScore(match.game))}</td>`).join('')}</tr>` : ''}${match.rounds.map((r, i) => `<tr>
          <th scope="row" class="rd"><button type="button" class="rd-btn" data-edit="${i}" aria-label="Fix ${hand ? 'hand' : 'round'} ${r.n}">${r.n}</button></th>
          ${players.map((p) => `<td class="${(r.scores[p.id] || 0) === 0 ? 'zero' : ''}">${M.fmt(r.scores[p.id] || 0)}${phased && (r.made || []).includes(p.id) ? `<span class="made" aria-hidden="true"> ✓</span><span class="sr-only">, made phase</span>` : ''}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot>${phased ? `<tr><th scope="row" class="rd">Phases</th>${players.map((p) => `<td>${done[p.id]}</td>`).join('')}</tr>` : ''}<tr><th scope="row" class="rd">Total</th>${players.map((p) => `<td class="${winIds.includes(p.id) ? 'win' : ''}"${winIds.includes(p.id) ? ` style="--pc: var(--p-${esc(p.color)})"` : ''}>${M.fmt(t[p.id])}</td>`).join('')}</tr></tfoot>
      </table></div>
      <span class="meta">${phased ? '✓ made their phase · ' : ''}Tap a ${hand ? 'hand' : 'round'} number to fix a score${players.length >= 5 ? ' · Swipe the table sideways for more players' : ''}</span>`
    : `<div class="empty-state"><p><strong>No ${hand ? 'hands' : 'rounds'} saved yet</strong>They’ll show here after you tap ${esc(M.endLabel(match))}.</p></div>`}
    <div class="grow"></div>
    <div class="stack">
      ${ended && isCurrent ? `<button type="button" class="btn btn-primary btn-end" data-act="rematch">Rematch · same players</button>
        <a class="btn btn-secondary btn-wide" href="#/new">New game</a>
        ${data.canUndo(match.id) ? `<button type="button" class="btn btn-text" data-act="undo">${icon('undo', 20)}<span>Undo last ${hand ? 'hand' : 'round'}</span></button>` : ''}` : ''}
      ${!isCurrent ? `<button type="button" class="btn btn-secondary btn-wide btn-danger-text" data-act="delete">Delete this game</button>` : ''}
      ${isCurrent && !ended ? `<a class="btn btn-primary btn-end" href="#/">Back to the game</a>` : ''}
    </div>
  </main>`);

  view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editRoundSheet(Number(b.dataset.edit))));

  function editRoundSheet(i) {
    const r = match.rounds[i];
    const word = hand ? 'hand' : 'round';
    const dlg = openSheet(`<h2 id="er-t">Fix ${word} ${r.n}</h2>
      <div class="fix-rows">${match.players.map((p) => `<div class="fix-row">
        <label for="fix-${esc(p.id)}">${dot(p.color)}<span>${esc(name(p.id))}</span></label>
        <button type="button" class="btn btn-secondary fix-sign" data-sign="${esc(p.id)}" aria-label="Make ${esc(name(p.id))}’s score negative or positive">±</button>
        <input class="text-input fix-in" id="fix-${esc(p.id)}" inputmode="numeric" autocomplete="off" maxlength="7" value="${esc(String(r.scores[p.id] || 0))}">
        ${phased ? `<button type="button" class="btn btn-secondary fix-made" data-made="${esc(p.id)}" aria-pressed="${(r.made || []).includes(p.id)}" aria-label="Made phase, ${esc(name(p.id))}">Made phase</button>` : ''}
      </div>`).join('')}</div>
      <p class="field-msg" data-msg role="status"></p>
      <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
      <button type="button" class="btn btn-primary btn-dialog" data-r="1">Save</button></div>`);
    dlg.el.setAttribute('aria-labelledby', 'er-t');
    dlg.el.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
      const input = dlg.el.querySelector(`#fix-${CSS.escape(b.dataset.sign)}`);
      const v = input.value.trim();
      input.value = v.startsWith('-') || v.startsWith('−') ? v.slice(1) : `-${v}`;
    }));
    dlg.el.querySelectorAll('[data-made]').forEach((b) => b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    }));
    dlg.el.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    dlg.el.querySelector('[data-r="1"]').addEventListener('click', () => {
      const scores = {};
      for (const p of match.players) {
        const raw = dlg.el.querySelector(`#fix-${CSS.escape(p.id)}`).value.trim().replace('−', '-');
        if (raw !== '' && !/^-?\d{1,6}$/.test(raw)) { dlg.el.querySelector('[data-msg]').textContent = `Please use whole numbers for ${name(p.id)}.`; return; }
        scores[p.id] = raw === '' || raw === '-' ? 0 : parseInt(raw, 10);
      }
      const made = phased ? [...dlg.el.querySelectorAll('[data-made][aria-pressed="true"]')].map((b) => b.dataset.made) : null;
      if (isCurrent) data.change(match, (m) => M.editRound(m, i, scores, made));
      else data.save('matches', M.editRound(match, i, scores, made));
      dlg.close();
      announce(`${word[0].toUpperCase()}${word.slice(1)} ${r.n} fixed`);
      data.flush().then(() => ctx.refresh());
    });
  }

  view.querySelector('[data-act="rematch"]')?.addEventListener('click', async () => {
    const latest = await data.getGame(match.game.id).catch(() => null);
    const players = group ? match.players.map((p) => group.players.find((g) => g.id === p.id) || p) : match.players;
    await data.startMatch({ game: latest || match.game, players, groupId: match.groupId });
    location.hash = '#/';
  });
  view.querySelector('[data-act="undo"]')?.addEventListener('click', async () => {
    data.undo(match);
    await data.flush();
    location.hash = '#/';
  });
  view.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete this game?', text: 'It will be removed from the history and stats. This can’t be undone.', action: 'Delete', danger: true });
    if (!ok) return;
    data.removeRecord('matches', match.id);
    await data.flush();
    location.hash = backHref;
  });

  root.replaceChildren(view);
}
