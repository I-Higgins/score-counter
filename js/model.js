// Pure game logic: no DOM, no storage. Everything here is unit-tested.
//
// GameType { id, name, builtIn, winner: 'high'|'low',
//            end: { kind: 'target'|'lastRound'|'none', target },
//            rounds: { show, start, end, label: 'cardsWild'|'number' },
//            marker: 'dealer'|'first'|'none', quick: [int] }
// Match    { id, groupId|null, game (GameType snapshot), players: [{ id, name, color }] in seat order,
//            rounds: [{ n, scores: { [playerId]: int } }], pending: { [playerId]: int },
//            markerSeat, sort: 'asc'|'desc'|'manual', entry: null|{ values, sel },
//            startedAt, endedAt?, winnerIds?, early? }

export const MAX_ABS = 100000;
export const MAX_QUICK = 8;
export const MAX_NAME = 40;
export const MAX_PLAYER_NAME = 20;
export const UNDO_LIMIT = 50;

export const PALETTE = [
  ['pink', 'Pink'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['purple', 'Purple'],
  ['green', 'Green'], ['teal', 'Teal'], ['blue', 'Blue'], ['coral', 'Coral'],
  ['sand', 'Sand'], ['silver', 'Silver'], ['lilac', 'Lilac'], ['lime', 'Lime'],
];
export const COLOURS = PALETTE.map(([k]) => k);

export const PRESETS = [
  {
    id: 'preset-5-crowns', name: '5 Crowns', builtIn: true, winner: 'low',
    end: { kind: 'lastRound', target: 100 },
    rounds: { show: true, start: 3, end: 13, label: 'cardsWild' },
    marker: 'dealer', quick: [],
  },
  {
    id: 'preset-dutch-blitz', name: 'Dutch Blitz', builtIn: true, winner: 'high',
    end: { kind: 'target', target: 100 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'none', quick: [5, 10, -2],
  },
];

export function blankGame() {
  return {
    name: '', builtIn: false, winner: 'high',
    end: { kind: 'none', target: 100 },
    rounds: { show: true, start: 1, end: 10, label: 'number' },
    marker: 'none', quick: [5, 10],
  };
}

// ---------- numbers ----------
export const clampInt = (n, lo = -MAX_ABS, hi = MAX_ABS) => Math.max(lo, Math.min(hi, Math.trunc(Number(n) || 0)));
/** Proper minus sign for display. */
export const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
export const fmtSigned = (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

// ---------- rounds ----------
const WILDS = { 11: 'Jacks', 12: 'Queens', 13: 'Kings' };
export function wildCard(n) {
  if (WILDS[n]) return WILDS[n];
  return `${n}s`;
}

/** The round being played now (after the saved ones). */
export function currentRoundNumber(match) {
  return (match.game.rounds.start ?? 1) + match.rounds.length;
}

export function hasRoundCounter(game) { return !!game.rounds.show; }

/** "Round 5 of 13" parts, or null when the counter is off. */
export function roundInfo(match) {
  const g = match.game;
  if (!g.rounds.show) return null;
  const n = currentRoundNumber(match);
  const of = g.end.kind === 'lastRound' && g.rounds.end != null ? g.rounds.end : null;
  const detail = g.rounds.label === 'cardsWild' ? `${n} cards · ${wildCard(n)} wild` : '';
  return { n, of, detail, wild: g.rounds.label === 'cardsWild' ? wildCard(n) : null };
}

/** "End round 5" or "End hand". */
export function endLabel(match) {
  return match.game.rounds.show ? `End round ${currentRoundNumber(match)}` : 'End hand';
}

// ---------- totals, sorting, rank ----------
export function totals(match) {
  const t = {};
  for (const p of match.players) t[p.id] = 0;
  for (const r of match.rounds) for (const [id, v] of Object.entries(r.scores)) if (id in t) t[id] += v;
  return t;
}

/** Total plus this round's amount, per player. */
export function shownTotals(match) {
  const t = totals(match);
  for (const p of match.players) t[p.id] += match.pending[p.id] || 0;
  return t;
}

export function defaultSort(game) { return game.winner === 'low' ? 'asc' : 'desc'; }

/** Player ids in display order. Manual = seat order. Stable for ties. */
export function sortOrder(players, values, dir) {
  const ids = players.map((p) => p.id);
  if (dir === 'manual') return ids;
  const seat = Object.fromEntries(ids.map((id, i) => [id, i]));
  return ids.slice().sort((a, b) => {
    const d = dir === 'asc' ? values[a] - values[b] : values[b] - values[a];
    return d || seat[a] - seat[b];
  });
}

/** Shared ranks (1, 1, 3) for ids in display order. Manual order shows plain positions. */
export function ranks(order, values, dir) {
  const out = {};
  let rank = 0;
  let prev;
  order.forEach((id, i) => {
    if (dir === 'manual') { out[id] = i + 1; return; }
    if (i === 0 || values[id] !== prev) { rank = i + 1; prev = values[id]; }
    out[id] = rank;
  });
  return out;
}

/** Ids tied for the best value under the game's winner rule; empty when everyone is equal. */
export function leaders(players, values, winner) {
  const vals = players.map((p) => values[p.id]);
  if (vals.length < 2 || vals.every((v) => v === vals[0])) return [];
  const best = winner === 'low' ? Math.min(...vals) : Math.max(...vals);
  return players.filter((p) => values[p.id] === best).map((p) => p.id);
}

/** Final winners (ties are shared wins). */
export function winners(match) {
  const t = totals(match);
  const vals = match.players.map((p) => t[p.id]);
  if (!vals.length) return [];
  const best = match.game.winner === 'low' ? Math.min(...vals) : Math.max(...vals);
  return match.players.filter((p) => t[p.id] === best).map((p) => p.id);
}

/** Compact rows from 6 players (5 at the largest text size). */
export function isCompact(count, textSize) {
  return count >= (textSize === 'xl' ? 5 : 6);
}

// ---------- marker (dealer / first player) ----------
export function markerId(match) {
  if (match.game.marker === 'none' || !match.players.length) return null;
  const i = ((match.markerSeat || 0) % match.players.length + match.players.length) % match.players.length;
  return match.players[i].id;
}

// ---------- game end ----------
export function isOver(match) {
  const g = match.game;
  if (!match.rounds.length) return false;
  if (g.end.kind === 'target') {
    const t = totals(match);
    return match.players.some((p) => t[p.id] >= g.end.target);
  }
  if (g.end.kind === 'lastRound' && g.rounds.end != null) {
    return match.rounds[match.rounds.length - 1].n >= g.rounds.end;
  }
  return false;
}

// ---------- changes (each returns a new match; callers save and push undo) ----------
export function newMatch({ id, game, players, groupId = null, now = Date.now() }) {
  return {
    id, groupId, game: structuredCloneSafe(game),
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    rounds: [], pending: {}, markerSeat: 0, sort: defaultSort(game), entry: null,
    startedAt: now, endedAt: null, winnerIds: null, early: false,
  };
}

export function bump(match, playerId, amount) {
  const m = { ...match, pending: { ...match.pending } };
  m.pending[playerId] = clampInt((m.pending[playerId] || 0) + amount);
  if (!m.pending[playerId]) delete m.pending[playerId];
  return m;
}

/** Save a round from { id: int } (missing = 0). Moves the marker; ends the game if it should. */
export function saveRound(match, scores, now = Date.now()) {
  const clean = {};
  for (const p of match.players) clean[p.id] = clampInt(scores[p.id] || 0);
  const m = {
    ...match,
    rounds: [...match.rounds, { n: currentRoundNumber(match), scores: clean }],
    pending: {}, entry: null,
    markerSeat: match.players.length ? ((match.markerSeat || 0) + 1) % match.players.length : 0,
  };
  if (isOver(m)) return finish(m, now);
  return m;
}

export function finish(match, now = Date.now(), early = false) {
  return { ...match, endedAt: now, winnerIds: winners(match), early, entry: null, pending: early ? match.pending : {} };
}

/** Fix one saved round's scores (game-over table). Recomputes the winners of a finished game. */
export function editRound(match, index, scores) {
  const rounds = match.rounds.map((r, i) => (i === index ? { ...r, scores: { ...r.scores, ...mapInts(scores) } } : r));
  const m = { ...match, rounds };
  if (m.endedAt) m.winnerIds = winners(m);
  return m;
}

function mapInts(o) { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clampInt(v)])); }

