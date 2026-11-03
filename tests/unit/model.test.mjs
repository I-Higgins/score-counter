import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../js/model.js';

const crowns = M.PRESETS[0];
const blitz = M.PRESETS[1];
const people = [{ id: 'a', name: 'Ann', color: 'pink' }, { id: 'b', name: 'Ben', color: 'blue' }, { id: 'c', name: 'Cat', color: 'lime' }];
const start = (game) => M.newMatch({ id: 'm', game, players: people, groupId: 'g' });

test('shared rank: 1, 1, 3', () => {
  const v = { a: 5, b: 5, c: 9 };
  const order = M.sortOrder(people, v, 'asc');
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(M.ranks(order, v, 'asc'), { a: 1, b: 1, c: 3 });
  assert.deepEqual(M.sortOrder(people, v, 'desc'), ['c', 'a', 'b']);
  assert.deepEqual(M.ranks(['c', 'b', 'a'], v, 'manual'), { c: 1, b: 2, a: 3 });
});

test('manual order is seat order', () => {
  assert.deepEqual(M.sortOrder(people, { a: 9, b: 1, c: 5 }, 'manual'), ['a', 'b', 'c']);
});

test('leading follows the winner rule and hides when everyone is equal', () => {
  assert.deepEqual(M.leaders(people, { a: 0, b: 0, c: 0 }, 'low'), []);
  assert.deepEqual(M.leaders(people, { a: 1, b: 1, c: 9 }, 'low'), ['a', 'b']);
  assert.deepEqual(M.leaders(people, { a: 1, b: 1, c: 9 }, 'high'), ['c']);
});

test('pending counts in shown totals, not in saved totals', () => {
  let m = start(crowns);
  m = M.bump(m, 'a', 3);
  m = M.bump(m, 'a', -1);
  assert.deepEqual(M.shownTotals(m), { a: 2, b: 0, c: 0 });
  assert.deepEqual(M.totals(m), { a: 0, b: 0, c: 0 });
  m = M.bump(m, 'a', -2);
  assert.equal('a' in m.pending, false);
});

test('5 Crowns: rounds 3 to 13 with wild cards, dealer rotates, ends after 13', () => {
  let m = start(crowns);
  assert.deepEqual(M.roundInfo(m), { n: 3, of: 13, detail: '3 cards · 3s wild', wild: '3s' });
  assert.equal(M.markerId(m), 'a');
  for (let n = 3; n <= 12; n++) {
    m = M.saveRound(m, { a: 1, b: 2, c: 0 });
    assert.equal(m.endedAt, null);
  }
  assert.equal(M.roundInfo(m).detail, '13 cards · Kings wild');
  assert.equal(M.wildCard(11), 'Jacks');
  assert.equal(M.markerId(m), 'b'); // 10 rounds saved, 3 seats
  m = M.saveRound(m, { a: 1, b: 2, c: 0 });
  assert.ok(m.endedAt);
  assert.deepEqual(m.winnerIds, ['c']);
  assert.equal(m.rounds.at(-1).n, 13);
});

test('Dutch Blitz: no round counter, End hand, ends at the target', () => {
  let m = start(blitz);
  assert.equal(M.roundInfo(m), null);
  assert.equal(M.endLabel(m), 'End hand');
  assert.equal(M.markerId(m), null);
  m = M.saveRound(m, { a: 60, b: 40 });
  assert.equal(m.endedAt, null);
  m = M.saveRound(m, { a: 40, b: 60, c: 5 });
  assert.ok(m.endedAt);
  assert.deepEqual(m.winnerIds, ['a', 'b']); // tie is a shared win
});

test('editing a round of a finished game recomputes the winners', () => {
  let m = start(blitz);
  m = M.saveRound(m, { a: 100, b: 10 });
  assert.deepEqual(m.winnerIds, ['a']);
  m = M.editRound(m, 0, { b: 200 });
  assert.deepEqual(m.winnerIds, ['b']);
});

