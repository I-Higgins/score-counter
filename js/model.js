// Pure game logic: no DOM, no storage. Everything here is unit-tested.
//
// GameType { id, name, builtIn, winner: 'high'|'low',
//            end: { kind: 'target'|'lastRound'|'none', target },
//            rounds: { show, start, end, label: 'cardsWild'|'number'|'named', names? },
//            marker: 'dealer'|'first'|'none', quick: [int],
//            phases: null|int (a phase tracker, like Phase 10), notes: string,
//            startScore: int (everyone's total before round 1, like Trash's 10 cards; 0 if missing),
//            about?: key into game-info.js (how to play), hidden?: true (left out of New game) }
// Match    { id, groupId|null, game (GameType snapshot), players: [{ id, name, color }] in seat order,
//            rounds: [{ n, scores: { [playerId]: int }, made?: [playerId] }], pending: { [playerId]: int },
//            markerSeat, sort: 'asc'|'desc'|'manual', entry: null|{ values, sel },
//            startedAt, endedAt?, winnerIds?, early? }

export const MAX_ABS = 100000;
export const MAX_QUICK = 8;
export const MAX_NAME = 40;
export const MAX_PLAYER_NAME = 20;
export const UNDO_LIMIT = 50;
export const MAX_NOTES = 1000;
export const MAX_PHASES = 20;
export const MAX_ROUND_NAME = 24;

