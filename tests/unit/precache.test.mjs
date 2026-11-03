// The offline guarantee: every app file is precached, and the versions line up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { appFiles } from '../../scripts/app-files.mjs';

const sw = readFileSync('sw.js', 'utf8');
const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const config = readFileSync('js/config.js', 'utf8');

test('every app file is precached by the service worker', () => {
  const missing = appFiles().filter((f) => !list.includes(f));
  assert.deepEqual(missing, [], `Not precached: ${missing.join(', ')} (run npm run precache)`);
  assert.ok(list.includes('./'));
});

test('every precached file exists', () => {
  const gone = list.filter((f) => f !== './' && !existsSync(f));
  assert.deepEqual(gone, [], 'run npm run precache');
});

test('design/, docs/, tests/ and scripts/ are never precached', () => {
  assert.ok(!list.some((f) => /^(design|docs|tests|scripts)\//.test(f)));
});

test('sw.js APP_ID and VERSION match js/config.js', () => {
  assert.equal(sw.match(/const APP_ID = '([^']+)'/)[1], config.match(/APP_ID = '([^']+)'/)[1]);
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], config.match(/APP_VERSION = '([^']+)'/)[1]);
});

test('every module the app imports is precached', () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
      visit(new URL(m[1], 'file:///' + file).pathname.slice(1));
    }
  };
  visit('js/app.js');
  for (const f of seen) assert.ok(list.includes(f), `${f} not precached`);
});

test('index.html references only precached files', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) assert.ok(list.includes(m[1]), `${m[1]} not precached`);
});

test('manifest is installable from a GitHub Pages subpath', () => {
  const man = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(man.start_url, './');
  assert.equal(man.scope, './');
  assert.equal(man.display, 'standalone');
  assert.ok(man.icons.some((i) => i.purpose === 'maskable'));
  for (const i of man.icons) assert.ok(list.includes(i.src), i.src);
});
