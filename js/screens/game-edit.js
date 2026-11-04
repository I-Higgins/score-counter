// Create or edit a game type (design screen 5), with share, duplicate and delete.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, segHtml, bindSeg, switchHtml, bindSwitch, openSheet, confirmDialog, toast } from '../ui.js';
import { newId } from '../store.js';
import { saveFile } from '../backup.js';
import { errorState, headHtml } from './common.js';

export async function renderGameEdit(root, ctx) {
  const isNew = ctx.params.id === 'new';
  let game;
  try {
    game = isNew ? { ...M.blankGame(), id: null } : await data.getGame(ctx.params.id);
  } catch { root.replaceChildren(errorState('This game couldn’t be opened')); return; }
  if (!game) { root.replaceChildren(errorState('That game isn’t here any more', 'It may have been deleted.')); return; }
  const g = JSON.parse(JSON.stringify(game));
  if (g.rounds.end == null) g.rounds.end = 10;
  let phaseCount = M.hasPhases(g) ? g.phases : 10;
  let shown = !g.hidden;
  const back = ctx.prev === '/games' ? '#/games' : '#/new';

  const view = el(`<main class="screen editor" aria-labelledby="page-title">
    ${headHtml({ back, backLabel: 'Back', title: isNew ? 'New game' : 'Edit game', right: isNew ? '' : `<button type="button" class="chip chip-wide" data-share>${icon('share', 18)}<span>Share</span></button>` })}
    <div class="field"><label class="label" for="gname">Name</label>
      <input id="gname" class="text-input" type="text" maxlength="${M.MAX_NAME}" autocomplete="off" value="${esc(g.name)}" placeholder="For example, Uno (house rules)"></div>
    <div class="panel">
      ${segHtml('winner', 'Winner has the', [['high', 'Highest score'], ['low', 'Lowest score']], g.winner)}
      ${segHtml('end', 'Game ends', [['target', 'At target'], ['lastRound', 'After last round'], ['none', 'Never']], g.end.kind)}
      ${segHtml('marker', 'Show each round', [['dealer', 'Dealer'], ['first', 'First player'], ['none', 'None']], g.marker)}
    </div>
    <div class="panel panel-rows">
      <div class="prow">
        <span class="prow-label"><span id="lbl-from">Start score</span><span class="prow-help">Everyone starts on this</span></span>
        ${stepper('from', M.startScore(g))}
      </div>
      <div class="prow" data-target-row>
        <span class="prow-label"><span id="lbl-target">Target score</span><span class="prow-help" data-target-help></span></span>
        ${stepper('target', g.end.target)}
      </div>
      <div class="prow">
        <span class="prow-label">Quick buttons</span>
        <div class="quick-chips" data-quick></div>
      </div>
      <div class="prow">
        <span class="prow-label"><span id="lbl-rounds">Round counter</span><span class="prow-help" data-rounds-help></span></span>
        ${switchHtml('sw-rounds', 'lbl-rounds', g.rounds.show)}
      </div>
      <div class="prow" data-range-row>
        <span class="prow-label" id="lbl-start" data-start-label>First round</span>
        ${stepper('start', g.rounds.start)}
      </div>
      <div class="prow" data-range-row>
        <span class="prow-label" id="lbl-last" data-last-label>Last round</span>
        ${stepper('last', g.rounds.end)}
      </div>
      <div class="prow prow-col" data-label-row>
        ${segHtml('label', 'Round label', [['number', 'Round number'], ['cardsWild', 'Cards and wild card'], ['named', 'Names']], g.rounds.label)}
      </div>
      <div class="prow prow-col" data-names-row>
        <label class="prow-label" for="gnames">Round names<span class="prow-help">In order, separated by commas</span></label>
        <input id="gnames" class="text-input" type="text" autocomplete="off" maxlength="600" value="${esc((g.rounds.names || []).join(', '))}" placeholder="For example, Describe it, One word, Act it out">
      </div>
    </div>
    <div class="panel panel-rows">
      <div class="prow">
        <span class="prow-label"><span id="lbl-phases-on">Phase tracker</span><span class="prow-help">Like Phase 10: most phases wins</span></span>
        ${switchHtml('sw-phases', 'lbl-phases-on', M.hasPhases(g))}
      </div>
      <div class="prow" data-phases-row>
        <span class="prow-label" id="lbl-phases">Number of phases</span>
        ${stepper('phases', phaseCount)}
      </div>
      <div class="prow">
        <span class="prow-label"><span id="lbl-shown">Show in New game</span><span class="prow-help">Off hides it from the list</span></span>
        ${switchHtml('sw-shown', 'lbl-shown', shown)}
      </div>
    </div>
    <div class="field"><label class="label" for="gnotes">Notes</label>
      <textarea id="gnotes" class="text-input notes-input" rows="4" maxlength="${M.MAX_NOTES}" placeholder="House rules or reminders. Shown in How to play.">${esc(g.notes || '')}</textarea></div>
    <p class="field-msg" data-msg role="status"></p>
    <div class="grow"></div>
    ${isNew ? '' : `<div class="btn-pair"><button type="button" class="btn btn-secondary" data-dup>Duplicate</button>
      <button type="button" class="btn btn-secondary btn-danger-text" data-del>Delete</button></div>`}
    <button type="button" class="btn btn-primary btn-end" data-save>Save</button>
  </main>`);

  function stepper(key, value) {
    const what = { last: 'last round', start: 'first round', target: 'target', phases: 'number of phases', from: 'start score' }[key];
    return `<div class="stepper"><button type="button" class="step" data-step="${key}" data-by="-1" aria-label="Lower ${what}">−</button>
      <input class="step-in" inputmode="numeric" data-in="${key}" aria-labelledby="lbl-${key}" value="${value}" maxlength="6">
      <button type="button" class="step" data-step="${key}" data-by="1" aria-label="Raise ${what}">+</button></div>`;
  }

  function readNum(key, fallback) {
    const v = parseInt(view.querySelector(`[data-in="${key}"]`).value.replace('−', '-'), 10);
    return Number.isFinite(v) ? v : fallback;
  }

  function paint() {
    view.querySelector('[data-target-row]').hidden = g.end.kind !== 'target';
    view.querySelector('[data-target-help]').textContent = readNum('target', 100) < readNum('from', 0) ? 'Counting down to this' : 'First to reach this';
    const ranged = g.rounds.show || g.end.kind === 'lastRound';
    view.querySelectorAll('[data-range-row]').forEach((r) => { r.hidden = !ranged; });
    view.querySelector('[data-label-row]').hidden = !g.rounds.show;
    view.querySelector('[data-names-row]').hidden = !g.rounds.show || g.rounds.label !== 'named';
    view.querySelector('[data-phases-row]').hidden = !M.hasPhases(g);
    const word = g.rounds.show ? 'round' : 'hand';
    view.querySelector('[data-start-label]').textContent = `First ${word}`;
    view.querySelector('[data-last-label]').textContent = `Last ${word}`;
    view.querySelector('[data-rounds-help]').textContent = g.rounds.show ? 'On · shown above the scores' : 'Off · rounds still saved to history';
    view.querySelector('[data-quick]').innerHTML = g.quick.map((q) => `<span class="qchip">${esc(M.fmtSigned(q))}</span>`).join('')
      + `<button type="button" class="qchip qchip-edit" data-edit-quick aria-label="Edit quick buttons">${g.quick.length ? icon('edit', 18) : '+'}</button>`;
  }

  bindSeg(view, 'winner', (v) => { g.winner = v; });
  bindSeg(view, 'end', (v) => { g.end.kind = v; paint(); });
  bindSeg(view, 'marker', (v) => { g.marker = v; });
  bindSeg(view, 'label', (v) => { g.rounds.label = v; paint(); });
  bindSwitch(view, 'sw-rounds', (on) => { g.rounds.show = on; paint(); });
  bindSwitch(view, 'sw-phases', (on) => { g.phases = on ? M.clampInt(readNum('phases', phaseCount), 1, M.MAX_PHASES) : null; paint(); });
  bindSwitch(view, 'sw-shown', (on) => { shown = on; });
  view.addEventListener('click', (e) => {
    const s = e.target.closest('[data-step]');
    if (!s) return;
    const key = s.dataset.step;
    // Big targets go up in tens; a count-down target (like Trash's) in ones.
    const tens = key === 'target' && readNum('target', 100) >= readNum('from', 0);
    const by = Number(s.dataset.by) * (tens ? 10 : 1);
    const input = view.querySelector(`[data-in="${key}"]`);
    const min = key === 'target' || key === 'from' ? -M.MAX_ABS : key === 'phases' ? 1 : key === 'start' ? 0 : readNum('start', 1);
    const max = key === 'target' || key === 'from' ? M.MAX_ABS : key === 'phases' ? M.MAX_PHASES : 999;
    input.value = String(M.clampInt(readNum(key, 0) + by, min, max));
    paint();
  });
  view.addEventListener('input', (e) => { if (e.target.closest('[data-in="target"], [data-in="from"]')) paint(); });
  view.querySelector('[data-quick]').addEventListener('click', (e) => { if (e.target.closest('[data-edit-quick]')) quickSheet(); });

  function quickSheet() {
    const dlg = openSheet(`<h2 id="qe-t">Quick buttons</h2>
      <p class="note">Shown when you tap a player’s score. Up to ${M.MAX_QUICK}.</p>
      <div class="quick-edit" data-list></div>
      <div class="add-name"><button type="button" class="btn btn-secondary fix-sign" data-sign aria-label="Make negative or positive">±</button>
        <label class="sr-only" for="qe-in">Amount</label><input id="qe-in" class="text-input" inputmode="numeric" maxlength="7" placeholder="Amount, like 5" autocomplete="off">
        <button type="button" class="btn btn-secondary" data-add>Add</button></div>
      <p class="field-msg" data-msg role="status"></p>
      <button type="button" class="btn btn-primary btn-wide" data-done>Done</button>`);
    dlg.el.setAttribute('aria-labelledby', 'qe-t');
    const list = dlg.el.querySelector('[data-list]');
    const paintList = () => {
      list.innerHTML = g.quick.map((q, i) => `<button type="button" class="qchip qchip-del" data-i="${i}" aria-label="Remove ${esc(M.fmtSigned(q))}">${esc(M.fmtSigned(q))} ${icon('close', 14)}</button>`).join('') || '<span class="note">None yet.</span>';
    };
    paintList();
    const input = dlg.el.querySelector('#qe-in');
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { g.quick.splice(Number(b.dataset.i), 1); paintList(); } });
    dlg.el.querySelector('[data-sign]').addEventListener('click', () => { const v = input.value; input.value = v.startsWith('-') ? v.slice(1) : `-${v}`; });
    const add = () => {
      const msg = dlg.el.querySelector('[data-msg]');
      const raw = input.value.trim().replace('−', '-');
      if (!/^-?\d{1,6}$/.test(raw) || parseInt(raw, 10) === 0) { msg.textContent = 'Type a whole number other than 0.'; return; }
      if (g.quick.length >= M.MAX_QUICK) { msg.textContent = `That’s the most (${M.MAX_QUICK}).`; return; }
      g.quick.push(parseInt(raw, 10)); input.value = ''; msg.textContent = ''; paintList();
    };
    dlg.el.querySelector('[data-add]').addEventListener('click', add);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    dlg.el.querySelector('[data-done]').addEventListener('click', () => { dlg.close(); paint(); });
  }

  function collect() {
    g.name = view.querySelector('#gname').value;
    g.end.target = readNum('target', 100);
    g.startScore = readNum('from', 0);
    g.rounds.start = readNum('start', 1);
    const ranged = g.rounds.show || g.end.kind === 'lastRound';
    g.rounds.end = ranged ? readNum('last', g.rounds.start) : null;
    if (g.rounds.label === 'named') g.rounds.names = view.querySelector('#gnames').value.split(',');
    else delete g.rounds.names;
    if (g.phases != null) { phaseCount = readNum('phases', phaseCount); g.phases = phaseCount; }
    g.notes = view.querySelector('#gnotes').value;
    try {
      return M.sanitiseGame(g);
    } catch (e) {
      const msgs = {
        'No name': 'Please give the game a name.', 'Bad last round': 'The last round must be the same as or after the first.',
        'Bad target': 'The target must be from 1, or below the start score to count down.', 'Bad start score': 'The start score must be a whole number.', 'Needs round names': 'Add the round names, separated by commas.',
        'Bad phases': `The number of phases must be from 1 to ${M.MAX_PHASES}.`,
      };
      view.querySelector('[data-msg]').textContent = msgs[e.message] || 'Please check the numbers.';
      return null;
    }
  }

  view.querySelector('[data-save]').addEventListener('click', async () => {
    const clean = collect();
    if (!clean) return;
    const rec = { ...clean, id: game.id || newId(), builtIn: !!game.builtIn, createdAt: game.createdAt || Date.now(), ...(shown ? {} : { hidden: true }) };
    data.save('games', rec);
    // The game in progress follows rule changes (e.g. a new target).
    const cur = await data.currentMatch().catch(() => null);
    if (cur && !cur.endedAt && cur.game.id === rec.id) data.save('matches', { ...cur, game: rec });
    if (isNew) await data.setApp({ lastGameId: rec.id });
    await data.flush();
    toast(`Saved ${rec.name}`);
    location.hash = back;
  });

  view.querySelector('[data-dup]')?.addEventListener('click', async () => {
    const clean = collect();
    if (!clean) return;
    const rec = { ...clean, name: `${clean.name} (copy)`.slice(0, M.MAX_NAME), id: newId(), builtIn: false, createdAt: Date.now() };
    data.save('games', rec);
    await data.flush();
    location.hash = `#/game/${encodeURIComponent(rec.id)}`;
  });

  view.querySelector('[data-del]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Delete “${game.name}”?`, text: 'Past games keep their scores. This can’t be undone.', action: 'Delete', danger: true });
    if (!ok) return;
    data.removeRecord('games', game.id);
    await data.flush();
    location.hash = back;
  });

  view.querySelector('[data-share]')?.addEventListener('click', () => {
    const clean = collect();
    if (clean) shareSheet(clean);
  });

  paint();
  root.replaceChildren(view);
}