test('undo snapshots restore exactly and are capped at 50', () => {
  let m = start(crowns);
  let stack = [];
  for (let i = 0; i < 60; i++) { stack = M.pushUndo(stack, m); m = M.bump(m, 'a', 1); }
  assert.equal(stack.length, 50);
  m = M.applySnapshot(m, stack.at(-1));
  assert.equal(m.pending.a, 59);
});

test('keypad entry', () => {
  let e = '';
  for (const k of ['0', '1', '2']) e = M.keyEntry(e, k);
  assert.equal(e, '12');
  e = M.keyEntry(e, '±');
  assert.equal(e, '-12');
  assert.equal(M.entryValue(e), -12);
  e = M.keyEntry(M.keyEntry(e, '⌫'), '⌫');
  assert.equal(e, '-');
  assert.equal(M.entryValue(e), 0);
  assert.equal(M.keyEntry('999999', '9'), '999999');
});

test('share links carry rules only and round-trip', () => {
  const g = { ...blitz, id: 'secret-id', name: 'Dutch Blitz (first to 150)', end: { kind: 'target', target: 150 } };
  const payload = M.encodeShare(g);
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  const back = M.decodeShare(payload);
  assert.equal(back.name, 'Dutch Blitz (first to 150)');
  assert.equal(back.end.target, 150);
  assert.equal('id' in back, false);
  assert.equal('builtIn' in back, false);
  assert.equal(M.sharePayload('#game=' + payload), payload);
  assert.equal(M.sharePayload('#/settings'), null);
});

test('share links: unicode names survive', () => {
  const back = M.decodeShare(M.encodeShare({ ...crowns, name: 'Ünö — family 🃏' }));
  assert.equal(back.name, 'Ünö — family 🃏');
});

test('bad shared games are refused', () => {
  const bad = [
    null, [], { name: '' },
    { ...blitz, winner: 'most' },
    { ...blitz, quick: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { ...blitz, quick: [1.5] },
    { ...blitz, end: { kind: 'target', target: 10 ** 9 } },
    { ...blitz, rounds: { show: true, start: 5, end: 2, label: 'number' } },
    { ...crowns, rounds: { ...crowns.rounds, end: null } },
    { ...blitz, marker: '<script>' },
  ];
  for (const g of bad) assert.throws(() => M.sanitiseGame(g), M.BadGameError, JSON.stringify(g));
  assert.throws(() => M.decodeShare('not*base64'), M.BadGameError);
  assert.throws(() => M.decodeShare(M.encodeShare(blitz).slice(0, 10)), M.BadGameError);
  assert.throws(() => M.readShare({ v: 2, game: blitz }), M.BadGameError);
});

test('long names are capped at 40 characters', () => {
  assert.equal(M.sanitiseGame({ ...blitz, name: 'x'.repeat(80) }).name.length, 40);
});

test('stats: wins, shared wins, average, best; quick and early games excluded', () => {
  const group = { id: 'g', name: 'Family', players: people };
  const g1 = M.saveRound(start(blitz), { a: 120, b: 50, c: 10 });
  const g2 = M.saveRound({ ...start(blitz), id: 'm2' }, { a: 100, b: 100, c: 0 });
  const quick = { ...M.saveRound(start(blitz), { c: 500 }), groupId: null };
  const early = M.finish(M.saveRound(start(blitz), { c: 50 }), 1, true);
  const s = M.statsFor(group, [g1, g2, quick, early]);
  assert.equal(s.games, 2);
  const a = s.rows.find((r) => r.id === 'a');
  const b = s.rows.find((r) => r.id === 'b');
  const c = s.rows.find((r) => r.id === 'c');
  assert.deepEqual([a.wins, a.pct, a.avg, a.best], [2, 100, 110, 120]);
  assert.deepEqual([b.wins, b.pct, b.best], [1, 50, 100]);
  assert.deepEqual([c.wins, c.best], [0, 10]);
  assert.equal(s.rows[0].id, 'a');
  assert.equal(M.statsFor(group, [g1], 'preset-5-crowns').games, 0);
});

test('compact rows from 6 players, or 5 at the largest text', () => {
  assert.equal(M.isCompact(5, 'normal'), false);
  assert.equal(M.isCompact(6, 'normal'), true);
  assert.equal(M.isCompact(5, 'xl'), true);
});
