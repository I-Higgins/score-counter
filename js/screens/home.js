// "/": the current game's scoreboard, its game-over screen, or first launch (design screen 10).
import * as data from '../data.js';
import { icon } from '../icons.js';
import { el } from '../ui.js';
import { getSettings, setSettings } from '../settings.js';
import { isStandalone } from '../pwa.js';
import { renderScore } from './score.js';
import { errorState } from './common.js';
import { restoreFlow } from './settings-screen.js';

export async function renderHome(root, ctx) {
  let match;
  try { match = await data.currentMatch(); } catch {
    root.replaceChildren(errorState('Your games couldn’t be opened'));
    return;
  }
  if (match && match.endedAt) { location.replace(`#/match/${encodeURIComponent(match.id)}`); return; }
  if (match) { await renderScore(root, ctx, match); return; }
  renderFirstLaunch(root, ctx);
}

export function installCard() {
  if (isStandalone() || getSettings().installDismissed) return '';
  return `<section class="install" aria-labelledby="h-install">
    <div class="install-top"><h2 id="h-install">Add Score Counter to your Home Screen</h2>
      <button type="button" class="chip chip-round chip-small" data-act="not-now" aria-label="Hide for now">${icon('close', 18)}</button></div>
    <p>It then works offline, and Safari won’t clear your scores and stats.</p>
    <ol>
      <li><span class="step-no">1</span><span>Tap Share <span class="share-ic" role="img" aria-label="Share icon">${icon('share', 18)}</span> in Safari’s toolbar</span></li>
      <li><span class="step-no">2</span><span>Choose <strong>Add to Home Screen</strong></span></li>
      <li><span class="step-no">3</span><span>Open it once from the new icon while online</span></li>
    </ol>
    <p class="note">The Home Screen app keeps its own data, separate from this tab. Back up here first if you’ve already played.</p>
  </section>`;
}
export function bindInstallCard(view) {
  view.querySelector('[data-act="not-now"]')?.addEventListener('click', (e) => {
    setSettings({ installDismissed: true });
    e.currentTarget.closest('.install').remove();
  });
}

function renderFirstLaunch(root, ctx) {
  const view = el(`<main class="screen first" aria-labelledby="page-title">
    <div class="first-top"><a class="chip chip-round" href="#/settings" aria-label="Settings">${icon('settings', 22)}</a></div>
    ${installCard()}
    <div class="grow"></div>
    <svg class="first-art" aria-hidden="true" width="160" height="140" viewBox="0 0 160 140">
      <rect x="10" y="10" width="140" height="34" rx="12" fill="var(--p-yellow)"/>
      <rect x="10" y="53" width="112" height="34" rx="12" fill="var(--p-orange)"/>
      <rect x="10" y="96" width="80" height="34" rx="12" fill="var(--p-pink)"/>
      <text x="134" y="34" font-size="20" font-weight="800" fill="var(--card-ink)" text-anchor="end">1</text>
      <text x="106" y="77" font-size="20" font-weight="800" fill="var(--card-ink)" text-anchor="end">2</text>
      <text x="74" y="120" font-size="20" font-weight="800" fill="var(--card-ink)" text-anchor="end">3</text>
    </svg>
    <h1 id="page-title">Ready to keep score</h1>
    <p class="lede">Free, no ads, and works offline. Everything stays on this phone.</p>
    <div class="grow"></div>
    <a class="btn btn-primary btn-end" href="#/group/new/edit">Create a group</a>
    <span class="note center">For people you play with often, like Family. Keeps stats.</span>
    <a class="btn btn-secondary btn-wide" href="#/new/quick">Quick game</a>
    <span class="note center">Just add names and play. Not saved to stats.</span>
    <button type="button" class="btn btn-text" data-restore>Restore from a backup</button>
    <input type="file" accept=".zip,application/zip" hidden data-restore-input>
  </main>`);
  bindInstallCard(view);
  const input = view.querySelector('[data-restore-input]');
  view.querySelector('[data-restore]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', () => input.files[0] && restoreFlow(input.files[0], ctx));
  root.replaceChildren(view);
}
