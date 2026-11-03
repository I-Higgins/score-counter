// Screenshot every route at iPad portrait/landscape and iPhone, in each theme,
// into screenshots/ (git-ignored). Look at them, and compare with design/.
// Usage: npm run screenshots   (add your routes to ROUTES)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { startServer } from './serve.mjs';

const ROUTES = ['/', '/settings'];
const VIEWPORTS = { 'ipad-landscape': [1180, 820], 'ipad-portrait': [820, 1180], iphone: [390, 844] };
const THEMES = ['light', 'dark', 'contrast'];
const APP_ID = readFileSync('js/config.js', 'utf8').match(/APP_ID = '([^']+)'/)[1];

await mkdir('screenshots', { recursive: true });
const srv = await startServer(0);
const url = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
for (const [vpName, [width, height]] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [`${APP_ID}:settings`, JSON.stringify({ theme, installDismissed: true })]);
    const page = await context.newPage();
    for (const route of ROUTES) {
      await page.goto(url + '#' + route);
      await page.waitForSelector(`#app[data-route="${route}"]`);
      const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
      const file = `screenshots/${vpName}-${theme}-${name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log('wrote', file);
    }
    await context.close();
  }
}
await browser.close();
srv.close();
