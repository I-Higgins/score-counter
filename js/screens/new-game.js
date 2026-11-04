// New game (design screen 4): pick a group (or Quick game), who's playing, and the game.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc } from '../ui.js';
import { newId } from '../store.js';
import { errorState, headHtml, dot } from './common.js';

// Kept while hopping to the game editor or group editor and back.
const pick = { groupKey: undefined, off: new Set(), gameId: undefined, draftName: '' };

export async function renderNewGame(root, ctx) {
  let groups; let games; let app; let current;
  try {
    [groups, games, app, current] = await Promise.all([data.listGroups(), data.listGames(), data.getApp(), data.currentMatch()]);
  } catch {
    root.replaceChildren(errorState('Your games couldn’t be opened'));
    return;
  }
  if (ctx.params.mode === 'quick') pick.groupKey = 'quick';
  if (ctx.params.mode && ctx.params.mode.startsWith('group-')) pick.groupKey = ctx.params.mode.slice(6);
  if (pick.groupKey === undefined || (pick.groupKey !== 'quick' && !groups.some((g) => g.id === pick.groupKey))) {
    pick.groupKey = groups.some((g) => g.id === app.lastGroupId) ? app.lastGroupId : groups.length ? groups[0].id : 'quick';
  }
  if (!games.some((g) => g.id === pick.gameId)) pick.gameId = games.some((g) => g.id === app.lastGameId) ? app.lastGameId : games[0]?.id;
  const quickPlayers = app.quickPlayers || [];

  const active = current && !current.endedAt ? current : null;
  const view = el(`<main class="screen newgame" aria-labelledby="page-title">
    ${headHtml({ back: '#/', backLabel: active ? 'Back to current game' : 'Back', title: 'New game' })}
    <h2 class="label">Group</h2>
    <div class="chips" role="group" aria-label="Group" data-groups></div>
    <h2 class="label">Playing tonight</h2>
    <div class="chips" role="group" aria-label="Playing tonight" data-people></div>
    <div data-quick-add></div>
    <h2 class="label">Game</h2>
    <ul class="list-card" data-games></ul>
    <a class="btn btn-dashed btn-wide" href="#/game/new">+ Create a game</a>
    <div class="grow"></div>
    <span class="note" data-note></span>
    <button type="button" class="btn btn-primary btn-end" data-start></button>
  </main>`);

  function selectedGroup() { return groups.find((g) => g.id === pick.groupKey) || null; }
  function people() {
    const g = selectedGroup();
    if (g) return g.players.slice().sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
    return quickPlayers;
  }
  const playing = () => people().filter((p) => !pick.off.has(p.id));

  function paint() {
    const g = selectedGroup();
    view.querySelector('[data-groups]').innerHTML = groups.map((gr) => `<button type="button" class="pill" data-group="${esc(gr.id)}" aria-pressed="${gr.id === pick.groupKey}">${esc(gr.name)}</button>`).join('')
      + `<button type="button" class="pill" data-group="quick" aria-pressed="${pick.groupKey === 'quick'}">Quick game</button>`
      + `<a class="pill pill-dashed" href="#/group/new/edit" aria-label="New group">+ Group</a>`;
    const ps = people();
    view.querySelector('[data-people]').innerHTML = ps.map((p) => `<button type="button" class="pill pill-person" data-person="${esc(p.id)}" aria-pressed="${!pick.off.has(p.id)}">${dot(p.color)}${esc(p.name)}</button>`).join('')
      + (g ? `<a class="pill pill-dashed" href="#/group/${encodeURIComponent(g.id)}/player/new" aria-label="Add a player to ${esc(g.name)}">+ Player</a>` : '');
    const qa = view.querySelector('[data-quick-add]');
    qa.innerHTML = g ? '' : `<div class="add-name"><label class="sr-only" for="qa-in">Add a player’s name</label>
      <input id="qa-in" class="text-input" type="text" maxlength="${M.MAX_PLAYER_NAME}" placeholder="Add a name" autocomplete="off" enterkeyhint="done" value="${esc(pick.draftName)}">
      <button type="button" class="btn btn-secondary" data-add-name>Add</button></div>`;
    view.querySelector('[data-games]').innerHTML = games.map((gm) => `<li>
      <button type="button" class="game-row" data-game="${esc(gm.id)}" aria-pressed="${gm.id === pick.gameId}">
        <span class="radio" aria-hidden="true"></span>
        <span class="game-text"><strong>${esc(gm.name)}</strong><span>${esc(M.describeGame(gm))}</span></span>
      </button>
      <a class="row-edit" href="#/game/${encodeURIComponent(gm.id)}" aria-label="Edit ${esc(gm.name)}">${icon('edit', 20)}</a></li>`).join('')
      || '<li class="list-empty">No games yet. Create one below.</li>';
    const game = games.find((x) => x.id === pick.gameId);
    const n = playing().length;
    const start = view.querySelector('[data-start]');
    start.disabled = !game || n < 1;
    start.textContent = !game ? 'Pick a game' : n < 1 ? 'Add a player' : `Start ${game.name} · ${n} ${n === 1 ? 'player' : 'players'}`;
    const note = view.querySelector('[data-note]');
    note.textContent = active && active.rounds.length
      ? `Starting saves the current game to ${active.groupId ? `${groups.find((x) => x.id === active.groupId)?.name || 'the group'}’s` : 'your'} history`
      : g ? `Wins and scores count in ${g.name}’s stats` : 'Quick games aren’t counted in stats';
    if (!g && !ps.length) view.querySelector('[data-people]').innerHTML = '<span class="note">Add the players’ names below.</span>';
  }

  view.addEventListener('click', (e) => {
    const gb = e.target.closest('[data-group]');
    if (gb) { pick.groupKey = gb.dataset.group; pick.off.clear(); paint(); return; }
    const pb = e.target.closest('[data-person]');
    if (pb) { const id = pb.dataset.person; if (pick.off.has(id)) pick.off.delete(id); else pick.off.add(id); paint(); return; }
    const gm = e.target.closest('[data-game]');
    if (gm) { pick.gameId = gm.dataset.game; paint(); return; }
    if (e.target.closest('[data-add-name]')) addName();
  });
  view.addEventListener('input', (e) => { if (e.target.id === 'qa-in') pick.draftName = e.target.value; });
  view.addEventListener('keydown', (e) => { if (e.target.id === 'qa-in' && e.key === 'Enter') addName(); });

  function addName() {
    const input = view.querySelector('#qa-in');
    const nm = input.value.replace(/\s+/g, ' ').trim().slice(0, M.MAX_PLAYER_NAME);
    if (!nm) { input.focus(); return; }
    quickPlayers.push({ id: newId(), name: nm, color: data.firstFreeColour(quickPlayers.map((p) => p.color)) });
    while (quickPlayers.length > 12) quickPlayers.shift();
    pick.draftName = '';
    data.setApp({ quickPlayers });
    paint();
    view.querySelector('#qa-in').focus();
  }

  view.querySelector('[data-start]').addEventListener('click', async () => {
    const game = games.find((x) => x.id === pick.gameId);
    const players = playing();
    if (!game || !players.length) return;
    const g = selectedGroup();
    await data.startMatch({ game, players, groupId: g ? g.id : null });
    pick.off.clear();
    location.hash = '#/';
  });

  paint();
  root.replaceChildren(view);
}
