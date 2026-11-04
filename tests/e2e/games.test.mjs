// 0.2 flows: the new built-in games, How to play, notes, hiding games, the Phase 10
// phase tracker, Fishbowl's named rounds, Finish game, and adding new built-ins on update.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { availableBrowsers, server, newPage, axe, smallTargets, IPHONE, IPAD_PORTRAIT, IPAD_LANDSCAPE, quickGame, typeScore, playRound } from './helpers.mjs';

const browsers = await availableBrowsers();
let srv;
if (browsers.length) {
  before(async () => { srv = await server(); });
  after(() => srv && srv.close());
}

/** End a hand: tick who made their phase, type scores by name, save. */
async function phaseHand(page, scores, made = []) {
  await page.locator('[data-end]').click();
  await page.waitForSelector('.keypad');
  for (const n of made) await page.getByRole('button', { name: `${n} made phase` }).click();
  const rows = page.locator('.re-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const name = (await rows.nth(i).locator('strong').textContent()).trim();
    if (!(await rows.nth(i).evaluate((e) => e.classList.contains('on')))) await rows.nth(i).click();
    if (scores[name]) await typeScore(page, scores[name]);
    await page.locator('[data-next]').click();
  }
  await page.waitForFunction(() => !document.querySelector('.keypad'));
}

