// "How to play" sheet for a game: our short guide (built-ins), the person's own
// notes, the rules as set up in this app, and a Wikipedia link for the full rules.
import * as M from '../model.js';
import { infoFor, wikiUrl } from '../game-info.js';
import { esc, openSheet } from '../ui.js';
import { icon } from '../icons.js';

const list = (items, tag = 'ul') => `<${tag} class="how-list">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</${tag}>`;

function tableHtml(t) {
  const cell = (c) => (Array.isArray(c) ? `<span aria-hidden="true">${esc(c[0])}</span><span class="sr-only">${esc(c[1])}</span>` : esc(c));
  return `<div class="how-table-wrap" tabindex="0" role="region" aria-label="${esc(t.caption)}"><table class="how-table"><caption>${esc(t.caption)}</caption>
    <thead><tr>${t.head.map((h) => `<th scope="col">${cell(h)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody>
  </table></div>${t.foot ? `<p class="note">${esc(t.foot)}</p>` : ''}`;
}

/** Open the sheet. `editHref` (optional) links to the game's editor, for the notes. */
export function showGameInfo(game, { editHref = null } = {}) {
  const info = infoFor(game);
  const notes = (game.notes || '').trim();
  const dlg = openSheet(`<div class="sheet-kicker">How to play</div><h2 id="how-t" tabindex="-1" autofocus>${esc(game.name)}</h2>
    ${info ? `<p>${esc(info.intro)}</p>
      <h3 class="how-h">Getting started</h3>${list(info.start, 'ol')}
      <h3 class="how-h">Scoring</h3>${list(info.scoring)}
      ${info.table ? tableHtml(info.table) : ''}
      ${info.phases ? `<h3 class="how-h">The ${info.phases.length} phases</h3>${list(info.phases, 'ol')}${info.phasesNote ? `<p class="note">${esc(info.phasesNote)}</p>` : ''}` : ''}` : ''}
    <h3 class="how-h">Your notes</h3>
    ${notes ? `<p class="how-notes">${esc(notes)}</p>` : `<p class="note">No notes yet. Add house rules or reminders in Edit.</p>`}
    <h3 class="how-h">Set up in this app</h3>
    <ul class="rules">${M.ruleRows(game).map(([k, v]) => `<li><span>${esc(k)}</span><strong>${esc(v)}</strong></li>`).join('')}</ul>
    ${wikiUrl(info) ? `<a class="btn btn-secondary btn-wide" href="${esc(wikiUrl(info))}" target="_blank" rel="noopener noreferrer" data-wiki>Full rules on Wikipedia</a>
      <p class="note center">Opens in your browser. Needs the internet.</p>` : ''}
    ${editHref ? `<a class="btn btn-secondary btn-wide" href="${esc(editHref)}" data-edit-notes>${notes ? 'Edit notes and rules' : 'Add notes'}</a>` : ''}
    <button type="button" class="btn btn-primary btn-wide" data-close>Done</button>`);
  dlg.el.setAttribute('aria-labelledby', 'how-t');
  dlg.el.classList.add('wide');
  dlg.el.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  return dlg;
}

/** A small "How to play" icon button for list rows. */
export function infoButtonHtml(game) {
  return `<button type="button" class="row-edit" data-info="${esc(game.id)}" aria-label="How to play ${esc(game.name)}">${icon('info', 22)}</button>`;
}
