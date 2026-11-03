// Add or edit a player (design screen 9). Two ways in:
//   #/player/:pid               a player in the current game (pid "new" adds one)
//   #/group/:gid/player/:pid    a player in a group
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc, confirmDialog, toast } from '../ui.js';
import { newId } from '../store.js';
import { errorState, headHtml, dot, setFlash } from './common.js';

export async function renderPlayer(root, ctx) {
  const inGame = !ctx.params.gid;
  let match = null; let group = null;
  try {
    if (inGame) {
      match = await data.currentMatch();
      if (!match) { location.replace('#/'); return; }
      await data.prepareUndo(match.id);
      group = match.groupId ? await data.getGroup(match.groupId) : null;
    } else {
      group = await data.getGroup(ctx.params.gid);
      if (!group) { root.replaceChildren(errorState('That group isn’t here any more')); return; }
    }
  } catch { root.replaceChildren(errorState('This player couldn’t be opened')); return; }

  const isNew = ctx.params.pid === 'new';
  const pool = inGame ? match.players : group.players;
  const existing = isNew ? null : pool.find((p) => p.id === ctx.params.pid);
  if (!isNew && !existing) { location.replace(inGame ? '#/' : `#/group/${encodeURIComponent(group.id)}/edit`); return; }
  const groupPlayer = existing && group ? group.players.find((p) => p.id === existing.id) : null;
  const p = existing ? { ...existing, name: (groupPlayer || existing).name } : { id: newId(), name: '', color: data.firstFreeColour(pool.map((x) => x.color)) };
  const back = inGame ? '#/' : ctx.prev === '/new' || (ctx.prev || '').startsWith('/new/') ? `#${ctx.prev}` : `#/group/${encodeURIComponent(group.id)}/edit`;
  const total = inGame && existing ? M.shownTotals(match)[p.id] : null;
  const benched = inGame && group ? group.players.filter((g) => !match.players.some((x) => x.id === g.id)) : [];

  const view = el(`<main class="screen player" aria-labelledby="page-title">
    ${headHtml({ back, backLabel: 'Back', title: isNew ? 'Add player' : 'Edit player' })}
    <div class="preview" aria-hidden="true"><span data-pv-name></span><span class="pv-score">${total === null ? '' : M.fmt(total)}</span></div>
    ${benched.length && isNew ? `<h2 class="label">From ${esc(group.name)}</h2>
      <div class="chips">${benched.map((b) => `<button type="button" class="pill pill-person" data-bench="${esc(b.id)}">${dot(b.color)}${esc(b.name)}</button>`).join('')}</div>
      <h2 class="label">Or someone new</h2>` : ''}
    <div class="field"><label class="label" for="pname">Name</label>
      <input id="pname" class="text-input" type="text" maxlength="${M.MAX_PLAYER_NAME}" autocomplete="off" enterkeyhint="done" value="${esc(p.name)}"></div>
    <div class="field" role="radiogroup" aria-labelledby="lbl-colour">
      <span class="label" id="lbl-colour">Colour</span>
      <div class="swatches">${M.PALETTE.map(([k, label]) => `<button type="button" role="radio" class="swatch" data-colour="${k}" aria-label="${label}" aria-checked="${k === p.color}" style="--pc: var(--p-${k})">${icon('check', 24)}</button>`).join('')}</div>
      <span class="note">Colours in use by others in this game are fine. Names tell players apart.</span>
    </div>
    <p class="field-msg" data-msg role="status"></p>
    <div class="grow"></div>
    ${inGame && existing && match.players.length > 1 ? '<button type="button" class="btn btn-secondary btn-wide" data-sitout>Sit out this game</button>' : ''}
    ${existing && group && (groupPlayer || !inGame) ? `<button type="button" class="btn btn-secondary btn-wide btn-danger-text" data-del>Delete from ${esc(group.name)}…</button>` : ''}
    <button type="button" class="btn btn-primary btn-end" data-done>${isNew ? 'Add player' : 'Done'}</button>
  </main>`);

  const nameIn = view.querySelector('#pname');
  const paint = () => {
    view.querySelector('.preview').style.setProperty('--pc', `var(--p-${p.color})`);
    view.querySelector('[data-pv-name]').textContent = nameIn.value.trim() || 'Name';
  };
  nameIn.addEventListener('input', paint);
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  view.querySelectorAll('[data-colour]').forEach((b) => b.addEventListener('click', () => {
    p.color = b.dataset.colour;
    view.querySelectorAll('[data-colour]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    paint();
  }));

  view.querySelectorAll('[data-bench]').forEach((b) => b.addEventListener('click', () => {
    const gp = group.players.find((x) => x.id === b.dataset.bench);
    data.change(match, (m) => ({ ...m, players: [...m.players, { id: gp.id, name: gp.name, color: gp.color }] }));
    setFlash({ text: `${gp.name} joined`, undoable: true });
    data.flush().then(() => { location.hash = '#/'; });
  }));

  async function done() {
    const name = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, M.MAX_PLAYER_NAME);
    if (!name) { view.querySelector('[data-msg]').textContent = 'Please type a name.'; nameIn.focus(); return; }
    const rec = { id: p.id, name, color: p.color };
    if (group && (!inGame || groupPlayer || isNew)) {
      const players = group.players.some((x) => x.id === rec.id)
        ? group.players.map((x) => (x.id === rec.id ? { ...x, ...rec } : x))
        : [...group.players, { ...rec, seat: group.players.length }];
      data.save('groups', { ...group, players });
      if (!inGame) await data.syncPlayerToCurrent(rec);
    }
    if (inGame) {
      if (isNew) {
        data.change(match, (m) => ({ ...m, players: [...m.players, rec] }));
        setFlash({ text: `${name} joined`, undoable: true });
      } else {
        data.change(match, (m) => ({ ...m, players: m.players.map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) }));
      }
    } else if (isNew) toast(`Added ${name}`);
    await data.flush();
    location.hash = back;
  }
  view.querySelector('[data-done]').addEventListener('click', done);

  view.querySelector('[data-sitout]')?.addEventListener('click', async () => {
    data.change(match, (m) => {
      const players = m.players.filter((x) => x.id !== p.id);
      const pending = { ...m.pending }; delete pending[p.id];
      const seat = m.players.findIndex((x) => x.id === p.id);
      const markerSeat = players.length ? (seat < (m.markerSeat % m.players.length) ? m.markerSeat - 1 : m.markerSeat) % players.length : 0;
      return { ...m, players, pending, markerSeat, entry: null };
    });
    setFlash({ text: `${p.name} is sitting out`, undoable: true });
    await data.flush();
    location.hash = '#/';
  });

  view.querySelector('[data-del]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Delete ${p.name} from ${group.name}?`, text: 'Past games keep their scores. This can’t be undone.', action: 'Delete', danger: true });
    if (!ok) return;
    data.save('groups', { ...group, players: group.players.filter((x) => x.id !== p.id).map((x, i) => ({ ...x, seat: i })) });
    if (inGame && match.players.length > 1) {
      data.change(match, (m) => ({ ...m, players: m.players.filter((x) => x.id !== p.id), entry: null }));
    }
    await data.flush();
    location.hash = inGame ? '#/' : `#/group/${encodeURIComponent(group.id)}/edit`;
  });

  paint();
  root.replaceChildren(view);
}