for (const { name, type } of browsers) {
  describe(`${name}: games`, () => {
    test('all nine built-ins are listed, each with How to play', async () => {
      const { browser, page, errors } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/new/quick');
        await page.waitForSelector('.game-row');
        const names = await page.locator('.game-row strong').allTextContents();
        for (const g of ['5 Crowns', 'Dutch Blitz', 'Phase 10', 'Skip-Bo', 'Uno', '500', 'President (Scum)', 'Fishbowl', 'Trash']) assert.ok(names.includes(g), `${g} in ${names}`);
        await page.getByRole('button', { name: 'How to play 500' }).click();
        const dlg = page.getByRole('dialog');
        await dlg.getByRole('heading', { name: 'Getting started' }).waitFor();
        await dlg.getByRole('table', { name: 'What each bid is worth' }).waitFor();
        const wiki = dlg.getByRole('link', { name: 'Full rules on Wikipedia' });
        assert.equal(await wiki.getAttribute('href'), 'https://en.wikipedia.org/wiki/500_(card_game)');
        assert.equal(await wiki.getAttribute('target'), '_blank');
        await dlg.getByRole('button', { name: 'Done' }).click();
        await page.waitForFunction(() => !document.querySelector('.scrim'));
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('notes: added in Edit, shown in How to play, there mid-game too', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/new/quick');
        await page.getByRole('link', { name: 'Edit Uno' }).click();
        await page.waitForSelector('#gnotes');
        await page.fill('#gnotes', 'Stacking Draw Twos is allowed.\nNo jump-ins.');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForFunction(() => location.hash === '#/new');
        await quickGame(page, srv.url, ['Ann', 'Ben'], 'Uno');
        await page.locator('[data-act="menu"]').click();
        await page.getByRole('button', { name: 'How to play Uno' }).click();
        const dlg = page.getByRole('dialog');
        await dlg.getByText('Stacking Draw Twos is allowed.').waitFor();
        await dlg.getByText('First to 500 wins.').waitFor();
      } finally { await browser.close(); }
    });

    test('hiding a game takes it out of New game but keeps it in Games', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/games');
        await page.getByRole('link', { name: 'Edit Skip-Bo' }).click();
        await page.getByRole('switch', { name: 'Show in New game' }).click();
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForFunction(() => location.hash === '#/games');
        await page.locator('.list-row', { hasText: 'Skip-Bo' }).getByText('Hidden').waitFor();
        await page.goto(srv.url + '#/new/quick');
        await page.waitForSelector('#app[data-route="/new/quick"] .game-row');
        assert.equal(await page.locator('.game-row', { hasText: 'Skip-Bo' }).count(), 0);
        await page.getByRole('link', { name: '1 hidden game · show or hide in Games' }).waitFor();
      } finally { await browser.close(); }
    });

    test('Phase 10: tick who made their phase; phases lead the order; finishing phase 10 ends it', async () => {
      const { browser, page, errors } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben', 'Cat'], 'Phase 10');
        await page.locator('.card', { hasText: 'Ann' }).locator('.c-phase', { hasText: 'Phase 1' }).waitFor();
        await phaseHand(page, { Ann: 50, Ben: 5, Cat: 0 }, ['Ann', 'Cat']);
        await page.locator('.card', { hasText: 'Ann' }).locator('.c-phase', { hasText: 'Phase 2' }).waitFor();
        // Cat and Ann made phase 1; Cat has fewer points. Ben is last despite only 5 points.
        await page.waitForFunction(() => [...document.querySelectorAll('.sc-list .c-name')].map((e) => e.textContent).join() === 'Cat,Ann,Ben');
        // Undo puts the phase back too, and reopens the hand as it was entered (ticks included).
        await page.locator('[data-act="undo"]').click();
        await page.locator('.card', { hasText: 'Ann' }).locator('.c-phase', { hasText: 'Phase 1' }).waitFor();
        await page.locator('[data-end]').click();
        assert.equal(await page.getByRole('button', { name: 'Ann made phase' }).getAttribute('aria-pressed'), 'true');
        await page.locator('[data-cancel]').click(); // cancelling clears the half-entered hand
        await page.waitForSelector('.sc-list .card');
        for (let i = 0; i < 10; i++) await phaseHand(page, { Ann: 5, Ben: 10 }, ['Ann', 'Ben']);
        await page.getByRole('heading', { name: 'Ann wins' }).waitFor();
        await page.getByText('10 of 10 phases · 50 points').waitFor();
        assert.deepEqual(await page.locator('table.full tfoot tr').first().locator('td').allTextContents(), ['10', '10', '0']);
        // Fix: take away Ann's phase in hand 10, so Ben (the only one on 10) wins.
        await page.getByRole('button', { name: 'Fix hand 10' }).click();
        await page.getByRole('button', { name: 'Made phase, Ann' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
        await page.getByRole('heading', { name: 'Ben wins' }).waitFor();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('Fishbowl: named rounds on the scoreboard, teams as players, over after round 3', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPAD_PORTRAIT });
      try {
        await quickGame(page, srv.url, ['Team A', 'Team B'], 'Fishbowl');
        await page.locator('.sc-round', { hasText: 'Round 1 of 3' }).getByText('Describe it').waitFor();
        await page.getByRole('button', { name: 'Plus one for Team B this round' }).click();
        await page.locator('[data-end]').click();
        await page.locator('[data-next]').click();
        await page.locator('[data-next]').click();
        await page.locator('.sc-round').getByText('One word').waitFor();
      } finally { await browser.close(); }
    });

    test('Finish game: a game with no end can be finished from the menu and counts', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], 'President (Scum)');
        await page.locator('.card', { hasText: 'Ben' }).locator('[data-quick]').click();
        await page.getByRole('button', { name: 'Plus 1 for Ben' }).click();
        await page.getByRole('button', { name: 'Done' }).click();
        await page.locator('[data-end]').click();
        await page.locator('[data-next]').click();
        await page.locator('[data-next]').click();
        await page.getByText('Hand saved').waitFor();
        await page.locator('[data-act="menu"]').click();
        await page.getByRole('button', { name: 'Finish game' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Finish game' }).click();
        await page.getByRole('heading', { name: 'Ben wins' }).waitFor();
      } finally { await browser.close(); }
    });

    test('Trash: everyone starts on 10, −1 each time you get out, down to 4 wins', async () => {
      const { browser, page, errors } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await quickGame(page, srv.url, ['Ann', 'Ben'], 'Trash');
        assert.deepEqual(await page.locator('.c-total').allTextContents(), ['10', '10']);
        await page.locator('[data-act="menu"]').click();
        await page.getByRole('button', { name: 'How to play Trash' }).click();
        const dlg = page.getByRole('dialog');
        await dlg.getByText('Everyone starts on 10.', { exact: false }).first().waitFor();
        assert.equal(await dlg.getByRole('link', { name: 'Full rules on Wikipedia' }).count(), 0, 'no article, so no link');
        await dlg.getByRole('button', { name: 'Done' }).click();
        await page.waitForFunction(() => !document.querySelector('.scrim'));
        // Ann gets out with the quick button, then by typing −1, five more times.
        await page.locator('.card', { hasText: 'Ann' }).locator('[data-quick]').click();
        await page.getByRole('button', { name: /^(Minus|−)\s?1 for Ann$/ }).click();
        await page.getByRole('button', { name: 'Done' }).click();
        await playRound(page, {});
        assert.deepEqual(await page.locator('.c-total').allTextContents(), ['9', '10'], 'Ann on 9 cards leads');
        for (let i = 0; i < 4; i++) await playRound(page, { Ann: -1 });
        assert.equal(await page.locator('.card', { hasText: 'Ann' }).locator('.c-total').textContent(), '5');
        await playRound(page, { Ann: -1 });
        await page.getByRole('heading', { name: 'Ann wins' }).waitFor();
        await page.getByRole('rowheader', { name: 'Start' }).waitFor();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('editor: a start score and a count-down target', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/games');
        await page.getByRole('link', { name: 'Edit Trash' }).click();
        const target = page.getByRole('textbox', { name: 'Target score' });
        assert.equal(await page.getByRole('textbox', { name: 'Start score' }).inputValue(), '10');
        assert.equal(await target.inputValue(), '4');
        await page.getByText('Counting down to this').waitFor();
        for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Lower target' }).click();
        assert.equal(await target.inputValue(), '0', 'counts down in ones');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForFunction(() => location.hash === '#/games');
        await page.getByRole('link', { name: 'Edit Trash' }).click();
        await target.fill('10');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.getByText('below the start score').waitFor();
      } finally { await browser.close(); }
    });

    test('accessibility of the new screens: How to play, Phase 10, named rounds, Games', async () => {
      const combos = [
        [IPHONE, { theme: 'dark', textSize: 'normal' }],
        [IPHONE, { theme: 'light', textSize: 'xl' }],
        [IPAD_PORTRAIT, { theme: 'contrast', textSize: 'large' }],
        [IPAD_LANDSCAPE, { theme: 'light', textSize: 'normal' }],
        [{ width: 844, height: 390 }, { theme: 'dark', textSize: 'normal' }],
      ];
      const problems = [];
      for (const [viewport, settings] of combos) {
        const { browser, page } = await newPage(type, srv.url, { viewport, settings });
        try {
          const label = `${settings.theme}/${settings.textSize} ${viewport.width}×${viewport.height}`;
          const check = async (where) => {
            for (const v of await axe(page)) problems.push(`${label} ${where}: ${v}`);
            for (const t of await smallTargets(page)) problems.push(`${label} ${where}: small target ${t}`);
          };
          await page.goto(srv.url + '#/games');
          await page.waitForSelector('#app[data-route="/games"] .list-row');
          await check('games');
          for (const g of ['500', 'Phase 10', 'Trash']) {
            await page.getByRole('button', { name: `How to play ${g}`, exact: true }).click();
            await page.getByRole('dialog').waitFor();
            await check(`how to play ${g}`);
            await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
            await page.waitForFunction(() => !document.querySelector('.scrim'));
          }
          await page.goto(srv.url + '#/game/preset-fishbowl');
          await page.waitForSelector('#gnames');
          await check('fishbowl editor');
          await page.goto(srv.url + '#/game/preset-trash');
          await page.getByText('Counting down to this').waitFor();
          await check('trash editor');
          await quickGame(page, srv.url, ['Ann', 'Ben', 'Cat'], 'Phase 10');
          await check('phase 10 scoreboard');
          await page.locator('[data-end]').click();
          await page.waitForSelector('.keypad');
          await page.getByRole('button', { name: 'Ann made phase' }).click();
          await check('phase 10 hand');
        } finally { await browser.close(); }
      }
      assert.deepEqual(problems, []);
    });

    test('an update adds new built-ins once, without bringing back deleted ones', async () => {
      const { browser, page } = await newPage(type, srv.url, { viewport: IPHONE });
      try {
        await page.goto(srv.url + '#/games');
        await page.waitForSelector('#app[data-route="/games"] .list-row');
        // Pretend this is a 0.1 install: only 5 Crowns was ever seeded (Dutch Blitz deleted), and Uno never existed.
        await page.evaluate(async () => {
          const data = await import('./js/data.js');
          await data.setApp({ seeded: true, seededIds: undefined });
          data.removeRecord('games', 'preset-dutch-blitz');
          data.removeRecord('games', 'preset-uno');
          await data.flush();
        });
        await page.reload();
        await page.goto(srv.url + '#/games');
        await page.waitForSelector('#app[data-route="/games"] .list-row');
        const names = await page.locator('.list-row strong').allTextContents();
        assert.ok(names.some((n) => n.startsWith('Uno')), 'Uno is new in 0.2, so it is added');
        assert.ok(!names.some((n) => n.startsWith('Dutch Blitz')), 'Dutch Blitz was deleted, so it stays gone');
        // Deleting a new one now keeps it deleted after another launch.
        await page.evaluate(async () => { const data = await import('./js/data.js'); data.removeRecord('games', 'preset-uno'); await data.flush(); });
        await page.reload();
        await page.goto(srv.url + '#/games');
        await page.waitForSelector('#app[data-route="/games"] .list-row');
        assert.ok(!(await page.locator('.list-row strong').allTextContents()).some((n) => n.startsWith('Uno')));
      } finally { await browser.close(); }
    });
  });
}
