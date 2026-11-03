import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pinch and double-tap zoom are off (the Text size setting replaces them)', () => {
  const viewport = readFileSync('index.html', 'utf8').match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.match(viewport, /user-scalable=no/);
  assert.match(readFileSync('css/app.css', 'utf8'), /html \{[^}]*touch-action: manipulation/);
  assert.match(readFileSync('js/app.js', 'utf8'), /gesturestart/);
});
