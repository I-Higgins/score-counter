// EXAMPLE home screen: a simple list saved in IndexedDB, to show the patterns
// (install card, empty state, error state, dialogs, live announcements).
// Replace the list with your app's own home screen.
import { APP_NAME } from '../config.js';
import * as store from '../store.js';
import { icon } from '../icons.js';
import { el, esc, openDialog, confirmDialog, announce, appMark } from '../ui.js';
import { getSettings, setSettings } from '../settings.js';
import { isStandalone } from '../pwa.js';

export async function renderHome(root, ctx) {
  let items = null;
  try {
    items = (await store.list('items')).sort((a, b) => a.created - b.created);
  } catch {
    items = null; // shown as the friendly error state below
  }
  const s = getSettings();
  const showInstall = !isStandalone() && !s.installDismissed;

  const view = el(`<main class="screen home">
    <header class="home-head">
      <div class="brand">${appMark(52)}<h1>${esc(APP_NAME)}</h1></div>
      <nav class="home-actions" aria-label="More">
        <a class="btn btn-quiet btn-top" href="#/settings">${icon('settings', 24)}<span>Settings</span></a>
      </nav>
    </header>
    ${showInstall ? installCard() : ''}
    <section class="section" aria-labelledby="h-items">
      <div class="section-head">
        <h2 id="h-items">My list</h2>
        <button type="button" class="btn btn-primary btn-player" data-act="add" ${items ? '' : 'disabled'}>${icon('add', 26)}<span>Add</span></button>
      </div>
      ${items === null ? `<div class="empty-state" role="alert">${icon('file-error', 44)}
          <p><strong>Your list couldn’t be opened</strong>This can happen in private browsing or when the iPad is very low on storage. Nothing has been deleted.</p></div>`
        : items.length ? `<ul class="item-list">${items.map(itemRow).join('')}</ul>`
        : `<div class="empty-state"><p><strong>Nothing here yet</strong>Tap “Add” to make your first one.</p></div>`}
    </section>
  </main>`);

  view.querySelector('[data-act="not-now"]')?.addEventListener('click', (e) => {
    setSettings({ installDismissed: true });
    e.currentTarget.closest('.install').remove();
  });
  view.querySelector('[data-act="add"]')?.addEventListener('click', () => addDialog(ctx));
  view.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    const item = items.find((i) => i.id === b.dataset.delete);
    const ok = await confirmDialog({ title: `Remove “${item.text}”?`, text: 'This can’t be undone.', action: 'Remove', danger: true, icon: 'delete' });
    if (!ok) return;
    await store.remove('items', item.id);
    announce(`Removed ${item.text}`);
    ctx.refresh();
  }));
  root.replaceChildren(view);
}

function itemRow(item) {
  return `<li class="item-row"><span class="item-text">${esc(item.text)}</span>
    <button type="button" class="btn btn-danger-quiet btn-helper" data-delete="${esc(item.id)}" aria-label="Remove ${esc(item.text)}">${icon('delete', 22)}<span>Remove</span></button></li>`;
}

function installCard() {
  return `<section class="install" aria-labelledby="h-install">
    ${appMark(96)}
    <div class="body"><h2 id="h-install">Keep it on the Home Screen</h2>
      <ol>
        <li><span class="step-no">1</span><span>Tap Share <span class="share-ic">${icon('share', 26, 'style="vertical-align:-6px"')}</span> at the top of Safari</span></li>
        <li><span class="step-no">2</span><span>Choose “Add to Home Screen”</span></li>
        <li><span class="step-no">3</span><span>Open it once from the Home Screen while on Wi‑Fi. After that it works without internet.</span></li>
      </ol></div>
    <button type="button" class="btn btn-quiet" data-act="not-now">Not now</button>
  </section>`;
}

function addDialog(ctx) {
  const d = el(`<div aria-labelledby="add-t"><h2 id="add-t">Add to my list</h2>
    <label for="add-in">What would you like to add?</label>
    <input id="add-in" class="text-input" type="text" maxlength="80" autocomplete="off" enterkeyhint="done">
    <p class="field-msg" data-msg role="status"></p>
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">Add</button></div></div>`);
  const dlg = openDialog(d);
  const input = d.querySelector('input');
  const save = async () => {
    const text = input.value.trim();
    if (!text) { d.querySelector('[data-msg]').textContent = 'Please type something first.'; input.focus(); return; }
    try {
      await store.put('items', { id: store.newId(), text, created: Date.now() });
    } catch {
      d.querySelector('[data-msg]').textContent = 'That couldn’t be saved. The iPad may be low on storage.';
      return;
    }
    dlg.close();
    announce(`Added ${text}`);
    ctx.refresh();
  };
  d.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  d.querySelector('[data-r="1"]').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}
