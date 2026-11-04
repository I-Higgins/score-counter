// The template's non-negotiables, checked on every commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appFiles } from '../../scripts/app-files.mjs';

const text = (f) => readFileSync(f, 'utf8');
const code = appFiles().filter((f) => /\.(js|css|html|webmanifest)$/.test(f));

// The one exception: js/game-info.js holds the base of the Wikipedia "Full rules"
// links. They're plain links the person taps (opening the browser), never fetched.
const LINK_BASES = { 'js/game-info.js': ['https://en.wikipedia.org/wiki/'] };

test('no external requests: no http(s) URLs in app code (except SVG namespaces and tap-to-open links)', () => {
  for (const f of code) {
    const ok = LINK_BASES[f] || [];
    const hits = [...text(f).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/') && !ok.includes(u));
    assert.deepEqual(hits, [], `${f} reaches outside the app: ${hits.join(', ')}`);
  }
});

test('external links are only ever tapped, never loaded', () => {
  for (const f of code) {
    if (f.endsWith('.css')) assert.ok(!/url\(\s*['"]?https?:/i.test(text(f)), `${f} loads something from the web`);
  }
  // The Wikipedia base must only be used in a link that opens a new browsing context.
  const sheet = text('js/screens/game-info-sheet.js');
  assert.match(sheet, /href="\$\{esc\(wikiUrl\(info\)\)\}" target="_blank" rel="noopener noreferrer"/);
  for (const f of code) {
    if (f === 'js/game-info.js' || f === 'js/screens/game-info-sheet.js') continue;
    assert.ok(!/wikiUrl|WIKI\b/.test(text(f)), `${f} uses the Wikipedia link base`);
  }
});

test('no tracking, analytics or ad code', () => {
  const bad = /(google-analytics|googletagmanager|gtag\(|doubleclick|adsbygoogle|facebook\.net|plausible|mixpanel|segment\.io|hotjar|sentry)/i;
  for (const f of code) assert.ok(!bad.test(text(f)), `${f} looks like it has tracking or ads`);
});

test('the Content-Security-Policy keeps everything on this site', () => {
  const csp = text('index.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/);
});

test('apple install meta tags are present', () => {
  const html = text('index.html');
  for (const tag of ['apple-mobile-web-app-capable', 'apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style']) assert.ok(html.includes(tag), tag);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /viewport-fit=cover/);
});

test('every theme and text size is defined in tokens.css', () => {
  const t = text('css/tokens.css');
  for (const sel of ['[data-theme="dark"]', '[data-theme="contrast"]', '[data-text="large"]', '[data-text="xl"]', 'prefers-reduced-motion']) assert.ok(t.includes(sel), sel);
});

test('app.css uses tokens, not hard-coded colours', () => {
  const hex = text('css/app.css').match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], 'move colours into css/tokens.css');
});
