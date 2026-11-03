import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeZip, readZip, crc32 } from '../../js/zip.js';

test('crc32 known value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('round-trips files', async () => {
  const bytes = new Uint8Array(5000).map((_, i) => i % 251);
  const zip = await writeZip([
    { name: 'photo-pairs.json', data: '{"hello":"wörld"}' },
    { name: 'photos/a.jpg', data: new Blob([bytes]) },
  ]);
  const out = await readZip(zip);
  assert.equal(await out.get('photo-pairs.json').text(), '{"hello":"wörld"}');
  assert.deepEqual(new Uint8Array(await out.get('photos/a.jpg').arrayBuffer()), bytes);
});

test('rejects things that are not zips', async () => {
  await assert.rejects(readZip(new Blob(['hello there, definitely not a zip file at all'])));
});
