// Settings (design screen 8): look, re-sort timing, manage, back up / restore, about.
import { APP_NAME, APP_VERSION } from '../config.js';
import { icon } from '../icons.js';
import { el, esc, segHtml, bindSeg, switchHtml, bindSwitch, openDialog, confirmDialog } from '../ui.js';
import { getSettings, setSettings } from '../settings.js';
import { buildBackup, restoreBackup, saveFile } from '../backup.js';
import * as data from '../data.js';
import { headHtml } from './common.js';
import { installCard, bindInstallCard } from './home.js';

export async function renderSettings(root, ctx) {
  const s = getSettings();
  let groups = []; let games = []; let current = null;
  try { [groups, games, current] = await Promise.all([data.listGroups(), data.listGames(), data.currentMatch()]); } catch { /* counts are optional */ }
  const view = el(`<main class="screen settings" aria-labelledby="page-title">
    ${headHtml({ back: '#/', backLabel: current ? 'Back to game' : 'Back', title: 'Settings' })}
    ${installCard()}
    <h2 class="label">Look</h2>
    <div class="panel">
      ${segHtml('theme', 'Theme', [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light'], ['contrast', 'High contrast']], s.theme || 'auto')}
      ${segHtml('size', 'Text size', [['normal', 'Standard'], ['large', 'Large'], ['xl', 'Largest']], s.textSize)}
      ${segHtml('delay', 'Re-sort after tapping', [['quick', 'Quick'], ['normal', 'Normal'], ['relaxed', 'Relaxed']], s.sortDelay)}
    </div>
    <h2 class="label">Manage</h2>
    <ul class="list-card">
      <li><a class="list-row" href="#/groups"><span>Groups</span><span class="row-meta">${groups.length}${icon('chevron-right', 14)}</span></a></li>
      <li><a class="list-row" href="#/games"><span>Games</span><span class="row-meta">${games.length}${icon('chevron-right', 14)}</span></a></li>
      <li class="list-row"><span id="lbl-awake">Keep screen on during a game</span>${switchHtml('sw-awake', 'lbl-awake', s.keepAwake)}</li>
      <li><a class="list-row" href="#/help"><span>Privacy and help</span><span class="row-meta">${icon('chevron-right', 14)}</span></a></li>
    </ul>
    <h2 class="label">Your data stays on this phone</h2>
    <div class="btn-pair">
      <button type="button" class="btn btn-primary" data-act="backup">Back up to a file</button>
      <button type="button" class="btn btn-secondary" data-act="restore">Restore</button>
    </div>
    <input type="file" accept=".zip,application/zip" hidden data-restore-input>
    <span class="note" data-last>${lastBackupText(s.lastBackup)}</span>
    <div class="grow"></div>
    <span class="note center">${esc(APP_NAME)} ${esc(APP_VERSION)} · Free and open source (MIT) · No ads, no tracking</span>
  </main>`);

  bindInstallCard(view);
  bindSeg(view, 'theme', (v) => setSettings({ theme: v === 'auto' ? null : v }));
  bindSeg(view, 'size', (v) => setSettings({ textSize: v }));
  bindSeg(view, 'delay', (v) => setSettings({ sortDelay: v }));
  bindSwitch(view, 'sw-awake', (on) => setSettings({ keepAwake: on }));
  view.querySelector('[data-act="backup"]').addEventListener('click', () => backupFlow(view));
  const input = view.querySelector('[data-restore-input]');
  view.querySelector('[data-act="restore"]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', () => input.files[0] && restoreFlow(input.files[0], ctx));
  root.replaceChildren(view);
}

function lastBackupText(ts) {
  const when = ts ? new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'never';
  return `Last backup: ${when}. Back up before changing phones or clearing Safari data.`;
}

// Two steps on purpose: building can take a moment, and iOS only opens the
// share sheet straight from a tap, so the second tap opens it.
async function backupFlow(view) {
  const d = el(`<div class="sheet-body" aria-labelledby="bk-t"><h2 id="bk-t">Making a backup…</h2><div data-body><p>One moment.</p></div></div>`);
  const dlg = openDialog(d);
  dlg.scrim.classList.add('scrim-sheet');
  const title = d.querySelector('h2');
  const body = d.querySelector('[data-body]');
  let built;
  try {
    await data.flush();
    built = await buildBackup();
  } catch {
    title.textContent = 'The backup couldn’t be made';
    body.innerHTML = `<p>Nothing was changed. Please try again.</p>
      <div class="row"><button type="button" class="btn btn-primary btn-dialog" data-r="0">OK</button></div>`;
    body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    return;
  }
  title.textContent = 'Backup ready';
  body.innerHTML = `<p>${esc(built.name)} is ready. Save it somewhere safe, like iCloud Drive.</p>
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">${icon('share', 22)}<span>Save backup file</span></button></div>`;
  body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  body.querySelector('[data-r="1"]').addEventListener('click', async () => {
    const r = await saveFile(built.blob, built.name);
    if (r === 'cancelled') return;
    const s = setSettings({ lastBackup: Date.now() });
    view.querySelector('[data-last]').textContent = lastBackupText(s.lastBackup);
    title.textContent = 'Backup saved';
    body.innerHTML = `<p>Keep ${esc(built.name)} somewhere safe.</p>
      <div class="row"><button type="button" class="btn btn-primary btn-dialog" data-r="0">Done</button></div>`;
    body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    body.querySelector('[data-r="0"]').focus();
  });
}

export async function restoreFlow(file, ctx) {
  const ok = await confirmDialog({
    title: 'Restore from this backup?',
    text: `Groups, games and history in ${file.name} will be added back. Anything already here stays.`,
    action: 'Restore', icon: 'restore',
  });
  if (!ok) return;
  try {
    await data.flush();
    await restoreBackup(file);
    data.resetCache();
    await confirmDialog({ title: 'Restored', text: 'Your backup has been put back.', cancel: null, action: 'OK', icon: 'check' });
    ctx.refresh();
  } catch {
    await confirmDialog({
      title: 'That file couldn’t be read',
      text: `Nothing was changed. Make sure it’s a backup file made by ${APP_NAME}.`,
      cancel: null, action: 'OK', icon: 'file-error', alert: true,
    });
  }
}

export function renderHelp(root) {
  const view = el(`<main class="screen help" aria-labelledby="page-title">
    ${headHtml({ back: '#/settings', backLabel: 'Back to settings', title: 'Privacy and help' })}
    <section class="panel prose"><h2>Privacy</h2>
      <p>Everything stays on this device. There’s no account, no server, no ads and no tracking. Shared game links carry only a game’s rules, after the # in the link, which browsers never send to a website.</p></section>
    <section class="panel prose"><h2>Keeping your scores safe</h2>
      <p>Scores are saved as you tap, so closing the app loses nothing. But deleting the app or clearing Safari’s website data deletes them too. Use <strong>Back up to a file</strong> now and then, and keep the file in iCloud Drive or Files.</p>
      <p>The Home Screen app keeps its own data, separate from Safari tabs.</p></section>
    <section class="panel prose"><h2>How scoring works</h2>
      <p>Tap + and − during a round to build each player’s “this round” amount. The big number always includes it. Tap <strong>End round</strong> to check each score on the keypad and save the round.</p>
      <p>The list re-sorts a moment after your last tap, and never while your finger is on the screen. Change the wait in Settings.</p>
      <p>Undo goes back one change at a time, even after closing the app.</p></section>
  </main>`);
  root.replaceChildren(view);
}
