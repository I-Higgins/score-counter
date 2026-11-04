// End-to-end checks every app made from the template keeps passing (adapted to
// Score Counter): data survives reloads, settings, backup/restore, offline,
// updates and accessibility. The app's own flows are in score.test.mjs.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  availableBrowsers, server, newPage, waitForServiceWorker, axe, smallTargets,
  IPAD_LANDSCAPE, IPAD_PORTRAIT, IPHONE, quickGame, makeGroup, playRound,
} from './helpers.mjs';

const browsers = await availableBrowsers();
let srv;
if (browsers.length) {
  before(async () => { srv = await server(); });
  after(() => srv && srv.close());
} else {
  test('end-to-end tests', { skip: 'no Playwright browsers installed (npx playwright install chromium webkit)' }, () => {});
}

for (const { name, type } of browsers) {
  describe(name, () => {
    test('first launch loads with no errors; a game survives a reload', async () => {
      const { browser, page, errors } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.getByRole('heading', { name: 'Ready to keep score' }).waitFor();
        await quickGame(page, srv.url, ['Ann', 'Ben']);
        await page.getByRole('button', { name: 'Plus one for Ann this round' }).click();
        await page.locator('.card', { hasText: 'Ann' }).getByText('+1').waitFor();
        await page.waitForTimeout(300); // let the IndexedDB write commit; a reload in the same millisecond can drop it
        await page.reload();
        await page.locator('.card', { hasText: 'Ann' }).getByText('+1').waitFor();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('theme, text size and re-sort timing apply and are remembered', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        assert.equal(await page.getAttribute('html', 'data-theme'), 'dark', 'dark is the default');
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.getByRole('button', { name: 'Largest' }).click();
        await page.getByRole('button', { name: 'High contrast' }).click();
        await page.getByRole('button', { name: 'Relaxed' }).click();
        assert.equal(await page.getAttribute('html', 'data-text'), 'xl');
        assert.equal(await page.getAttribute('html', 'data-theme'), 'contrast');
        await page.reload();
        await page.waitForSelector('#app[data-route]');
        assert.equal(await page.getAttribute('html', 'data-text'), 'xl');
        assert.equal(await page.getAttribute('html', 'data-theme'), 'contrast');
        assert.equal(await page.getByRole('button', { name: 'Relaxed' }).getAttribute('aria-pressed'), 'true');
      } finally { await browser.close(); }
    });

    test('back up, delete, restore: everything comes back, and twice never duplicates', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        const gid = await makeGroup(page, srv.url, 'Family', ['Ann', 'Ben']);
        await page.locator('.game-row', { hasText: 'Dutch Blitz' }).click();
        await page.locator('[data-start]').click();
        await page.waitForSelector('.card');
        await playRound(page, { Ann: 120, Ben: 30 });
        await page.getByRole('heading', { name: 'Ann wins' }).waitFor();

        await page.goto(srv.url + '#/settings');
        await page.getByRole('button', { name: 'Back up to a file' }).click();
        const save = page.getByRole('button', { name: 'Save backup file' });
        await save.waitFor();
        const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
        const file = await download.path();
        await page.getByRole('heading', { name: 'Backup saved' }).waitFor();
        await page.getByRole('button', { name: 'Done' }).click();

        // Delete the group (and its history), then restore.
        await page.goto(srv.url + `#/group/${gid}/edit`);
        await page.getByRole('button', { name: 'Delete group…' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete group' }).click();
        await page.waitForFunction(() => location.hash === '#/groups');
        await page.getByText('No groups yet').waitFor();

        for (let i = 0; i < 2; i++) {
          await page.goto(srv.url + '#/settings');
          await page.locator('[data-restore-input]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: await readFile(file) });
          await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
          await page.getByRole('heading', { name: 'Restored' }).waitFor();
          await page.getByRole('button', { name: 'OK' }).click();
        }
        await page.goto(srv.url + '#/groups');
        await page.locator('.list-row', { hasText: 'Family' }).click();
        await page.locator('.list-row', { hasText: 'Ann won · 120' }).waitFor();
        assert.equal(await page.locator('.list-row', { hasText: 'won' }).count(), 1);
        // A hash-only goto returns before the screen renders: wait for it before counting.
        await page.goto(srv.url + '#/groups');
        await page.waitForSelector('#app[data-route="/groups"] .list-row');
        assert.equal(await page.locator('.list-row', { hasText: 'Family' }).count(), 1);
      } finally { await browser.close(); }
    });

    test('a file that isn’t a backup changes nothing', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Keep me']);
        await page.goto(srv.url + '#/settings');
        await page.locator('[data-restore-input]').setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip at all, sorry') });
        await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
        await page.getByRole('heading', { name: 'That file couldn’t be read' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.goto(srv.url + '#/');
        await page.locator('.c-name', { hasText: 'Keep me' }).waitFor();
      } finally { await browser.close(); }
    });

    test('loads and works offline after the first visit (aeroplane mode)', async () => {
      // Its own server, shut down after the first visit: the site is genuinely
      // unreachable, so everything must come from the service worker.
      const own = await server();
      const { browser, page } = await newPage(type, own.url, { viewport: IPHONE });
      try {
        await waitForServiceWorker(page);
        await own.close();
        await page.goto(own.url + '#/settings');
        await page.getByRole('heading', { name: 'Settings' }).waitFor();
        await quickGame(page, own.url, ['Offline Ann', 'Offline Ben'], 'Dutch Blitz');
        await playRound(page, { 'Offline Ann': 10 });
        await page.getByText('Hand saved').waitFor();
      } finally { await browser.close(); await own.close().catch(() => {}); }
    });

    test('a first install never shows the update banner', async () => {
      const own = await server();
      const { browser, page } = await newPage(type, own.url, { viewport: IPHONE });
      try {
        await waitForServiceWorker(page);
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.waitForTimeout(1500);
        assert.equal(await page.locator('.banner').count(), 0, 'no update exists, so no banner');
      } finally { await browser.close(); await own.close().catch(() => {}); }
    });

    test('a new version shows the banner; refreshing loads it', async () => {
      const own = await server();
      const { browser, page } = await newPage(type, own.url);
      try {
        await waitForServiceWorker(page);
        own.bump(); // pretend a new release was deployed
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.getByText('Update ready').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: 'Refresh' }).click();
        await page.waitForFunction(async () => (await caches.keys()).some((k) => k.endsWith('-test1')), null, { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('load');
        await page.waitForSelector('#app[data-route]');
        const keys = await page.evaluate(async () => caches.keys());
        assert.ok(keys.some((k) => k.endsWith('-test1')), `new cache missing: ${keys}`);
        assert.equal(keys.length, 1, `old caches not cleaned up: ${keys}`);
      } finally { await browser.close(); await own.close().catch(() => {}); }
    });

    test('the page itself never scrolls; only #app does, and only when content overflows', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben']);
        const state = () => page.evaluate(() => {
          const app = document.getElementById('app');
          return { page: document.scrollingElement.scrollHeight > innerHeight, app: app.scrollHeight > app.clientHeight };
        });
        assert.deepEqual(await state(), { page: false, app: false }, 'scoreboard fits: nothing scrolls');
        await page.goto(srv.url + '#/help');
        await page.waitForSelector('#app[data-route="/help"]');
        assert.deepEqual(await state(), { page: false, app: true }, 'long screens scroll inside #app');
        await page.locator('#app').evaluate((el) => { el.scrollTop = 500; });
        await page.goto(srv.url + '#/settings');
        await page.waitForSelector('#app[data-route="/settings"]');
        assert.equal(await page.locator('#app').evaluate((el) => el.scrollTop), 0, 'a new screen starts at the top');
      } finally { await browser.close(); }
    });

    test('accessibility: no WCAG A/AA problems and 44 px touch targets, on every screen, theme and size', async () => {
      const combos = [
        [IPHONE, { theme: 'dark', textSize: 'normal' }],
        [IPHONE, { theme: 'light', textSize: 'xl' }],
        [IPAD_PORTRAIT, { theme: 'contrast', textSize: 'large' }],
        [IPAD_LANDSCAPE, { theme: 'light', textSize: 'normal' }],
        [{ width: 844, height: 390 }, { theme: 'dark', textSize: 'normal' }],
      ];
      const problems = [];
      for (const [viewport, settings] of combos) {
        const { browser, page } = await newPage(type, srv.url, { viewport, settings: { ...settings, installDismissed: false } });
        try {
          const label = `${settings.theme}/${settings.textSize} ${viewport.width}×${viewport.height}`;
          const check = async (where) => {
            for (const v of await axe(page)) problems.push(`${label} ${where}: ${v}`);
            for (const t of await smallTargets(page)) problems.push(`${label} ${where}: small target ${t}`);
          };
          await check('first launch');
          const gid = await makeGroup(page, srv.url, 'Family', ['Ann', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay']);
          await check('new game');
          await page.locator('[data-start]').click();
          await page.waitForSelector('.card');
          await page.getByRole('button', { name: 'Plus one for Ann this round' }).click();
          await playRound(page, { Ann: 5, Ben: -3 });
          await page.getByRole('button', { name: 'Minus one for Cat this round' }).click();
          await check('scoreboard');
          await page.locator('[data-act="menu"]').click();
          await page.getByRole('dialog').waitFor();
          await check('menu');
          await page.goto(srv.url + '#/round');
          await page.waitForSelector('.keypad');
          await check('round entry');
          await page.locator('[data-cancel]').click();
          await page.waitForSelector('.card');
          const mid = await page.evaluate(() => document.querySelector('.sc-full').getAttribute('href'));
          for (const hash of [mid, '#/settings', '#/games', '#/game/preset-dutch-blitz', '#/groups', `#/group/${gid}`, `#/group/${gid}/edit`, '#/player/new', '#/help']) {
            await page.goto(srv.url + hash);
            await page.waitForSelector(`#app[data-route="${hash.slice(1)}"]`);
            await check(hash);
          }
        } finally { await browser.close(); }
      }
      assert.deepEqual(problems, []);
    });
  });
}
