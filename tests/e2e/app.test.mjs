// End-to-end checks every app made from this template should keep passing.
// Add your app's own flows in another file in this folder.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  availableBrowsers, server, newPage, waitForServiceWorker, axe, smallTargets,
  IPAD_LANDSCAPE, IPAD_PORTRAIT, IPHONE,
} from './helpers.mjs';

const browsers = await availableBrowsers();
let srv;
if (browsers.length) {
  before(async () => { srv = await server(); });
  after(() => srv && srv.close());
} else {
  test('end-to-end tests', { skip: 'no Playwright browsers installed (npx playwright install chromium webkit)' }, () => {});
}

async function addItem(page, text) {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.getByLabel('What would you like to add?').fill(text);
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.item-text', { hasText: text }).waitFor();
}

for (const { name, type } of browsers) {
  describe(name, () => {
    test('home loads with no errors; added things survive a reload', async () => {
      const { browser, page, errors } = await newPage(type, srv.url);
      try {
        await page.getByRole('heading', { level: 1 }).waitFor();
        await addItem(page, 'Buy bait');
        await page.reload();
        await page.locator('.item-text', { hasText: 'Buy bait' }).waitFor();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('text size and colours apply and are remembered', async () => {
      const { browser, page } = await newPage(type, srv.url);
      try {
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.getByRole('radio', { name: 'Extra large' }).click();
        await page.getByRole('radio', { name: 'High contrast' }).click();
        assert.equal(await page.getAttribute('html', 'data-text'), 'xl');
        assert.equal(await page.getAttribute('html', 'data-theme'), 'contrast');
        await page.reload();
        await page.waitForSelector('#app[data-route]');
        assert.equal(await page.getAttribute('html', 'data-text'), 'xl');
        assert.equal(await page.getAttribute('html', 'data-theme'), 'contrast');
      } finally { await browser.close(); }
    });

    test('back up, delete, restore: everything comes back', async () => {
      const { browser, page } = await newPage(type, srv.url);
      try {
        await addItem(page, 'Snapper rig');
        await addItem(page, 'Spare sinkers');
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.getByRole('button', { name: 'Back up' }).click();
        const save = page.getByRole('button', { name: 'Save backup file' });
        await save.waitFor();
        const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
        const file = await download.path();
        await page.getByRole('heading', { name: 'Backup saved' }).waitFor();
        await page.getByRole('button', { name: 'Done' }).click();
        await page.getByRole('link', { name: 'Done' }).click();

        // Delete everything, then restore.
        for (const t of ['Snapper rig', 'Spare sinkers']) {
          await page.getByRole('button', { name: `Remove ${t}` }).click();
          await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
          await page.locator('.item-text', { hasText: t }).waitFor({ state: 'detached' });
        }
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: await readFile(file) });
        await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
        await page.getByRole('heading', { name: 'Restored' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('link', { name: 'Done' }).click();
        await page.locator('.item-text', { hasText: 'Snapper rig' }).waitFor();
        await page.locator('.item-text', { hasText: 'Spare sinkers' }).waitFor();

        // Restoring again never duplicates.
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: await readFile(file) });
        await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('link', { name: 'Done' }).click();
        await page.locator('.item-text').first().waitFor();
        assert.equal(await page.locator('.item-text').count(), 2);
      } finally { await browser.close(); }
    });

    test('a file that isn’t a backup changes nothing', async () => {
      const { browser, page } = await newPage(type, srv.url);
      try {
        await addItem(page, 'Keep me');
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip at all, sorry') });
        await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
        await page.getByRole('heading', { name: 'That file couldn’t be read' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('link', { name: 'Done' }).click();
        await page.locator('.item-text', { hasText: 'Keep me' }).waitFor();
      } finally { await browser.close(); }
    });

    test('loads and works offline after the first visit', async () => {
      // Its own server, shut down after the first visit: the site is genuinely
      // unreachable, so everything must come from the service worker.
      const own = await server();
      const { browser, page } = await newPage(type, own.url);
      try {
        await waitForServiceWorker(page);
        await own.close();
        await page.goto(own.url + '#/settings');
        await page.getByRole('heading', { name: 'Settings' }).waitFor();
        await page.goto(own.url);
        await addItem(page, 'Works with Wi-Fi off');
      } finally { await browser.close(); await own.close().catch(() => {}); }
    });

    test('a new version shows the banner; refreshing loads it', async () => {
      const own = await server();
      const { browser, page } = await newPage(type, own.url);
      try {
        await waitForServiceWorker(page);
        own.bump(); // pretend a new release was deployed
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.getByText('A new version is ready').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: 'Tap to refresh' }).click();
        await page.waitForFunction(async () => (await caches.keys()).some((k) => k.endsWith('-test1')), null, { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('load');
        await page.waitForSelector('#app[data-route]');
        const keys = await page.evaluate(async () => caches.keys());
        assert.ok(keys.some((k) => k.endsWith('-test1')), `new cache missing: ${keys}`);
        assert.equal(keys.length, 1, `old caches not cleaned up: ${keys}`);
      } finally { await browser.close(); await own.close().catch(() => {}); }
    });

    test('accessibility: no WCAG A/AA problems and 44 px touch targets, in every theme and size', async () => {
      const combos = [
        [IPAD_LANDSCAPE, { theme: 'light', textSize: 'normal' }],
        [IPAD_PORTRAIT, { theme: 'dark', textSize: 'large' }],
        [IPAD_LANDSCAPE, { theme: 'contrast', textSize: 'xl' }],
        [IPHONE, { theme: 'light', textSize: 'xl' }],
      ];
      const problems = [];
      for (const [viewport, settings] of combos) {
        const { browser, page } = await newPage(type, srv.url, { viewport, settings: { ...settings, installDismissed: false } });
        try {
          await addItem(page, 'Something to check');
          for (const hash of ['#/', '#/settings']) {
            await page.goto(srv.url + hash);
            await page.waitForSelector(`#app[data-route="${hash.slice(1)}"]`);
            const label = `${settings.theme}/${settings.textSize} ${viewport.width}×${viewport.height} ${hash}`;
            for (const v of await axe(page)) problems.push(`${label}: ${v}`);
            for (const t of await smallTargets(page)) problems.push(`${label}: small target ${t}`);
          }
        } finally { await browser.close(); }
      }
      assert.deepEqual(problems, []);
    });
  });
}