// ---------- undo snapshots ----------
const SNAP_KEYS = ['players', 'rounds', 'pending', 'markerSeat', 'sort', 'endedAt', 'winnerIds', 'early', 'entry'];
export function snapshot(match) {
  return structuredCloneSafe(Object.fromEntries(SNAP_KEYS.map((k) => [k, match[k] ?? null])));
}
export function applySnapshot(match, snap) { return { ...match, ...structuredCloneSafe(snap) }; }
export function pushUndo(stack, match) { return [...stack, snapshot(match)].slice(-UNDO_LIMIT); }

// ---------- keypad entry ----------
/** Apply a key ('0'-'9', '±', '⌫') to an entry string like '', '-', '12', '-4'. */
export function keyEntry(entry, key) {
  const e = entry || '';
  if (key === '⌫') return e.slice(0, -1);
  if (key === '±') return e.startsWith('-') ? e.slice(1) : `-${e}`;
  if (!/^\d$/.test(key)) return e;
  const neg = e.startsWith('-');
  let digits = (neg ? e.slice(1) : e) + key;
  digits = digits.replace(/^0+(?=\d)/, '');
  if (digits.length > 6) return e;
  return (neg ? '-' : '') + digits;
}
export function entryValue(entry) {
  if (!entry || entry === '-') return 0;
  return clampInt(parseInt(entry, 10));
}

