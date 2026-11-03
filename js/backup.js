// Back up / restore everything as one .zip:
//   backup.json   format, versions, settings and every collection's records
//   files/<n>     binary values (ArrayBuffers, e.g. photos), referenced from backup.json
// Restore merges by record id, so restoring twice never duplicates anything.
// Validation happens before anything is written: a bad file changes nothing.
import { APP_ID, APP_VERSION } from './config.js';
import { writeZip, readZip } from './zip.js';
import * as store from './store.js';
import { getSettings, replaceSettings } from './settings.js';

export const FORMAT = `${APP_ID}-backup`;
const MANIFEST = 'backup.json';

export class BadBackupError extends Error {
  constructor(message, cause) { super(message); this.name = 'BadBackupError'; this.cause = cause; }
}

/** Replace binary values with file references. Pure; exported for tests. */
export function extractFiles(value, files = []) {
  if (value instanceof ArrayBuffer) {
    const name = `files/${files.length}`;
    files.push({ name, data: new Blob([value]) });
    return { __file: name };
  }
  if (Array.isArray(value)) return value.map((v) => extractFiles(v, files));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = extractFiles(v, files);
    return out;
  }
  return value;
}

/** Put binary values back from the zip entries. */
export async function restoreFiles(value, entries) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.__file === 'string' && Object.keys(value).length === 1) {
    const e = entries.get(value.__file);
    if (!e) throw new BadBackupError(`Missing ${value.__file}`);
    return e.arrayBuffer();
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => restoreFiles(v, entries)));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await restoreFiles(v, entries);
    return out;
  }
  return value;
}

/** Build the backup zip. Returns { blob, name, counts }. */
export async function buildBackup() {
  const collections = {};
  const counts = {};
  for (const name of store.COLLECTIONS) {
    const records = await store.list(name);
    collections[name] = records;
    counts[name] = records.length;
  }
  const files = [];
  const manifest = {
    format: FORMAT,
    version: 1,
    appVersion: APP_VERSION,
    exported: new Date().toISOString(),
    settings: getSettings(),
    collections: extractFiles(collections, files),
  };
  const blob = await writeZip([{ name: MANIFEST, data: JSON.stringify(manifest) }, ...files]);
  return { blob, name: backupFileName(), counts };
}

export function backupFileName(d = new Date()) {
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${APP_ID}-backup-${stamp}.zip`;
}

/** Read and check a backup file without writing anything. */
export async function readBackup(file) {
  try {
    const entries = await readZip(file);
    const m = entries.get(MANIFEST);
    if (!m) throw new Error('No backup.json');
    const manifest = JSON.parse(await m.text());
    if (!manifest || manifest.format !== FORMAT) throw new Error('Not a backup from this app');
    if (manifest.version !== 1) throw new Error('Backup is from a newer version');
    if (!manifest.collections || typeof manifest.collections !== 'object') throw new Error('No collections');
    const collections = {};
    for (const name of store.COLLECTIONS) {
      const records = manifest.collections[name] || [];
      if (!Array.isArray(records) || records.some((r) => !r || typeof r.id !== 'string')) throw new Error(`Bad records in ${name}`);
      collections[name] = await restoreFiles(records, entries);
    }
    return { manifest, collections };
  } catch (e) {
    throw e instanceof BadBackupError ? e : new BadBackupError('Bad backup', e);
  }
}

/** Restore: merge records by id (one transaction), and settings if asked. */
export async function restoreBackup(file, { includeSettings = true } = {}) {
  const { manifest, collections } = await readBackup(file);
  await store.putMany(collections);
  if (includeSettings && manifest.settings) replaceSettings({ ...manifest.settings, installDismissed: getSettings().installDismissed });
  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));
  return { counts, exported: manifest.exported };
}

/**
 * Share sheet with the file where supported (iPad), else a download.
 * Call it straight from a tap: iPadOS only opens the share sheet inside a
 * user gesture, so build the backup first, then ask for a second tap.
 */
export async function saveFile(blob, name, type = 'application/zip') {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.share) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
