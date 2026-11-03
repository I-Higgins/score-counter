// Shared end-to-end helpers (plain `playwright` library + node:test).
import { chromium, webkit } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startServer } from '../../scripts/serve.mjs';

export const IPAD_LANDSCAPE = { width: 1180, height: 820 };
export const IPAD_PORTRAIT = { width: 820, height: 1180 };
export const IPHONE = { width: 390, height: 844 };
export const APP_ID = readFileSync('js/config.js', 'utf8').match(/APP_ID = '([^']+)'/)[1];

/** Browsers to run: E2E_BROWSERS=chromium,webkit (default both; missing ones are skipped locally, not in CI). */
export async function availableBrowsers() {
  const wanted = (process.env.E2E_BROWSERS || 'chromium,webkit').split(',').map((s) => s.trim());
  const out = [];
  for (const name of wanted) {
    const type = { chromium, webkit }[name];
    if (!type) continue;
    try {
      const b = await type.launch();
      await b.close();
      out.push({ name, type });
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`[e2e] skipping ${name}: ${String(e.message).split('\n')[0]}`);
    }
  }
  return out;
}

export async function server() {
  const s = await startServer(0);
  return {
    url: `http://localhost:${s.address().port}/`,
    bump: () => s.bump(),
    // Really take the site down: stop listening and drop open keep-alive sockets.
    close: () => new Promise((ok) => { s.close(() => ok()); s.closeAllConnections(); }),
  };
}

/**
 * A fresh browser + iPad-sized touch context. `settings` are written before the
 * app starts (the install card is dismissed by default so it doesn't get in the way).
 */
export async function newPage(browserType, baseUrl, { viewport = IPAD_LANDSCAPE, settings = {}, noShare = true } = {}) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport, hasTouch: true, acceptDownloads: true });
  await context.addInitScript(([key, json, noShare]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, json);
    // Use the download path in tests; the share sheet can't be driven headless.
    if (noShare) { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch { /* ignore */ } }
  }, [`${APP_ID}:settings`, JSON.stringify({ installDismissed: true, ...settings }), noShare]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(baseUrl);
  await page.waitForSelector('#app[data-route]');
  return { browser, context, page, errors };
}

/** Wait until the service worker controls the page (then every file is cached). */
export async function waitForServiceWorker(page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

/**
 * Run axe (WCAG 2.0–2.2 A/AA) on the current page. Returns violations.
 * meta-viewport is off on purpose: pinch zoom is replaced by the in-app Text size setting.
 */
export async function axe(page) {
  // evaluate (not a <script> tag) so the app's strict Content-Security-Policy stays on.
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(AXE);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'meta-viewport': { enabled: false } },
    });
    return r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`);
  });
}

/** Every visible button, link, input and switch is at least 44×44 CSS px. */
export async function smallTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), [role=switch], [role=radio]')]
    .filter((e) => e.offsetParent !== null && !e.closest('.sr-only'))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ e, r }) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`));
}
