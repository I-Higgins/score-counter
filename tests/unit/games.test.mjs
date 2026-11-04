// 0.2: the new built-in games, phases (Phase 10), named rounds, notes and how-to-play text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../js/model.js';
import { INFO, infoFor, phaseText, wikiUrl } from '../../js/game-info.js';

const preset = (id) => M.PRESETS.find((g) => g.id === `preset-${id}`);
const people = [{ id: 'a', name: 'Ann', color: 'pink' }, { id: 'b', name: 'Ben', color: 'blue' }, { id: 'c', name: 'Cat', color: 'lime' }];
const start = (game) => M.newMatch({ id: 'm', game, players: people, groupId: 'g' });

test('every built-in is a valid game with its own how-to-play guide', () => {
  const ids = M.PRESETS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const id of ['5-crowns', 'dutch-blitz', 'phase-10', 'skip-bo', 'uno', '500', 'president', 'fishbowl', 'trash']) assert.ok(preset(id), id);
  for (const g of M.PRESETS) {
    const clean = M.sanitiseGame(g);
    assert.equal(clean.name, g.name);
    const info = infoFor(g);
    assert.ok(info, `${g.name} has a guide`);
    assert.ok(info.intro && info.start.length >= 3 && info.scoring.length >= 2, `${g.name} guide is complete enough to play offline`);
    if (g.id === 'preset-trash') assert.equal(wikiUrl(info), '', 'Trash has no Wikipedia article, so no link');
    else assert.match(wikiUrl(info), /^https:\/\/en\.wikipedia\.org\/wiki\/[A-Za-z0-9_()%-]+$/);
    for (const line of [info.intro, ...info.start, ...info.scoring]) assert.ok(!/https?:/.test(line), 'no links in the text');
  }
  assert.deepEqual(Object.keys(INFO).sort(), ids.slice().sort(), 'no orphan guides');
});

test('old records without `about` still find their guide; copies keep it', () => {
  const old = { ...preset('5-crowns') };
  delete old.about;
  assert.ok(infoFor(old));
  const copy = { ...M.sanitiseGame(preset('uno')), id: 'xyz' };
  assert.equal(infoFor(copy), INFO['preset-uno']);
  assert.equal(infoFor({ id: 'custom', name: 'Mine' }), null);
});

test('scoring set-ups match the rules', () => {
  assert.deepEqual([preset('skip-bo').end, preset('skip-bo').winner], [{ kind: 'target', target: 500 }, 'high']);
  assert.deepEqual([preset('uno').end, preset('uno').quick], [{ kind: 'target', target: 500 }, [20, 50]]);
  assert.deepEqual([preset('phase-10').winner, preset('phase-10').phases, preset('phase-10').quick], ['low', 10, [5, 10, 15, 25]]);
  assert.equal(preset('500').end.target, 500);
  assert.equal(preset('fishbowl').rounds.end, 3);
  assert.equal(INFO['preset-phase-10'].phases.length, 10);
});

test('Phase 10: phases come from saved rounds; most phases ranks first, then the lowest score', () => {
  let m = start(preset('phase-10'));
  m = M.saveRound(m, { a: 0, b: 30, c: 5 }, 1, ['a', 'c']);
  m = M.saveRound(m, { a: 50, b: 0, c: 45 }, 2, ['b', 'c']);
  assert.deepEqual(M.phasesDone(m), { a: 1, b: 1, c: 2 });
  assert.equal(M.phaseNow(m, 'c'), 3);
  assert.equal(phaseText(m.game, 3), '1 set of 4 + 1 run of 4');
  const t = M.totals(m); // a 50, b 30, c 50
  const key = M.phaseKey(m);
  const order = M.sortOrder(m.players, t, 'asc', key);
  assert.deepEqual(order, ['c', 'b', 'a'], 'c leads on phases despite the higher score');
  assert.deepEqual(M.ranks(order, t, 'asc', key), { c: 1, b: 2, a: 3 });
  assert.deepEqual(M.leaders(m.players, t, 'low', key), ['c']);
  assert.equal(m.endedAt, null);
  assert.equal(m.rounds[0].made.join(), 'a,c', 'made is kept in seat order');
});

