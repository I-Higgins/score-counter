import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitiseSettings, DEFAULTS } from '../../js/settings.js';

test('unknown keys and bad values fall back to defaults', () => {
  const s = sanitiseSettings({ textSize: 'huge', theme: 'neon', sound: 'yes', hacker: true });
  assert.deepEqual(s, { ...DEFAULTS });
});

test('good values are kept', () => {
  const s = sanitiseSettings({ textSize: 'xl', theme: 'contrast', sound: true, lastBackup: 123 });
  assert.equal(s.textSize, 'xl');
  assert.equal(s.theme, 'contrast');
  assert.equal(s.sound, true);
  assert.equal(s.lastBackup, 123);
});

test('rubbish input never throws', () => {
  for (const raw of [null, undefined, 42, 'text', []]) assert.deepEqual(sanitiseSettings(raw), { ...DEFAULTS });
});
