// Groups list, group stats + past games (design screen 6), and the group editor.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, segHtml, bindSeg, confirmDialog, toast } from '../ui.js';
import { newId } from '../store.js';
import { errorState, headHtml, dot, shortDate, monthYear } from './common.js';

export async function renderGroups(root) {
  let groups; let matches;
  try { [groups, matches] = await Promise.all([data.listGroups(), data.listMatches()]); } catch { root.replaceChildren(errorState('Your groups couldn’t be opened')); return; }
  const count = (g) => matches.filter((m) => M.countsForStats(m) && m.groupId === g.id).length;
  const view = el(`<main class="screen groups" aria-labelledby="page-title">
    ${headHtml({ back: '#/settings', backLabel: 'Back to settings', title: 'Groups' })}
    ${groups.length ? `<ul class="list-card">${groups.map((g) => `<li><a class="list-row" href="#/group/${encodeURIComponent(g.id)}">
      <span class="game-text"><strong>${esc(g.name)}</strong><span>${g.players.length} ${g.players.length === 1 ? 'player' : 'players'} · ${count(g)} ${count(g) === 1 ? 'game' : 'games'}</span></span>${icon('chevron-right', 16)}</a></li>`).join('')}</ul>`
    : `<div class="empty-state"><p><strong>No groups yet</strong>A group is the people you play with often, like Family. Groups keep stats.</p></div>`}
    <a class="btn btn-dashed btn-wide" href="#/group/new/edit">+ Create a group</a>
  </main>`);
  root.replaceChildren(view);
}

export async function renderGroup(root, ctx) {
  let group; let matches;
  try { [group, matches] = await Promise.all([data.getGroup(ctx.params.id), data.listMatches()]); } catch { root.replaceChildren(errorState('This group couldn’t be opened')); return; }
  if (!group) { root.replaceChildren(errorState('That group isn’t here any more', 'It may have been deleted.')); return; }
  const mine = matches.filter((m) => m.groupId === group.id && m.endedAt).sort((a, b) => b.endedAt - a.endedAt);
  const types = M.gameTypesPlayed(group, matches);
  let filter = types.length === 1 ? types[0].id : '';
  const counted = mine.filter(M.countsForStats);
  const since = counted.length ? ` since ${monthYear(Math.min(...counted.map((m) => m.startedAt)))}` : '';

  const view = el(`<main class="screen group" aria-labelledby="page-title">
    ${headHtml({ back: '#/groups', backLabel: 'Back to groups', title: group.name, sub: `${group.players.length} ${group.players.length === 1 ? 'player' : 'players'} · ${counted.length} ${counted.length === 1 ? 'game' : 'games'}${since}`, right: `<a class="chip chip-wide" href="#/group/${encodeURIComponent(group.id)}/edit">Edit</a>` })}
    ${types.length > 1 ? segHtml('filter', 'Show stats for', [['', 'All games'], ...types.map((t) => [t.id, t.name])], filter, { hideLabel: true }) : ''}
    <div class="table-card" data-stats></div>
    <h2 class="label">Past games</h2>
    ${mine.length ? `<ul class="list-card">${mine.map((m) => {
      const t = M.totals(m);
      const w = (m.winnerIds || []).map((id) => data.displayName(m, id, group));
      const who = w.length > 1 ? `${w.slice(0, -1).join(', ')} & ${w.at(-1)}` : w[0] || 'Nobody';
      const meta = [m.game.name, shortDate(m.startedAt), m.early ? 'ended early' : w.length > 1 ? 'tie' : `${m.players.length} players`];
      return `<li><a class="list-row" href="#/match/${encodeURIComponent(m.id)}"><span class="game-text"><strong>${esc(who)} won · ${M.fmt(t[m.winnerIds?.[0]] ?? 0)}</strong><span>${esc(meta.join(' · '))}</span></span>${icon('chevron-right', 16)}</a></li>`;
    }).join('')}</ul>` : `<div class="empty-state"><p><strong>No games yet</strong>Finished games with ${esc(group.name)} show here.</p></div>`}
    <a class="btn btn-primary btn-end" href="#/new/group-${encodeURIComponent(group.id)}">New game with ${esc(group.name)}</a>
  </main>`);

  function paintStats() {
    const s = M.statsFor(group, matches, filter || null);
    const label = filter ? types.find((t) => t.id === filter)?.name : 'All games';
    view.querySelector('[data-stats]').innerHTML = `<table class="stats">
      <caption class="sr-only">${esc(label)} stats for ${esc(group.name)}, ${s.games} ${s.games === 1 ? 'game' : 'games'}</caption>
      <thead><tr><th scope="col">Player</th><th scope="col">Wins</th><th scope="col">Win %</th><th scope="col">Avg</th><th scope="col">Best</th></tr></thead>
      <tbody>${s.rows.map((r) => `<tr><th scope="row"><span class="th-name">${dot(r.color)}${esc(r.name)}</span></th>
        <td class="strong">${r.wins}</td><td>${r.pct === null ? '—' : `${r.pct}%`}</td><td>${r.avg === null ? '—' : M.fmt(r.avg)}</td><td>${r.best === null ? '—' : M.fmt(r.best)}</td></tr>`).join('')}</tbody>
    </table>${s.games ? '' : '<p class="note table-note">Stats appear after your first finished game.</p>'}`;
  }
  if (types.length > 1) bindSeg(view, 'filter', (v) => { filter = v; paintStats(); });
  paintStats();
  root.replaceChildren(view);
}