test('Phase 10: ends after the hand someone finishes phase 10; ties on phases go to the lowest score', () => {
  let m = start(preset('phase-10'));
  for (let i = 0; i < 9; i++) m = M.saveRound(m, { a: 10, b: 5, c: 0 }, i, ['a', 'b']);
  assert.equal(m.endedAt, null);
  m = M.saveRound(m, { a: 0, b: 0, c: 50 }, 99, ['a', 'b']);
  assert.equal(m.endedAt, 99);
  assert.deepEqual(m.winnerIds, ['b'], 'both finished phase 10: b has fewer points');
  // A fix that takes back b's last phase makes a the winner.
  m = M.editRound(m, 9, {}, ['a']);
  assert.deepEqual(m.winnerIds, ['a']);
});

test('games without phases are unchanged: no made lists, plain sorting', () => {
  let m = start(preset('uno'));
  m = M.saveRound(m, { a: 40 }, 1, ['a']);
  assert.equal('made' in m.rounds[0], false);
  assert.equal(M.phaseKey(m), null);
});

test('Fishbowl: named rounds show in the round strip and end after round 3', () => {
  let m = start(preset('fishbowl'));
  assert.deepEqual(M.roundInfo(m), { n: 1, of: 3, detail: 'Describe it', wild: null });
  m = M.saveRound(m, { a: 5 });
  assert.equal(M.roundInfo(m).detail, 'One word');
  m = M.saveRound(m, { a: 5 });
  m = M.saveRound(m, { b: 20 });
  assert.ok(m.endedAt);
  assert.deepEqual(m.winnerIds, ['b']);
});

test('sanitising: notes, phases, round names and the about key', () => {
  const base = { ...M.blankGame(), name: 'Mine' };
  const g = M.sanitiseGame({ ...base, notes: '  Jokers wild\r\nNo stacking \u0007 ', phases: 7, about: 'preset-uno' });
  assert.equal(g.notes, 'Jokers wild\nNo stacking');
  assert.equal(g.phases, 7);
  assert.equal(g.about, 'preset-uno');
  assert.equal(M.sanitiseGame({ ...base, notes: 'x'.repeat(5000) }).notes.length, M.MAX_NOTES);
  assert.equal('about' in M.sanitiseGame({ ...base, about: 'https://example.com' }), false, 'about is only ever a key');
  assert.throws(() => M.sanitiseGame({ ...base, phases: 0 }), M.BadGameError);
  assert.throws(() => M.sanitiseGame({ ...base, phases: 99 }), M.BadGameError);
  assert.throws(() => M.sanitiseGame({ ...base, notes: 5 }), M.BadGameError);
  const named = M.sanitiseGame({ ...base, rounds: { show: true, start: 1, end: 3, label: 'named', names: [' Describe ', '', 'One   word'] } });
  assert.deepEqual(named.rounds.names, ['Describe', 'One word']);
  assert.throws(() => M.sanitiseGame({ ...base, rounds: { show: true, start: 1, end: 3, label: 'named', names: [' '] } }), M.BadGameError);
  assert.equal('names' in M.sanitiseGame({ ...base, rounds: { ...base.rounds, names: ['x'] } }).rounds, false, 'names only with named rounds');
  // Old games (no phases or notes) still load.
  const old = M.sanitiseGame({ name: 'Old', winner: 'high', end: { kind: 'none' }, rounds: { show: false }, marker: 'none' });
  assert.deepEqual([old.phases, old.notes], [null, '']);
});

test('share links carry notes, phases and named rounds, but never `hidden`', () => {
  const g = { ...preset('phase-10'), notes: 'Skip cards can’t be picked up 🃏'.repeat(20), hidden: true, id: 'secret' };
  const back = M.decodeShare(M.encodeShare(g));
  assert.equal(back.notes, g.notes);
  assert.equal(back.phases, 10);
  assert.equal('hidden' in back, false);
  assert.equal('id' in back, false);
  const fish = M.decodeShare(M.encodeShare(preset('fishbowl')));
  assert.deepEqual(fish.rounds.names, ['Describe it', 'One word', 'Act it out']);
});

