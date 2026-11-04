// Screenshot every screen at iPhone, iPhone landscape, iPad portrait and landscape,
// in each theme, into screenshots/ (git-ignored). Look at them and compare with design/.
// Usage: npm run screenshots   (SHOTS_THEMES=dark SHOTS_VIEWPORTS=iphone to narrow it)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { startServer } from './serve.mjs';
import { makeGroup, playRound } from '../tests/e2e/helpers.mjs';
import { encodeShare, PRESETS } from '../js/model.js';

const VIEWPORTS = { iphone: [390, 844], 'iphone-landscape': [844, 390], 'ipad-portrait': [820, 1180], 'ipad-landscape': [1180, 820] };
const THEMES = (process.env.SHOTS_THEMES || 'dark,light,contrast').split(',');
const ONLY = process.env.SHOTS_VIEWPORTS ? process.env.SHOTS_VIEWPORTS.split(',') : Object.keys(VIEWPORTS);
const APP_ID = readFileSync('js/config.js', 'utf8').match(/APP_ID = '([^']+)'/)[1];

await mkdir('screenshots', { recursive: true });
const srv = await startServer(0);
const url = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
for (const vpName of ONLY) {
  const [width, height] = VIEWPORTS[vpName];
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [`${APP_ID}:settings`, JSON.stringify({ theme, installDismissed: true })]);
    const page = await context.newPage();
    const shot = async (name) => {
      await page.waitForTimeout(350);
      const file = `screenshots/${vpName}-${theme}-${name}.png`;
      await page.screenshot({ path: file });
      console.log('wrote', file);
    };
    await page.goto(url);
    await page.waitForSelector('#app[data-route]');
    await shot('01-first-launch');
    const gid = await makeGroup(page, url, 'Family', ['Rosa', 'Theo', 'Priya', 'Oscar', 'Platypus']);
    await page.locator('[data-person]').last().click(); // Platypus sits this one out
    await shot('04-new-game');
    await page.locator('[data-person]').last().click();
    await page.locator('[data-start]').click();
    await page.waitForSelector('.card');
    await playRound(page, { Rosa: 8, Theo: 0, Priya: 12, Oscar: 3, Platypus: -2 });
    await playRound(page, { Rosa: 6, Theo: 9, Priya: 10, Oscar: 6, Platypus: -2 });
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Plus one for Theo this round' }).click();
    await page.waitForTimeout(1200);
    await shot('01-scoreboard');
    await page.locator('[data-act="menu"]').click();
    await shot('01b-menu');
    await page.goto(url + '#/round');
    await page.waitForSelector('.keypad');
    await page.locator('.re-row', { hasText: 'Rosa' }).click();
    await page.locator('[data-k="1"]').click(); await page.locator('[data-k="2"]').click();
    await page.locator('.re-row', { hasText: 'Priya' }).click();
    await shot('02-round-entry');
    await page.locator('[data-cancel]').click();
    await page.waitForSelector('.card');
    const mid = await page.evaluate(() => document.querySelector('.sc-full').getAttribute('href'));
    await page.goto(url + mid);
    await shot('03b-full-table');
    await page.goto(url + '#/');
    await page.waitForSelector('.card');
    await page.getByRole('link', { name: /^Theo, position/ }).click();
    await page.waitForSelector('.swatches');
    await shot('09-player-edit');
    await page.goto(url + '#/game/preset-dutch-blitz');
    await page.waitForSelector('#gname');
    await shot('05-game-editor');
    await page.goto(url + '#/settings');
    await page.waitForSelector('.seg');
    await shot('08-settings');
    await page.goto(url + '#game=' + encodeShare({ ...PRESETS[1], name: 'Dutch Blitz (first to 150)', end: { kind: 'target', target: 150 } }));
    await page.getByRole('dialog').waitFor();
    await shot('07-import');
    await page.getByRole('button', { name: 'Not now' }).click();
    // Finish a game for the game-over screen and stats.
    await page.goto(url + '#/new');
    await page.locator('.game-row', { hasText: 'Dutch Blitz' }).first().click();
    await page.locator('[data-start]').click();
    await page.waitForSelector('.card');
    await playRound(page, { Rosa: 40, Theo: 55, Priya: 22, Oscar: -6, Platypus: 31 });
    await playRound(page, { Rosa: 38, Theo: 49, Priya: 30, Oscar: 12, Platypus: 18 });
    await page.getByRole('heading', { name: /wins/ }).waitFor();
    await shot('03-game-over');
    await page.goto(url + `#/group/${gid}`);
    await page.waitForSelector('table.stats');
    await shot('06-group');
    await page.goto(url + '#/help');
    await shot('10-help');
    // 0.2: Games list, How to play, named rounds in the editor, Phase 10.
    await page.goto(url + '#/games');
    await page.waitForSelector('#app[data-route="/games"] .list-row');
    await shot('11-games');
    await page.getByRole('button', { name: 'How to play 500', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await shot('12-how-to-play');
    await page.getByRole('dialog').locator('.how-table-wrap').scrollIntoViewIfNeeded();
    await shot('12b-how-to-play-table');
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await page.goto(url + '#/game/preset-fishbowl');
    await page.waitForSelector('#gnames');
    await shot('05b-game-editor-fishbowl');
    await page.locator('#gnotes').scrollIntoViewIfNeeded();
    await shot('05c-game-editor-notes');
    await page.goto(url + '#/new');
    await page.locator('.game-row', { hasText: 'Phase 10' }).first().click();
    await page.locator('[data-start]').click();
    await page.waitForSelector('.card');
    await page.locator('[data-end]').click();
    await page.waitForSelector('.keypad');
    for (const n of ['Rosa', 'Priya']) await page.getByRole('button', { name: `${n} made phase` }).click();
    await shot('13b-phase-10-hand');
    for (let i = 0; i < 5; i++) await page.locator('[data-next]').click();
    await page.waitForSelector('.card');
    await page.waitForTimeout(1200);
    await shot('13-phase-10-scoreboard');
    await context.close();
  }
}
await browser.close();
srv.close();
