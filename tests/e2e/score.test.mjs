// Score Counter's own flows: full 5 Crowns and Dutch Blitz games on an iPhone,
// sorting rules, exact resume after a relaunch, undo, sharing a game, and stats.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { availableBrowsers, server, newPage, IPHONE, IPAD_LANDSCAPE, quickGame, makeGroup, playRound, typeScore, order } from './helpers.mjs';
import { encodeShare, PRESETS } from '../../js/model.js';

const browsers = await availableBrowsers();
let srv;
if (browsers.length) {
  before(async () => { srv = await server(); });
  after(() => srv && srv.close());
}

for (const { name, type } of browsers) {
  describe(`${name}: scoring`, () => {
    test('a full 5 Crowns game on an iPhone: rounds 3–13, wild cards, dealer, game over, rematch', async () => {
      const { browser, page, errors } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben', 'Cat'], '5 Crowns');
        await page.locator('.sc-round', { hasText: 'Round 3 of 13' }).getByText('3 cards · 3s wild').waitFor();
        assert.equal(await page.locator('.card', { hasText: 'Ann' }).locator('.badge-mark').textContent(), 'Dealer');
        for (let r = 3; r <= 13; r++) {
          if (r === 11) await page.getByText('11 cards · Jacks wild').waitFor();
          await playRound(page, { Ann: r, Ben: 2 * r, Cat: r === 13 ? 100 : 0 });
        }
        await page.getByRole('heading', { name: 'Ann wins' }).waitFor();
        await page.getByText('lowest score wins').waitFor();
        assert.equal(await page.locator('table.full tbody tr').count(), 11);
        assert.deepEqual(await page.locator('table.full tfoot td').allTextContents(), ['88', '100', '176']);
        // Fix a score from the table: the winner is recomputed.
        await page.getByRole('button', { name: 'Fix round 3' }).click();
        await page.fill('#fix-' + await page.evaluate(() => document.querySelector('.fix-in').id.slice(4)), '90');
        await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
        await page.getByRole('heading', { name: 'Cat wins' }).waitFor(); // Ann 175, Ben 176, Cat 100
        await page.getByRole('button', { name: 'Rematch · same players' }).click();
        await page.locator('.sc-round', { hasText: 'Round 3 of 13' }).waitFor();
        assert.deepEqual(await page.locator('.c-total').allTextContents(), ['0', '0', '0']);
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('Dutch Blitz: no round counter, End hand, quick buttons, ends at the target', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], 'Dutch Blitz');
        assert.equal(await page.locator('.sc-round').isHidden(), true);
        await page.getByRole('link', { name: /End hand/ }).waitFor();
        await page.getByRole('button', { name: /^Ann: 0 points\. Quick buttons/ }).click();
        await page.getByRole('button', { name: 'Plus 10 for Ann' }).click();
        await page.getByRole('button', { name: 'Minus 2 for Ann' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
        await page.locator('.card', { hasText: 'Ann' }).getByText('+8').waitFor();
        await playRound(page, { Ben: 40 }); // Ann's +8 is pre-filled
        await page.getByText('Hand saved').waitFor();
        assert.deepEqual(await order(page), ['Ben', 'Ann']); // highest first
        await playRound(page, { Ann: 50, Ben: 61 });
        await page.getByRole('heading', { name: 'Ben wins' }).waitFor();
        await page.getByText('101 points · highest score wins').waitFor();
      } finally { await browser.close(); }
    });

    test('ties share the win and the rank (1, 1, 3)', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben', 'Cat'], 'Dutch Blitz');
        await playRound(page, { Ann: 20, Ben: 20, Cat: 5 });
        await page.waitForFunction(() => [...document.querySelectorAll('.c-rank')].map((e) => e.textContent).join() === '1,1,3');
        assert.equal(await page.locator('.badge-lead').count(), 2);
        await playRound(page, { Ann: 80, Ben: 80 });
        await page.getByRole('heading', { name: 'Ann & Ben tie' }).waitFor();
      } finally { await browser.close(); }
    });

    test('re-sort waits for the delay and never moves a row while a finger is down', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE, settings: { sortDelay: 'quick' } });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben', 'Cat'], 'Dutch Blitz');
        assert.deepEqual(await order(page), ['Ann', 'Ben', 'Cat']);
        const plus = page.getByRole('button', { name: 'Plus one for Cat this round' });
        await plus.click();
        await page.getByText('Re-sorting…').waitFor();
        assert.deepEqual(await order(page), ['Ann', 'Ben', 'Cat'], 'not straight away');
        await page.waitForFunction(() => document.querySelector('.c-name').textContent === 'Cat');
        // Finger down on Ben's plate after a tap: no reorder until it lifts.
        await page.getByRole('button', { name: 'Plus one for Ben this round' }).click();
        await page.getByRole('button', { name: 'Plus one for Ben this round' }).click();
        const box = await page.getByRole('button', { name: 'Plus one for Ann this round' }).boundingBox();
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.mouse.down();
        await page.waitForTimeout(1200);
        assert.deepEqual(await order(page), ['Cat', 'Ann', 'Ben'], 'frozen while touching');
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('.c-name').textContent === 'Ben');
        // Manual order is seat order.
        await page.getByRole('button', { name: /Sort order: Highest first/ }).click();
        await page.getByRole('button', { name: /Sort order: Manual order/ }).waitFor();
        assert.deepEqual(await order(page), ['Ann', 'Ben', 'Cat']);
      } finally { await browser.close(); }
    });

    test('force-quit mid-round loses nothing: the half-entered round and undo come back', async () => {
      const { browser, context, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], '5 Crowns');
        await page.getByRole('button', { name: 'Plus one for Ben this round' }).click();
        await playRound(page, { Ann: 7, Ben: 3 }); // Ben's pre-filled 1 is replaced by 3
        assert.deepEqual(await page.locator('.c-total').allTextContents(), ['3', '7']);
        await page.getByRole('button', { name: 'Plus one for Ann this round' }).click();
        await page.locator('[data-end]').click();
        await page.waitForSelector('.keypad');
        await page.locator('.re-row', { hasText: 'Ben' }).click();
        await typeScore(page, -12);

        // "Force-quit": a brand new page from the Home Screen start URL (no #).
        const url = srv.url;
        await page.close();
        const again = await context.newPage();
        await again.goto(url);
        await again.waitForSelector('.keypad');
        await again.locator('.re-row.on', { hasText: 'Ben' }).getByText('−12').waitFor();
        await again.locator('.re-row', { hasText: 'Ann' }).getByText('1', { exact: true }).waitFor();
        await again.locator('[data-cancel]').click();
        await again.waitForSelector('.card');
        // Undo survives the relaunch too: back past the +1, then past the saved round.
        await again.getByRole('button', { name: 'Undo last change' }).click();
        await again.waitForFunction(() => !document.body.textContent.includes('+1'));
        await again.getByRole('button', { name: 'Undo last change' }).click();
        await again.locator('.sc-round', { hasText: 'Round 3 of 13' }).waitFor();
        await again.locator('.card', { hasText: 'Ben' }).getByText('+1').waitFor();
      } finally { await browser.close(); }
    });

    test('negative totals are highlighted; 6 players use compact rows', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'], 'Dutch Blitz');
        assert.equal(await page.locator('.sc-list.compact').count(), 1);
        await page.getByRole('button', { name: 'Minus one for C3 this round' }).click();
        assert.equal(await page.locator('.c-total.neg').textContent(), '−1');
      } finally { await browser.close(); }
    });

    test('iPad landscape shows the sidebar with the round table', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPAD_LANDSCAPE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], '5 Crowns');
        await playRound(page, { Ann: 4, Ben: 9 });
        await page.locator('.mini-players').getByText('R3').waitFor();
        await page.getByText('Ben deals').waitFor();
      } finally { await browser.close(); }
    });
  });

  describe(`${name}: games, groups, sharing`, () => {
    test('a shared link always asks first, adds alongside on a name clash, and works offline', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        const shared = { ...PRESETS[1], name: 'Dutch Blitz', end: { kind: 'target', target: 150 } };
        await page.goto(srv.url + '#game=' + encodeShare(shared));
        const sheet = page.getByRole('dialog');
        await sheet.getByRole('heading', { name: 'Add “Dutch Blitz”?' }).waitFor();
        await sheet.getByText('First to 150').waitFor();
        await sheet.getByText('This one will be added alongside it.').waitFor();
        await sheet.getByRole('button', { name: 'Add game' }).click();
        await page.waitForSelector('[data-start]');
        assert.equal(await page.locator('.game-row', { hasText: 'Dutch Blitz' }).count(), 2);
        assert.equal(await page.locator('.game-row[aria-pressed="true"]', { hasText: 'first to 150' }).count(), 1);
        // "Not now" adds nothing; a broken link says so.
        await page.goto(srv.url + '#game=' + encodeShare({ ...shared, name: 'Nope' }));
        await page.getByRole('dialog').getByRole('button', { name: 'Not now' }).click();
        await page.goto(srv.url + '#game=abc');
        await page.getByRole('heading', { name: 'That game couldn’t be read' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.goto(srv.url + '#/games');
        await page.locator('.list-row').first().waitFor();
        assert.equal(await page.locator('.list-row', { hasText: 'Nope' }).count(), 0);
      } finally { await browser.close(); }
    });

    test('create, share, duplicate and delete a custom game', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/game/new');
        await page.fill('#gname', 'Uno (house rules)');
        await page.getByRole('button', { name: 'Lowest score' }).click();
        await page.getByRole('button', { name: 'At target' }).click();
        await page.fill('[data-in="target"]', '500');
        await page.getByRole('button', { name: 'Dealer' }).click();
        await page.getByRole('button', { name: 'Save' }).click();
        await page.locator('.game-row', { hasText: 'Uno (house rules)' }).getByText('Lowest wins · first to 500').waitFor();
        await page.getByRole('link', { name: 'Edit Uno (house rules)' }).click();
        await page.getByRole('button', { name: 'Share' }).click();
        const link = await page.locator('#sh-link').inputValue();
        assert.match(link, /#game=[A-Za-z0-9_-]+$/);
        assert.ok(!link.includes('Uno'), 'encoded, not plain text');
        await page.getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: 'Duplicate' }).click();
        await page.waitForFunction(() => document.querySelector('#gname')?.value === 'Uno (house rules) (copy)');
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
        await page.waitForSelector('[data-start]');
        assert.equal(await page.locator('.game-row', { hasText: '(copy)' }).count(), 0);
      } finally { await browser.close(); }
    });

    test('group stats count wins (shared on a tie); quick games are left out', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        const gid = await makeGroup(page, srv.url, 'Family', ['Ann', 'Ben']);
        await page.locator('.game-row', { hasText: 'Dutch Blitz' }).click();
        await page.locator('[data-start]').click();
        await page.waitForSelector('.card');
        await playRound(page, { Ann: 100, Ben: 100 });
        await page.getByRole('heading', { name: 'Ann & Ben tie' }).waitFor();
        await page.getByRole('button', { name: 'Rematch · same players' }).click();
        await page.waitForSelector('.card');
        await playRound(page, { Ann: 150, Ben: 10 });
        await quickGame(page, srv.url, ['Ann'], 'Dutch Blitz');
        await playRound(page, { Ann: 500 });
        await page.goto(srv.url + `#/group/${gid}`);
        await page.getByText('2 players · 2 games').waitFor();
        const row = (n) => page.locator('table.stats tbody tr', { hasText: n }).locator('td').allTextContents();
        assert.deepEqual(await row('Ann'), ['2', '100%', '125', '150']);
        assert.deepEqual(await row('Ben'), ['1', '50%', '55', '100']);
        await page.locator('.list-row', { hasText: 'Ann won · 150' }).click();
        await page.getByRole('heading', { name: 'Ann wins' }).waitFor();
      } finally { await browser.close(); }
    });

    test('players: add mid-game, rename, sit out', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], 'Dutch Blitz');
        await page.getByRole('link', { name: 'Add player' }).click();
        await page.fill('#pname', 'Cat');
        await page.getByRole('radio', { name: 'Teal' }).click();
        await page.getByRole('button', { name: 'Add player' }).click();
        await page.locator('.c-name', { hasText: 'Cat' }).waitFor();
        await page.getByRole('link', { name: /^Ben, position/ }).click();
        await page.fill('#pname', 'Benny');
        await page.getByRole('button', { name: 'Done' }).click();
        await page.locator('.c-name', { hasText: 'Benny' }).waitFor();
        await page.getByRole('link', { name: /^Ann, position/ }).click();
        await page.getByRole('button', { name: 'Sit out this game' }).click();
        await page.getByText('Ann is sitting out').waitFor();
        assert.deepEqual((await order(page)).sort(), ['Benny', 'Cat']);
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await page.locator('.c-name', { hasText: 'Ann' }).waitFor();
      } finally { await browser.close(); }
    });
  });
}