// ---------- describing a game ----------
export function describeGame(g) {
  const parts = [g.winner === 'low' ? 'Lowest wins' : 'Highest wins'];
  if (g.end.kind === 'target') parts.push(`first to ${g.end.target}`);
  if (g.rounds.show && g.rounds.end != null) parts.push(`rounds ${g.rounds.start}–${g.rounds.end}`);
  else if (g.end.kind === 'lastRound' && g.rounds.end != null) parts.push(`${g.rounds.end - g.rounds.start + 1} hands`);
  if (g.marker === 'dealer') parts.push('dealer shown');
  if (g.marker === 'first') parts.push('first player shown');
  return parts.join(' · ');
}

export function ruleRows(g) {
  return [
    ['Winner', g.winner === 'low' ? 'Lowest score' : 'Highest score'],
    ['Game ends', g.end.kind === 'target' ? `First to ${g.end.target}` : g.end.kind === 'lastRound' ? `After round ${g.rounds.end}` : 'When you stop'],
    ['Round counter', g.rounds.show ? `${g.rounds.start} to ${g.rounds.end ?? 'no limit'}` : 'Off'],
    ['Each round shows', g.marker === 'dealer' ? 'Dealer' : g.marker === 'first' ? 'First player' : 'None'],
    ['Quick buttons', g.quick.length ? g.quick.map(fmtSigned).join('  ') : 'None'],
  ];
}

// ---------- validating game types (editor, share links, files) ----------
export class BadGameError extends Error {}

const isInt = (v) => Number.isInteger(v) && Math.abs(v) <= MAX_ABS;