test('describing and rule rows mention phases and round names', () => {
  assert.match(M.describeGame(preset('phase-10')), /10 phases/);
  const rows = Object.fromEntries(M.ruleRows(preset('phase-10')));
  assert.equal(rows.Winner, 'Most phases, then lowest score');
  assert.equal(rows['Game ends'], 'When someone finishes phase 10');
  assert.equal(Object.fromEntries(M.ruleRows(preset('fishbowl')))['Round names'], 'Describe it, One word, Act it out');
});

// 0.3: start scores, and targets that count down (Trash).
test('Trash: everyone starts on 10, getting out drops you one, out with 5 (down to 4) wins', () => {
  const g = preset('trash');
  assert.deepEqual([g.winner, g.startScore, g.end, g.quick], ['low', 10, { kind: 'target', target: 4 }, [-1]]);
  assert.ok(M.countsDown(g));
  let m = start(g);
  assert.deepEqual(M.totals(m), { a: 10, b: 10, c: 10 });
  assert.deepEqual(M.leaders(m.players, M.totals(m), 'low'), [], 'nobody leads at the start');
  m = M.saveRound(m, { a: -1 }, 1);
  assert.deepEqual(M.totals(m), { a: 9, b: 10, c: 10 });
  assert.deepEqual(M.leaders(m.players, M.totals(m), 'low'), ['a']);
  for (let i = 0; i < 4; i++) m = M.saveRound(m, { b: -1 }, 2 + i);
  assert.equal(m.endedAt, null, 'Ben on 6: not over');
  m = M.saveRound(m, { b: -1 }, 7);
  assert.equal(m.endedAt, null, 'Ben got out with 6, down to 5: not over');
  m = M.saveRound(m, { b: -1 }, 8);
  assert.equal(M.totals(m).b, 4);
  assert.ok(m.endedAt, 'Ben got out with 5: game over');
  assert.deepEqual(m.winnerIds, ['b']);
  assert.match(M.describeGame(g), /start on 10 · first down to 4/);
  assert.deepEqual(M.ruleRows(g).find(([k]) => k === 'Everyone starts on'), ['Everyone starts on', '10']);
  assert.equal(M.ruleRows(g).find(([k]) => k === 'Game ends')[1], 'First down to 4');
});

test('start scores: counting up still works, old games default to 0, and bad set-ups are refused', () => {
  const up = { ...preset('uno'), startScore: 100 };
  let m = start(up);
  assert.deepEqual(M.totals(m), { a: 100, b: 100, c: 100 });
  m = M.saveRound(m, { a: 399 }, 1);
  assert.equal(m.endedAt, null);
  m = M.saveRound(m, { a: 1 }, 2);
  assert.deepEqual(m.winnerIds, ['a'], 'reached 500 from a start of 100');
  const old = { ...preset('uno') };
  delete old.startScore;
  assert.equal(M.sanitiseGame(old).startScore, 0);
  assert.deepEqual(M.totals(start(old)), { a: 0, b: 0, c: 0 });
  assert.ok(!M.ruleRows(old).some(([k]) => k === 'Everyone starts on'));
  const trash = preset('trash');
  assert.equal(M.sanitiseGame({ ...trash, end: { kind: 'target', target: 0 } }).end.target, 0, 'classic Trash: down to 0');
  assert.throws(() => M.sanitiseGame({ ...trash, end: { kind: 'target', target: 10 } }), /Bad target/, 'target equal to the start');
  assert.throws(() => M.sanitiseGame({ ...preset('uno'), end: { kind: 'target', target: 0 } }), /Bad target/, 'counting up to 0');
  assert.throws(() => M.sanitiseGame({ ...trash, startScore: 1.5 }), /Bad start score/);
  assert.throws(() => M.sanitiseGame({ ...trash, startScore: '10' }), /Bad start score/);
  const back = M.sanitiseGame(JSON.parse(JSON.stringify(trash)));
  assert.equal(back.startScore, 10, 'survives a share round-trip');
});
