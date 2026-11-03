// Tiny IndexedDB wrapper: named collections of records, each with a string `id`.
// Everything the person would hate to lose lives here (not localStorage).
//
// Binary data: store ArrayBuffers ({ buf, type }), not Blobs. Some WebKit builds
// (and Safari private browsing) refuse Blobs in IndexedDB; ArrayBuffers work
// everywhere. Use packBlob()/unpackBlob() at the edges.
//
// Add a collection: add its name to COLLECTIONS and bump DB_VERSION.
import { APP_ID } from './config.js';

export const COLLECTIONS = ['items'];
const DB_NAME = APP_ID;
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException('Aborted', 'AbortError'));
  });
}
function result(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function list(collection) {
  const db = await open();
  return result(db.transaction(collection).objectStore(collection).getAll());
}

export async function get(collection, id) {
  const db = await open();
  return result(db.transaction(collection).objectStore(collection).get(id));
}

export async function put(collection, record) {
  if (!record || typeof record.id !== 'string') throw new Error('Records need a string id');
  const db = await open();
  const tx = db.transaction(collection, 'readwrite');
  tx.objectStore(collection).put(record);
  await done(tx);
  return record;
}

export async function remove(collection, id) {
  const db = await open();
  const tx = db.transaction(collection, 'readwrite');
  tx.objectStore(collection).delete(id);
  await done(tx);
}

export async function clear(collection) {
  const db = await open();
  const tx = db.transaction(collection, 'readwrite');
  tx.objectStore(collection).clear();
  await done(tx);
}

/** Write many records across collections in one transaction (all or nothing). */
export async function putMany(byCollection) {
  const names = Object.keys(byCollection);
  if (!names.length) return;
  const db = await open();
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) for (const r of byCollection[name]) tx.objectStore(name).put(r);
  await done(tx);
}

export async function packBlob(blob) {
  if (!(blob instanceof Blob)) return blob;
  return { buf: await blob.arrayBuffer(), type: blob.type || 'application/octet-stream' };
}
export function unpackBlob(v) {
  if (!v || v instanceof Blob || !(v.buf instanceof ArrayBuffer)) return v;
  return new Blob([v.buf], { type: v.type });
}