export async function renderGroupEdit(root, ctx) {
  const isNew = ctx.params.id === 'new';
  let group;
  try { group = isNew ? { id: newId(), name: '', players: [], createdAt: Date.now() } : await data.getGroup(ctx.params.id); } catch { root.replaceChildren(errorState('This group couldn’t be opened')); return; }
  if (!group) { root.replaceChildren(errorState('That group isn’t here any more')); return; }
  const players = group.players.map((p) => ({ ...p }));
  const view = el(`<main class="screen group-edit" aria-labelledby="page-title">
    ${headHtml({ back: isNew ? '#/new' : `#/group/${encodeURIComponent(group.id)}`, backLabel: 'Back', title: isNew ? 'New group' : 'Edit group' })}
    <div class="field"><label class="label" for="grname">Group name</label>
      <input id="grname" class="text-input" type="text" maxlength="${M.MAX_NAME}" autocomplete="off" value="${esc(group.name)}" placeholder="For example, Family"></div>
    <h2 class="label">Players</h2>
    <ul class="list-card" data-players></ul>
    <div class="add-name"><label class="sr-only" for="gp-in">Add a player’s name</label>
      <input id="gp-in" class="text-input" type="text" maxlength="${M.MAX_PLAYER_NAME}" placeholder="Add a player" autocomplete="off" enterkeyhint="done">
      <button type="button" class="btn btn-secondary" data-add>Add</button></div>
    <p class="note">The same name in two groups is two different people.</p>
    <p class="field-msg" data-msg role="status"></p>
    <div class="grow"></div>
    ${isNew ? '' : '<button type="button" class="btn btn-secondary btn-wide btn-danger-text" data-del>Delete group…</button>'}
    <button type="button" class="btn btn-primary btn-end" data-save>${isNew ? 'Create group' : 'Save'}</button>
  </main>`);

  function paint() {
    view.querySelector('[data-players]').innerHTML = players.map((p, i) => `<li class="player-row">
      <span class="pr-name">${dot(p.color)}<span>${esc(p.name)}</span></span>
      ${isNew ? '' : `<a class="row-edit" href="#/group/${encodeURIComponent(group.id)}/player/${encodeURIComponent(p.id)}" aria-label="Edit ${esc(p.name)}">${icon('edit', 20)}</a>`}
      <button type="button" class="row-edit" data-up="${i}" aria-label="Move ${esc(p.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('back', 18, 'style="transform:rotate(90deg)"')}</button>
      ${isNew ? `<button type="button" class="row-edit danger" data-rm="${i}" aria-label="Remove ${esc(p.name)}">${icon('close', 18)}</button>` : ''}
    </li>`).join('') || '<li class="list-empty">No players yet. Add them below.</li>';
  }
  const add = () => {
    const input = view.querySelector('#gp-in');
    const nm = input.value.replace(/\s+/g, ' ').trim().slice(0, M.MAX_PLAYER_NAME);
    if (!nm) { input.focus(); return; }
    players.push({ id: newId(), name: nm, color: data.firstFreeColour(players.map((p) => p.color)), seat: players.length });
    input.value = '';
    paint();
    input.focus();
  };
  view.querySelector('[data-add]').addEventListener('click', add);
  view.querySelector('#gp-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  view.querySelector('[data-players]').addEventListener('click', (e) => {
    const up = e.target.closest('[data-up]');
    const rm = e.target.closest('[data-rm]');
    if (up) { const i = Number(up.dataset.up); [players[i - 1], players[i]] = [players[i], players[i - 1]]; paint(); }
    if (rm) { players.splice(Number(rm.dataset.rm), 1); paint(); }
  });

  async function persist() {
    const name = view.querySelector('#grname').value.replace(/\s+/g, ' ').trim().slice(0, M.MAX_NAME);
    if (!name) { view.querySelector('[data-msg]').textContent = 'Please give the group a name.'; view.querySelector('#grname').focus(); return null; }
    const rec = { ...group, name, players: players.map((p, i) => ({ ...p, seat: i })) };
    data.save('groups', rec);
    await data.flush();
    return rec;
  }
  view.querySelector('[data-save]').addEventListener('click', async () => {
    const rec = await persist();
    if (!rec) return;
    toast(isNew ? `Created ${rec.name}` : 'Saved');
    location.hash = isNew ? `#/new/group-${encodeURIComponent(rec.id)}` : `#/group/${encodeURIComponent(rec.id)}`;
  });
  view.querySelector('[data-del]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Delete ${group.name}?`, text: 'Its players, past games and stats will be deleted. This can’t be undone.', action: 'Delete group', danger: true });
    if (!ok) return;
    const matches = await data.listMatches();
    const app = await data.getApp();
    for (const m of matches) if (m.groupId === group.id && m.id !== app.currentMatchId) data.removeRecord('matches', m.id);
    data.removeRecord('groups', group.id);
    await data.flush();
    location.hash = '#/groups';
  });
  paint();
  root.replaceChildren(view);
}
