import assert from 'node:assert/strict';
import { calculateElimination, ELIMINATION_MODES } from '../lib/eliminationEngine.js';

const players = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  score: (i + 1) * 10,
  correctAnswers: i + 1,
  wrongAnswers: 0
}));

const r1 = calculateElimination(players, {
  mode: ELIMINATION_MODES.LOWEST_SCORE,
  survivorRatio: 0.5
});
assert.equal(r1.total, 6);
assert.equal(r1.survivorCount, 3);
assert.deepEqual(r1.survivors.map(p => p.id), ['6', '5', '4']);
assert.deepEqual(r1.eliminated.map(p => p.id), ['3', '2', '1']);

const tied = [
  { id: 'a', score: 10, correctAnswers: 1 },
  { id: 'b', score: 10, correctAnswers: 1 },
  { id: 'c', score: 9, correctAnswers: 0 },
  { id: 'd', score: 8, correctAnswers: 0 }
];
const r2 = calculateElimination(tied, {
  mode: ELIMINATION_MODES.LOWEST_SCORE,
  survivorRatio: 0.5
});
assert.equal(r2.survivorCount, 2);
assert.equal(r2.eliminatedCount, 2);

const final = calculateElimination(players.slice(0, 5), {
  mode: ELIMINATION_MODES.LOWEST_SCORE,
  finalRound: true,
  finalistCount: 3
});
assert.equal(final.survivorCount, 3);
assert.equal(final.eliminatedCount, 2);
assert.deepEqual(final.survivors.map(p => p.id), ['5', '4', '3']);

console.log('Elimination engine tests: PASS');
