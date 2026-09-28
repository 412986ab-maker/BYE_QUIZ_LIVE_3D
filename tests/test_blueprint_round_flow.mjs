import assert from 'node:assert/strict';
import serverGameState, { GAME_STATES } from '../lib/serverGameState.js';
import { GAME_PHASES } from '../lib/gameBlueprint.js';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function user(id) {
  return {
    id,
    uniqueId: id,
    nickname: id,
    displayName: id,
    avatar: '',
    isRealAvatar: false
  };
}

function register(ids) {
  for (const id of ids) {
    const result = serverGameState.registerParticipant(user(id), 'تم');
    assert.equal(result.success, true, `registration failed for ${id}`);
  }
}

async function finishQuestionAndEliminate() {
  serverGameState.endQuestion();
  await wait(80);
  assert.equal(serverGameState.state, GAME_STATES.RESULT);
  serverGameState.startElimination();
  assert.equal(serverGameState.phase, GAME_PHASES.ELIMINATION);
  await wait(20);
}

serverGameState.resetAll();
serverGameState.autoTransition = false;
serverGameState.autoMode = false;
serverGameState.autoNextRound = false;
serverGameState.allowNewParticipantsNextRound = true;
serverGameState.totalRounds = 3;
serverGameState.questionsPerRound = 1;
serverGameState.targetParticipants = 6;
serverGameState.survivorRatio = 0.5;
serverGameState.finalistCount = 3;
serverGameState.eliminationMode = 'LOWEST_SCORE';
serverGameState.answerLockDuration = 0;

const round1 = ['r1a','r1b','r1c','r1d','r1e','r1f'];
register(round1);
assert.equal(serverGameState.drawPool.length, 6);
serverGameState.startQuestion();
assert.equal(serverGameState.phase, GAME_PHASES.QUESTION);
await finishQuestionAndEliminate();
assert.equal(serverGameState.lastElimination.survivorCount, 3);
assert.equal(serverGameState.drawPool.length, 3);
assert.equal(serverGameState.phase, GAME_PHASES.ELIMINATION);

const qualifiedR1 = [...serverGameState.drawPool];
serverGameState.startLuckyDraw();
assert.equal(serverGameState.phase, GAME_PHASES.DRAW);

serverGameState.startNewRound(2);
assert.equal(serverGameState.phase, GAME_PHASES.NEXT_ROUND_REGISTRATION);
assert.deepEqual(serverGameState.drawPool, qualifiedR1);

const round2New = ['r2a','r2b','r2c'];
register(round2New);
assert.equal(serverGameState.drawPool.length, 6);
assert.equal(serverGameState.drawPool.filter(id => qualifiedR1.includes(id)).length, 3);

serverGameState.startQuestion();
await finishQuestionAndEliminate();
assert.equal(serverGameState.lastElimination.survivorCount, 3);
assert.equal(serverGameState.drawPool.length, 3);

const qualifiedR2 = [...serverGameState.drawPool];
serverGameState.startLuckyDraw();
serverGameState.startNewRound(3);
assert.deepEqual(serverGameState.drawPool, qualifiedR2);

serverGameState.startQuestion();
await finishQuestionAndEliminate();
assert.equal(serverGameState.lastElimination.finalRound, true);
assert.equal(serverGameState.lastElimination.survivorCount, 3);
assert.equal(serverGameState.drawPool.length, 3);

await wait(30);
serverGameState.setPhase(GAME_PHASES.FINAL, { force: true });
assert.equal(serverGameState.phase, GAME_PHASES.FINAL);

const champion = serverGameState.startLuckyDraw();
assert.ok(champion?.id);
assert.equal(serverGameState.phase, GAME_PHASES.CHAMPION);

console.log('Blueprint multi-round flow: PASS');
console.log('Round 1: 6 -> 3 -> next round + 3 new participants');
console.log('Round 2: 6 -> 3 -> next round');
console.log('Round 3: 3 finalists -> final -> champion');