/** Check and normalise a game type from anywhere untrusted. Throws BadGameError. Never keeps unknown keys. */
export function sanitiseGame(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadGameError('Not a game');
  const name = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
  if (!name) throw new BadGameError('No name');
  if (!['high', 'low'].includes(raw.winner)) throw new BadGameError('Bad winner');
  const end = raw.end || {};
  if (!['target', 'lastRound', 'none'].includes(end.kind)) throw new BadGameError('Bad end');
  const target = end.target === undefined ? 100 : end.target;
  if (!isInt(target) || target < 1) throw new BadGameError('Bad target');
  const r = raw.rounds || {};
  if (typeof r.show !== 'boolean') throw new BadGameError('Bad rounds');
  const start = r.start === undefined ? 1 : r.start;
  if (!isInt(start)) throw new BadGameError('Bad start');
  const rEnd = r.end === undefined ? null : r.end;
  if (rEnd !== null && (!isInt(rEnd) || rEnd < start || rEnd - start > 999)) throw new BadGameError('Bad last round');
  if (end.kind === 'lastRound' && rEnd === null) throw new BadGameError('Needs a last round');
  if (!['cardsWild', 'number'].includes(r.label ?? 'number')) throw new BadGameError('Bad label');
  if (!['dealer', 'first', 'none'].includes(raw.marker)) throw new BadGameError('Bad marker');
  const quick = raw.quick === undefined ? [] : raw.quick;
  if (!Array.isArray(quick) || quick.length > MAX_QUICK || !quick.every((q) => isInt(q) && q !== 0)) throw new BadGameError('Bad quick buttons');
  return {
    name, winner: raw.winner,
    end: { kind: end.kind, target },
    rounds: { show: r.show, start, end: rEnd, label: r.label ?? 'number' },
    marker: raw.marker, quick: [...quick],
  };
}

// ---------- share links and files ----------
function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  if (typeof s !== 'string' || s.length > 4000 || !/^[A-Za-z0-9_-]*$/.test(s)) throw new BadGameError('Bad link');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Only the rules: never ids, players, names of people or scores. */
export function shareJson(game) { return { v: 1, game: sanitiseGame(game) }; }
export function encodeShare(game) { return toB64Url(JSON.stringify(shareJson(game))); }

export function decodeShare(payload) {
  let data;
  try { data = JSON.parse(fromB64Url(payload)); } catch (e) { throw e instanceof BadGameError ? e : new BadGameError('Bad link'); }
  return readShare(data);
}
export function readShare(data) {
  if (!data || data.v !== 1) throw new BadGameError('Unknown version');
  return sanitiseGame(data.game);
}
/** The part after '#game=' in a location hash, or null. */
export function sharePayload(hash) {
  const m = /^#?game=([A-Za-z0-9_-]+)$/.exec(hash || '');
  return m ? m[1] : null;
}

// ---------- stats (always derived from finished games, never stored) ----------
export function countsForStats(m) { return !!(m.endedAt && !m.early && m.groupId); }

export function statsFor(group, matches, gameId = null) {
  const games = matches.filter((m) => countsForStats(m) && m.groupId === group.id && (!gameId || m.game.id === gameId));
  const dirs = new Set(games.map((m) => m.game.winner));
  const rows = group.players.map((p) => {
    let played = 0; let wins = 0; let sum = 0; let best = null;
    for (const m of games) {
      if (!m.players.some((x) => x.id === p.id)) continue;
      const t = totals(m)[p.id];
      played += 1; sum += t;
      if ((m.winnerIds || []).includes(p.id)) wins += 1;
      if (dirs.size === 1) best = best === null ? t : (m.game.winner === 'low' ? Math.min(best, t) : Math.max(best, t));
    }
    return {
      id: p.id, name: p.name, color: p.color, played, wins,
      pct: played ? Math.round((wins / played) * 100) : null,
      avg: played ? Math.round(sum / played) : null,
      best,
    };
  });
  rows.sort((a, b) => b.wins - a.wins || (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name));
  return { games: games.length, rows };
}

export function gameTypesPlayed(group, matches) {
  const seen = new Map();
  for (const m of matches) if (countsForStats(m) && m.groupId === group.id && !seen.has(m.game.id)) seen.set(m.game.id, m.game.name);
  return [...seen].map(([id, name]) => ({ id, name }));
}

function structuredCloneSafe(v) {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
