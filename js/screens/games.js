// Games: every game type, plus importing a shared game file.
import * as M from '../model.js';
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el, esc } from '../ui.js';
import { errorState, headHtml } from './common.js';
import { showImport, badImport } from './import.js';

export async function renderGames(root) {
  let games;
  try { games = await data.listGames(); } catch { root.replaceChildren(errorState('Your games couldn’t be opened')); return; }
  const view = el(`<main class="screen games" aria-labelledby="page-title">
    ${headHtml({ back: '#/settings', backLabel: 'Back to settings', title: 'Games' })}
    <ul class="list-card">${games.map((g) => `<li><a class="list-row" href="#/game/${encodeURIComponent(g.id)}">
      <span class="game-text"><strong>${esc(g.name)}</strong><span>${esc(M.describeGame(g))}</span></span>${icon('chevron-right', 16)}</a></li>`).join('') || '<li class="list-empty">No games yet.</li>'}</ul>
    <a class="btn btn-dashed btn-wide" href="#/game/new">+ Create a game</a>
    <button type="button" class="btn btn-secondary btn-wide" data-import>${icon('restore', 22)}<span>Add a game from a file</span></button>
    <input type="file" accept=".json,application/json" hidden data-import-input>
    <p class="note">Someone sent you a game link? Just open it: you’ll be asked before anything is added.</p>
  </main>`);
  const input = view.querySelector('[data-import-input]');
  view.querySelector('[data-import]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      if (f.size > 20000) throw new Error('Too big');
      showImport(M.readShare(JSON.parse(await f.text())));
    } catch { badImport(); }
  });
  root.replaceChildren(view);
}