export const PALETTE = [
  ['pink', 'Pink'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['purple', 'Purple'],
  ['green', 'Green'], ['teal', 'Teal'], ['blue', 'Blue'], ['coral', 'Coral'],
  ['sand', 'Sand'], ['silver', 'Silver'], ['lilac', 'Lilac'], ['lime', 'Lime'],
];
export const COLOURS = PALETTE.map(([k]) => k);

// Built-in games. `about` links each to its how-to-play text in game-info.js.
const preset = (g) => ({ builtIn: true, phases: null, notes: '', startScore: 0, about: g.id, ...g });
export const PRESETS = [
  preset({
    id: 'preset-5-crowns', name: '5 Crowns', winner: 'low',
    end: { kind: 'lastRound', target: 100 },
    rounds: { show: true, start: 3, end: 13, label: 'cardsWild' },
    marker: 'dealer', quick: [],
  }),
  preset({
    id: 'preset-dutch-blitz', name: 'Dutch Blitz', winner: 'high',
    end: { kind: 'target', target: 100 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'none', quick: [5, 10, -2],
  }),
  preset({
    id: 'preset-phase-10', name: 'Phase 10', winner: 'low',
    end: { kind: 'none', target: 100 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'dealer', quick: [5, 10, 15, 25], phases: 10,
  }),
  preset({
    id: 'preset-skip-bo', name: 'Skip-Bo', winner: 'high',
    end: { kind: 'target', target: 500 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'dealer', quick: [25, 5],
  }),
  preset({
    id: 'preset-uno', name: 'Uno', winner: 'high',
    end: { kind: 'target', target: 500 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'dealer', quick: [20, 50],
  }),
  preset({
    id: 'preset-500', name: '500', winner: 'high',
    end: { kind: 'target', target: 500 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'dealer', quick: [10, -10],
  }),
  preset({
    id: 'preset-president', name: 'President (Scum)', winner: 'high',
    end: { kind: 'none', target: 100 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'none', quick: [1, 2, 3, 4, 5],
  }),
  preset({
    id: 'preset-fishbowl', name: 'Fishbowl', winner: 'high',
    end: { kind: 'lastRound', target: 100 },
    rounds: { show: true, start: 1, end: 3, label: 'named', names: ['Describe it', 'One word', 'Act it out'] },
    marker: 'first', quick: [],
  }),
  // Everyone starts on 10 cards; getting out drops you one. Out with 5 cards (down to 4) wins.
  preset({
    id: 'preset-trash', name: 'Trash', winner: 'low',
    end: { kind: 'target', target: 4 },
    rounds: { show: false, start: 1, end: null, label: 'number' },
    marker: 'dealer', quick: [-1], startScore: 10,
  }),
];

export function blankGame() {
  return {
    name: '', builtIn: false, winner: 'high',
    end: { kind: 'none', target: 100 },
    rounds: { show: true, start: 1, end: 10, label: 'number' },
    marker: 'none', quick: [5, 10], phases: null, notes: '', startScore: 0,
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

/** The name of round n for games with named rounds (Fishbowl), or ''. */
export function roundName(game, n) {
  if (game.rounds.label !== 'named' || !Array.isArray(game.rounds.names)) return '';
  return game.rounds.names[n - (game.rounds.start ?? 1)] || '';
}

/** "Round 5 of 13" parts, or null when the counter is off. */
export function roundInfo(match) {
  const g = match.game;
  if (!g.rounds.show) return null;
  const n = currentRoundNumber(match);
  const of = g.end.kind === 'lastRound' && g.rounds.end != null ? g.rounds.end : null;
  const detail = g.rounds.label === 'cardsWild' ? `${n} cards · ${wildCard(n)} wild` : roundName(g, n);
  return { n, of, detail, wild: g.rounds.label === 'cardsWild' ? wildCard(n) : null };
}

/** "End round 5" or "End hand". */
export function endLabel(match) {
  return match.game.rounds.show ? `End round ${currentRoundNumber(match)}` : 'End hand';
}

// ---------- totals, sorting, rank ----------
/** Everyone's total before round 1. */
export const startScore = (game) => (Number.isInteger(game.startScore) ? game.startScore : 0);

/** A target below the start score counts down: the game ends when someone gets down to it. */
export const countsDown = (game) => game.end.target < startScore(game);

export function totals(match) {
  const t = {};
  const s = startScore(match.game);
  for (const p of match.players) t[p.id] = s;
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

// ---------- phases (Phase 10 and the like) ----------
export function hasPhases(game) { return Number.isInteger(game.phases) && game.phases > 0; }

/** Phases each player has finished, from the saved rounds (so undo and fixes just work). */
export function phasesDone(match) {
  const done = {};
  for (const p of match.players) done[p.id] = 0;
  if (!hasPhases(match.game)) return done;
  for (const r of match.rounds) for (const id of r.made || []) if (id in done) done[id] = Math.min(match.game.phases, done[id] + 1);
  return done;
}

/** The phase a player is working on now (the last one once finished). */
export function phaseNow(match, id, done = phasesDone(match)) {
  return Math.min((done[id] || 0) + 1, match.game.phases);
}

/** What sorting and winning go by besides points: phases finished, or null. */
export function phaseKey(match) { return hasPhases(match.game) ? phasesDone(match) : null; }

/** Player ids in display order. Manual = seat order. Stable for ties. More phases always come first. */
export function sortOrder(players, values, dir, phases = null) {
  const ids = players.map((p) => p.id);
  if (dir === 'manual') return ids;
  const seat = Object.fromEntries(ids.map((id, i) => [id, i]));
  return ids.slice().sort((a, b) => {
    const ph = phases ? phases[b] - phases[a] : 0;
    const d = dir === 'asc' ? values[a] - values[b] : values[b] - values[a];
    return ph || d || seat[a] - seat[b];
  });
}

/** Shared ranks (1, 1, 3) for ids in display order. Manual order shows plain positions. */
export function ranks(order, values, dir, phases = null) {
  const out = {};
  let rank = 0;
  let prev;
  order.forEach((id, i) => {
    if (dir === 'manual') { out[id] = i + 1; return; }
    const key = phases ? `${phases[id]}:${values[id]}` : values[id];
    if (i === 0 || key !== prev) { rank = i + 1; prev = key; }
    out[id] = rank;
  });
  return out;
}

/** Ids tied for the best standing under the game's winner rule; empty when everyone is equal. */
export function leaders(players, values, winner, phases = null) {
  if (players.length < 2) return [];
  let pool = players;
  if (phases) {
    const most = Math.max(...players.map((p) => phases[p.id]));
    pool = players.filter((p) => phases[p.id] === most);
  }
  const vals = pool.map((p) => values[p.id]);
  const best = winner === 'low' ? Math.min(...vals) : Math.max(...vals);
  const top = pool.filter((p) => values[p.id] === best).map((p) => p.id);
  return top.length === players.length ? [] : top;
}

/** Final winners (ties are shared wins). Phase games: most phases first, then points. */
export function winners(match) {
  if (!match.players.length) return [];
  const t = totals(match);
  const phases = phaseKey(match);
  let pool = match.players;
  if (phases) {
    const most = Math.max(...pool.map((p) => phases[p.id]));
    pool = pool.filter((p) => phases[p.id] === most);
  }
  const vals = pool.map((p) => t[p.id]);
  const best = match.game.winner === 'low' ? Math.min(...vals) : Math.max(...vals);
  return pool.filter((p) => t[p.id] === best).map((p) => p.id);
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
  if (hasPhases(g)) {
    const done = phasesDone(match);
    if (match.players.some((p) => done[p.id] >= g.phases)) return true;
  }
  if (g.end.kind === 'target') {
    const t = totals(match);
    return countsDown(g)
      ? match.players.some((p) => t[p.id] <= g.end.target)
      : match.players.some((p) => t[p.id] >= g.end.target);
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

/**
 * Save a round from { id: int } (missing = 0), plus who made their phase in phase games.
 * Moves the marker; ends the game if it should.
 */
export function saveRound(match, scores, now = Date.now(), made = []) {
  const clean = {};
  for (const p of match.players) clean[p.id] = clampInt(scores[p.id] || 0);
  const round = { n: currentRoundNumber(match), scores: clean };
  if (hasPhases(match.game)) round.made = match.players.map((p) => p.id).filter((id) => made.includes(id));
  const m = {
    ...match,
    rounds: [...match.rounds, round],
    pending: {}, entry: null,
    markerSeat: match.players.length ? ((match.markerSeat || 0) + 1) % match.players.length : 0,
  };
  if (isOver(m)) return finish(m, now);
  return m;
}

export function finish(match, now = Date.now(), early = false) {
  return { ...match, endedAt: now, winnerIds: winners(match), early, entry: null, pending: early ? match.pending : {} };
}

/** Fix one saved round's scores (and who made their phase). Recomputes the winners of a finished game. */
export function editRound(match, index, scores, made = null) {
  const rounds = match.rounds.map((r, i) => {
    if (i !== index) return r;
    const next = { ...r, scores: { ...r.scores, ...mapInts(scores) } };
    if (made && hasPhases(match.game)) next.made = match.players.map((p) => p.id).filter((id) => made.includes(id));
    return next;
  });
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
  if (startScore(g)) parts.push(`start on ${fmt(startScore(g))}`);
  if (g.end.kind === 'target') parts.push(`first ${countsDown(g) ? 'down ' : ''}to ${fmt(g.end.target)}`);
  if (g.rounds.show && g.rounds.end != null) parts.push(`rounds ${g.rounds.start}–${g.rounds.end}`);
  else if (g.end.kind === 'lastRound' && g.rounds.end != null) parts.push(`${g.rounds.end - g.rounds.start + 1} hands`);
  if (hasPhases(g)) parts.push(`${g.phases} phases`);
  if (g.marker === 'dealer') parts.push('dealer shown');
  if (g.marker === 'first') parts.push('first player shown');
  return parts.join(' · ');
}

export function ruleRows(g) {
  const phased = hasPhases(g);
  const ends = g.end.kind === 'target' ? `First ${countsDown(g) ? 'down ' : ''}to ${fmt(g.end.target)}` : g.end.kind === 'lastRound' ? `After round ${g.rounds.end}` : 'When you stop';
  return [
    ['Winner', phased ? `Most phases, then ${g.winner === 'low' ? 'lowest' : 'highest'} score` : g.winner === 'low' ? 'Lowest score' : 'Highest score'],
    ['Game ends', phased ? `When someone finishes phase ${g.phases}${g.end.kind === 'none' ? '' : ` or ${ends.toLowerCase()}`}` : ends],
    ...(startScore(g) ? [['Everyone starts on', fmt(startScore(g))]] : []),
    ['Round counter', g.rounds.show ? `${g.rounds.start} to ${g.rounds.end ?? 'no limit'}` : 'Off'],
    ...(g.rounds.show && g.rounds.label === 'named' && g.rounds.names?.length ? [['Round names', g.rounds.names.join(', ')]] : []),
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
  if (!isInt(target)) throw new BadGameError('Bad target');
  const from = raw.startScore ?? 0;
  if (!isInt(from)) throw new BadGameError('Bad start score');
  // Counting up from the start needs a target above it (>= 1, as before); counting down, any lower number.
  if (end.kind === 'target' && (target === from || (target > from && target < 1))) throw new BadGameError('Bad target');
  const r = raw.rounds || {};
  if (typeof r.show !== 'boolean') throw new BadGameError('Bad rounds');
  const start = r.start === undefined ? 1 : r.start;
  if (!isInt(start)) throw new BadGameError('Bad start');
  const rEnd = r.end === undefined ? null : r.end;
  if (rEnd !== null && (!isInt(rEnd) || rEnd < start || rEnd - start > 999)) throw new BadGameError('Bad last round');
  if (end.kind === 'lastRound' && rEnd === null) throw new BadGameError('Needs a last round');
  const label = r.label ?? 'number';
  if (!['cardsWild', 'number', 'named'].includes(label)) throw new BadGameError('Bad label');
  let names;
  if (label === 'named') {
    if (!Array.isArray(r.names) || r.names.length > 1000 || !r.names.every((x) => typeof x === 'string')) throw new BadGameError('Bad round names');
    names = r.names.map((x) => x.replace(/\s+/g, ' ').trim().slice(0, MAX_ROUND_NAME)).filter(Boolean);
    if (!names.length) throw new BadGameError('Needs round names');
  }
  if (!['dealer', 'first', 'none'].includes(raw.marker)) throw new BadGameError('Bad marker');
  const quick = raw.quick === undefined ? [] : raw.quick;
  if (!Array.isArray(quick) || quick.length > MAX_QUICK || !quick.every((q) => isInt(q) && q !== 0)) throw new BadGameError('Bad quick buttons');
  const phases = raw.phases ?? null;
  if (phases !== null && (!Number.isInteger(phases) || phases < 1 || phases > MAX_PHASES)) throw new BadGameError('Bad phases');
  if (raw.notes !== undefined && typeof raw.notes !== 'string') throw new BadGameError('Bad notes');
  const notes = (raw.notes || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_NOTES);
  const out = {
    name, winner: raw.winner,
    end: { kind: end.kind, target },
    rounds: { show: r.show, start, end: rEnd, label, ...(names ? { names } : {}) },
    marker: raw.marker, quick: [...quick], phases, notes, startScore: from,
  };
  // Only a short key into the app's own how-to-play text: never text or a link from outside.
  if (typeof raw.about === 'string' && /^preset-[a-z0-9-]{1,30}$/.test(raw.about)) out.about = raw.about;
  return out;
}

// ---------- share links and files ----------
function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  if (typeof s !== 'string' || s.length > 12000 || !/^[A-Za-z0-9_-]*$/.test(s)) throw new BadGameError('Bad link');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Only the rules and notes: never ids, players, names of people or scores. */
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
