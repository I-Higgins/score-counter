// The app's data, on top of store.js (IndexedDB).
//   groups   { id, name, players: [{ id, name, color, seat }], createdAt }
//   games    GameType records (5 Crowns and Dutch Blitz are seeded once; people can edit or delete them)
//   matches  every game played, finished or not
//   meta     { id: 'app', currentMatchId, quickPlayers, lastGroupId, lastGameId, seeded }
//            { id: 'undo', matchId, stack }   (kept across relaunch)
//
// Every change is written straight away, in order, through one queue. A failed
// write never throws at the caller: it shows a friendly message (see onSaveError).
import * as store from './store.js';
import * as M from './model.js';

let saveErrorHandler = () => {};
export function onSaveError(fn) { saveErrorHandler = fn; }

let queue = Promise.resolve();
function enqueue(job) {
  const run = queue.then(job);
  queue = run.catch((e) => { console.error(e); saveErrorHandler(e); }); // eslint-disable-line no-console
  return queue;
}
/** Wait for every queued write (tests and navigation use this). */
export function flush() { return queue; }

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export function save(collection, record) {
  const copy = clone(record);
  return enqueue(() => store.put(collection, copy));
}
export function removeRecord(collection, id) { return enqueue(() => store.remove(collection, id)); }

// ---------- meta ----------
let appCache = null;
export async function getApp() {
  if (appCache) return appCache;
  await queue;
  appCache = (await store.get('meta', 'app')) || { id: 'app', currentMatchId: null, quickPlayers: [], lastGroupId: null, lastGameId: null, seeded: false };
  return appCache;
}
export async function setApp(changes) {
  const app = await getApp();
  Object.assign(app, changes);
  save('meta', app);
  return app;
}
/** Forget cached records (after a restore). */
export function resetCache() { appCache = null; undoCache = null; }

/** First launch: add the built-in games once. Deleted ones don't come back. */
export async function ensureSeeded() {
  const app = await getApp();
  if (app.seeded) return;
  const have = new Set((await store.list('games')).map((g) => g.id));
  for (const g of M.PRESETS) if (!have.has(g.id)) save('games', { ...g, createdAt: Date.now() });
  await setApp({ seeded: true });
}

// ---------- reading ----------
// Reads wait for queued writes, so a screen never sees data older than the last tap.
export const listGames = async () => { await queue; return (await store.list('games')).sort((a, b) => (b.builtIn - a.builtIn) || (a.createdAt || 0) - (b.createdAt || 0)); };
export const listGroups = async () => { await queue; return (await store.list('groups')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); };
export const listMatches = async () => { await queue; return store.list('matches'); };
export const getGame = async (id) => { await queue; return store.get('games', id); };
export const getGroup = async (id) => { await queue; return store.get('groups', id); };
export const getMatch = async (id) => { await queue; return store.get('matches', id); };

export async function currentMatch() {
  await queue;
  const app = await getApp();
  if (!app.currentMatchId) return null;
  return (await store.get('matches', app.currentMatchId)) || null;
}

// ---------- undo (one stack, for the current game) ----------
let undoCache = null;
/** Load the undo stack for a match. Call once before change()/undo() on a screen. */
export async function prepareUndo(matchId) {
  await queue;
  if (!undoCache) undoCache = (await store.get('meta', 'undo')) || { id: 'undo', matchId: null, stack: [] };
  if (undoCache.matchId !== matchId) undoCache = { id: 'undo', matchId, stack: [] };
  return undoCache;
}
function undoFor(matchId) {
  if (!undoCache || undoCache.matchId !== matchId) undoCache = { id: 'undo', matchId, stack: [] };
  return undoCache;
}
export function canUndo(matchId) { return !!(undoCache && undoCache.matchId === matchId && undoCache.stack.length); }

/**
 * Change a match synchronously: push an undo snapshot (unless undoable is false),
 * apply fn, queue the save. Returns the new match. Rapid taps can't race.
 */
export function change(match, fn, { undoable = true } = {}) {
  if (undoable) {
    const u = undoFor(match.id);
    u.stack = M.pushUndo(u.stack, match);
    save('meta', u);
  }
  const next = fn(match);
  save('matches', next);
  return next;
}

export function undo(match) {
  const u = undoFor(match.id);
  const snap = u.stack.pop();
  if (!snap) return null;
  save('meta', u);
  const next = M.applySnapshot(match, snap);
  save('matches', next);
  return next;
}

// ---------- starting and ending games ----------
export async function startMatch({ game, players, groupId }) {
  const prev = await currentMatch();
  if (prev && !prev.endedAt) {
    // "Starting saves the current game to history": kept, marked as ended early, not in stats.
    if (prev.rounds.length) save('matches', M.finish(prev, Date.now(), true));
    else removeRecord('matches', prev.id);
  }
  const m = M.newMatch({ id: store.newId(), game, players, groupId });
  save('matches', m);
  undoCache = { id: 'undo', matchId: m.id, stack: [] };
  save('meta', undoCache);
  await setApp({ currentMatchId: m.id, lastGroupId: groupId, lastGameId: game.id });
  return m;
}

/** Keep a group's player edits in step with the current game. */
export async function syncPlayerToCurrent(player) {
  const m = await currentMatch();
  if (!m) return;
  if (!m.players.some((p) => p.id === player.id)) return;
  save('matches', { ...m, players: m.players.map((p) => (p.id === player.id ? { ...p, name: player.name, color: player.color } : p)) });
}

export function displayName(match, id, group) {
  const g = group && group.players.find((p) => p.id === id);
  const p = match.players.find((x) => x.id === id);
  return (g && g.name) || (p && p.name) || 'Player';
}

export function firstFreeColour(used) {
  return M.COLOURS.find((c) => !used.includes(c)) || M.COLOURS[used.length % M.COLOURS.length];
}

export { store };