/** Share a game as a link (rules after #, never sent to a server) or as a file. */
export function shareSheet(game) {
  const link = `${location.origin}${location.pathname}#game=${M.encodeShare(game)}`;
  const canShare = !!navigator.share;
  const dlg = openSheet(`<div class="sheet-kicker">Share</div><h2 id="sh-t">Share “${esc(game.name)}”</h2>
    <p class="privacy-note">The link holds only the rules and notes. No players, scores or history. It works offline once the app is installed.</p>
    <label class="sr-only" for="sh-link">Link</label>
    <input id="sh-link" class="text-input" readonly value="${esc(link)}">
    ${canShare ? '<button type="button" class="btn btn-primary btn-end" data-act="share">Share link</button>' : ''}
    <button type="button" class="btn ${canShare ? 'btn-secondary btn-wide' : 'btn-primary btn-end'}" data-act="copy">Copy link</button>
    <button type="button" class="btn btn-secondary btn-wide" data-act="file">Save as a file</button>
    <button type="button" class="btn btn-text" data-act="close">Close</button>
    <p class="note" data-msg role="status"></p>`);
  dlg.el.setAttribute('aria-labelledby', 'sh-t');
  const msg = dlg.el.querySelector('[data-msg]');
  dlg.el.querySelector('[data-act="close"]').addEventListener('click', () => dlg.close());
  dlg.el.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
    try { await navigator.share({ title: game.name, text: `${game.name}: rules for Score Counter`, url: link }); } catch { /* cancelled */ }
  });
  dlg.el.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    const input = dlg.el.querySelector('#sh-link');
    try { await navigator.clipboard.writeText(link); msg.textContent = 'Link copied.'; } catch {
      input.select(); msg.textContent = 'Select the link above and copy it.';
    }
  });
  dlg.el.querySelector('[data-act="file"]').addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(M.shareJson(game), null, 2)], { type: 'application/json' });
    const safe = game.name.replace(/[^\p{L}\p{N} ()-]+/gu, '').trim() || 'game';
    const r = await saveFile(blob, `${safe}.score-counter.json`, 'application/json');
    if (r !== 'cancelled') msg.textContent = 'File saved.';
  });
}
