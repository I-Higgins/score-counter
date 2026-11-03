// Shared game import (design screen 7). Always asks first; a name clash adds alongside.
import * as M from '../model.js';
import * as data from '../data.js';
import { newId } from '../store.js';
import { esc, openSheet, toast, confirmDialog } from '../ui.js';

export async function showImport(game) {
  let games = [];
  try { games = await data.listGames(); } catch { /* still offer the import */ }
  const clash = games.find((g) => g.name.toLowerCase() === game.name.toLowerCase());
  const dlg = openSheet(`<div class="sheet-kicker">Shared game</div>
    <h2 id="imp-t">Add “${esc(game.name)}”?</h2>
    <ul class="rules">${M.ruleRows(game).map(([k, v]) => `<li><span>${esc(k)}</span><strong>${esc(v)}</strong></li>`).join('')}</ul>
    <p class="privacy-note">Only the game’s rules are in this link. No players, scores or history. Nothing is sent anywhere.</p>
    ${clash ? `<p class="note">You already have “${esc(clash.name)}”. This one will be added alongside it.</p>` : ''}
    <button type="button" class="btn btn-primary btn-end" data-r="1">Add game</button>
    <button type="button" class="btn btn-secondary btn-wide" data-r="0">Not now</button>`);
  dlg.el.setAttribute('aria-labelledby', 'imp-t');
  dlg.el.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  dlg.el.querySelector('[data-r="1"]').addEventListener('click', async () => {
    const rec = { ...M.sanitiseGame(game), id: newId(), builtIn: false, createdAt: Date.now() };
    data.save('games', rec);
    await data.setApp({ lastGameId: rec.id });
    await data.flush();
    dlg.close();
    toast(`Added ${rec.name}`);
    location.hash = '#/new';
  });
}

export async function badImport() {
  await confirmDialog({
    title: 'That game couldn’t be read',
    text: 'The link or file may be cut short or from a newer version. Nothing was added.',
    cancel: null, action: 'OK', icon: 'file-error', alert: true,
  });
}
