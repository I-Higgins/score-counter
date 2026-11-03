import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFiles, restoreFiles, backupFileName } from '../../js/backup.js';
import { writeZip, readZip } from '../../js/zip.js';

test('binary values round-trip through the zip as files', async () => {
  const bytes = new Uint8Array(3000).map((_, i) => i % 251);
  const records = [{ id: 'a', text: 'hello', image: { buf: bytes.buffer, type: 'image/jpeg' } }, { id: 'b', list: [1, 2] }];
  const files = [];
  const json = extractFiles(records, files);
  assert.equal(files.length, 1);
  assert.deepEqual(json[0].image.buf, { __file: 'files/0' });
  const zip = await writeZip([{ name: 'backup.json', data: JSON.stringify(json) }, ...files]);
  const entries = await readZip(zip);
  const back = await restoreFiles(JSON.parse(await entries.get('backup.json').text()), entries);
  assert.deepEqual(new Uint8Array(back[0].image.buf), bytes);
  assert.equal(back[0].image.type, 'image/jpeg');
  assert.deepEqual(back[1], { id: 'b', list: [1, 2] });
});

test('a missing file is reported, not ignored', async () => {
  await assert.rejects(restoreFiles({ x: { __file: 'files/9' } }, new Map()), /Missing/);
});

test('backup file names are dated', () => {
  assert.match(backupFileName(new Date(2026, 10, 3)), /-backup-2026-11-03\.zip$/);
});
