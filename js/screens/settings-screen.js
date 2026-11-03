// Settings: text size, colours, sound, back up / restore, about.
// Add your app's own settings in the "Your app" panel (and to APP_DEFAULTS in settings.js).
import { APP_NAME, APP_VERSION } from '../config.js';
import { icon } from '../icons.js';
import { el, esc, switchHtml, bindSwitch, segHtml, bindSeg, openDialog, confirmDialog } from '../ui.js';
import { getSettings, setSettings, effectiveTheme } from '../settings.js';
import { buildBackup, restoreBackup, saveFile } from '../backup.js';

export function renderSettings(root, ctx) {
  const s = getSettings();
  const view = el(`<main class="screen settings">
    <header class="topbar">
      <a class="btn btn-quiet btn-player btn-back" href="#/">${icon('back', 26)}<span>Done</span></a>
      <h1 class="page-title">Settings</h1>
      <span></span>
    </header>
    <div class="settings-cols">
      <div>
        <section class="spanel" aria-labelledby="h-look">
          <h2 id="h-look">How it looks</h2>
          ${segHtml('size', 'Text size', [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']], s.textSize)}
          ${segHtml('theme', 'Colours', [['light', 'Light'], ['dark', 'Dark'], ['contrast', 'High contrast']], effectiveTheme())}
          <p class="small" data-theme-note>${s.theme ? '' : 'Following the iPad’s light or dark setting until you choose.'}</p>
        </section>
        <section class="spanel" aria-labelledby="h-sound">
          <h2 id="h-sound">Sound</h2>
          ${toggle('sound', 'Sounds', 'Soft sounds when something happens', s.sound)}
        </section>
      </div>
      <div>
        <section class="spanel" aria-labelledby="h-backup">
          <h2 id="h-backup">Back up</h2>
          <p class="about">Everything is saved on this iPad only. Deleting the app or clearing website data deletes it too, so save a backup somewhere safe, like iCloud Drive.</p>
          <p class="small" data-last>${lastBackupText(s.lastBackup)}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary btn-player" data-act="backup">${icon('back-up', 24)}<span>Back up</span></button>
            <button type="button" class="btn btn-quiet btn-player" data-act="restore">${icon('restore', 24)}<span>Restore</span></button>
          </div>
          <input type="file" accept=".zip,application/zip" hidden data-restore-input>
        </section>
        <section class="spanel" aria-labelledby="h-about">
          <h2 id="h-about">About</h2>
          <p class="about">${esc(APP_NAME)} is free and open source. Nothing you add leaves this device: there’s no account, no upload, no ads and no tracking.</p>
          <p class="small">Version ${esc(APP_VERSION)} · Works offline</p>
        </section>
      </div>
    </div>
  </main>`);

  bindSeg(view, 'size', (v) => setSettings({ textSize: v }));
  bindSeg(view, 'theme', (v) => { setSettings({ theme: v }); view.querySelector('[data-theme-note]').textContent = ''; });
  bindSwitch(view, 'sw-sound', (on) => setSettings({ sound: on }));
  view.querySelector('[data-act="backup"]').addEventListener('click', () => backupFlow(view));
  const input = view.querySelector('[data-restore-input]');
  view.querySelector('[data-act="restore"]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', () => input.files[0] && restoreFlow(input.files[0], ctx));
  root.replaceChildren(view);
}

function toggle(key, label, help, on) {
  return `<div class="toggle-row"><div><div class="row-label" id="lbl-${key}">${esc(label)}</div><div class="row-help">${esc(help)}</div></div>
    ${switchHtml('sw-' + key, 'lbl-' + key, on)}</div>`;
}

function lastBackupText(ts) {
  if (!ts) return 'No backup saved yet.';
  return `Last backup: ${new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

// Two steps on purpose: building can take a moment, and iPadOS only opens the
// share sheet straight from a tap, so the second tap opens it.
async function backupFlow(view) {
  const d = el(`<div aria-labelledby="bk-t"><h2 id="bk-t">Making a backup…</h2><div data-body><p>One moment.</p></div></div>`);
  const dlg = openDialog(d);
  const title = d.querySelector('h2');
  const body = d.querySelector('[data-body]');
  let built;
  try {
    built = await buildBackup();
  } catch {
    title.textContent = 'The backup couldn’t be made';
    body.innerHTML = `<p>Nothing was changed. Please try again.</p>
      <div class="row"><button type="button" class="btn btn-primary btn-dialog" data-r="0">OK</button></div>`;
    body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    return;
  }
  title.textContent = 'Backup ready';
  body.innerHTML = `<p>${esc(built.name)} is ready. Save it somewhere safe, away from this iPad if you can.</p>
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">${icon('share', 24)}<span>Save backup file</span></button></div>`;
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

async function restoreFlow(file, ctx) {
  const ok = await confirmDialog({
    title: 'Restore from this backup?',
    text: `Things in ${file.name} will be added back. Anything already here stays.`,
    action: 'Restore', icon: 'restore',
  });
  if (!ok) return;
  try {
    await restoreBackup(file);
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
