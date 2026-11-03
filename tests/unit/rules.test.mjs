// The template's non-negotiables, checked on every commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appFiles } from '../../scripts/app-files.mjs';

const text = (f) => readFileSync(f, 'utf8');
const code = appFiles().filter((f) => /\.(js|css|html|webmanifest)$/.test(f));

test('no external requests: no http(s) URLs in app code (except SVG namespaces)', () => {
  for (const f of code) {
    const hits = [...text(f).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
    assert.deepEqual(hits, [], `${f} reaches outside the app: ${hits.join(', ')}`);
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
