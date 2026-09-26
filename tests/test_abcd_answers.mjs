import { commandParser } from '../lib/commandParser.js';
import { serverGameState, GAME_STATES } from '../lib/serverGameState.js';
import '../public/js/engine/answerEngine.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${label}`);
    failed++;
  }
}

console.log('\n================================================================');
console.log('🧪 BYE QUIZ LIVE - A / B / C / D ANSWER PROCESSING AUDIT');
console.log('================================================================\n');

// 1. Command Parser Standalone & Trimming Validation
console.log('--- 1. Command Parser Exact Letter Parsing ---');

const testCases = [
  { input: 'A', expected: 'A', valid: true },
  { input: 'a', expected: 'A', valid: true },
  { input: ' B ', expected: 'B', valid: true },
  { input: 'c', expected: 'C', valid: true },
  { input: 'D', expected: 'D', valid: true },
  { input: 'E', expected: null, valid: false },
  { input: 'AB', expected: null, valid: false },
  { input: 'ABC', expected: null, valid: false },
  { input: 'hello A', expected: null, valid: false },
  { input: 'مرحبا A', expected: null, valid: false },
  { input: 'أنا أختار A', expected: null, valid: false },
  { input: 'answer A', expected: null, valid: false }
];

for (const tc of testCases) {
  const parsedStandalone = commandParser.parseStandaloneAnswer(tc.input);
  if (tc.valid) {
    assert(`"${tc.input}" parses to "${tc.expected}"`, parsedStandalone === tc.expected);
    const parsedCmd = commandParser.parse(tc.input, { id: 'u_1', uniqueId: 'player_1' });
    assert(`"${tc.input}" triggers ANSWER action with value "${tc.expected}"`, parsedCmd.isCommand && parsedCmd.action === 'ANSWER' && parsedCmd.value === tc.expected);
  } else {
    assert(`"${tc.input}" is rejected (null / not a letter answer)`, parsedStandalone === null);
  }
}

// 2. Server Game State Real Round Question & Answer Verification
console.log('\n--- 2. Server Game State Options & Answer Matching ---');

serverGameState.resetAll();


const mockUser1 = { id: 'user_a', uniqueId: 'player_a', nickname: 'متسابق أ', displayName: 'متسابق أ' };
const mockUser2 = { id: 'user_b', uniqueId: 'player_b', nickname: 'متسابق ب', displayName: 'متسابق ب' };
const mockUser3 = { id: 'user_c', uniqueId: 'player_c', nickname: 'متسابق ج', displayName: 'متسابق ج' };
const mockUser4 = { id: 'user_d', uniqueId: 'player_d', nickname: 'متسابق د', displayName: 'متسابق د' };

serverGameState.registerParticipant(mockUser1, 'تم');
serverGameState.registerParticipant(mockUser2, 'تم');
serverGameState.registerParticipant(mockUser3, 'تم');
serverGameState.registerParticipant(mockUser4, 'تم');

// Setup a multiple-choice question where Option 1 (B) is the correct answer
serverGameState.currentQuestion = {
  id: 'q_test_01',
  question: 'ما هي عاصمة دولة الإمارات العربية المتحدة؟',
  options: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان'],
  correctAnswer: 'أبوظبي', // Index 1 = B
  points: 100,
  timeLimit: 15
};
serverGameState.state = GAME_STATES.QUESTION;
serverGameState.questionStartTime = Date.now();

// User 1 sends 'A' (Option 0 = دبي) -> WRONG
const res1 = serverGameState.processAnswer(mockUser1, 'A');
assert("User 1 answering 'A' for Option 1 correct is WRONG", res1.isCorrect === false);

// User 2 sends ' b ' (Option 1 = أبوظبي) -> CORRECT
const res2 = serverGameState.processAnswer(mockUser2, ' b ');
assert("User 2 answering ' b ' for Option 1 correct is CORRECT", res2.isCorrect === true);
const p2 = serverGameState.participants.get(mockUser2.id);
assert("User 2 awarded points (score >= 100)", p2.score >= 100);

// User 3 sends 'c' (Option 2 = الشارقة) -> WRONG
const res3 = serverGameState.processAnswer(mockUser3, 'c');
assert("User 3 answering 'c' for Option 1 correct is WRONG", res3.isCorrect === false);

// User 4 sends 'D' (Option 3 = عجمان) -> WRONG
const res4 = serverGameState.processAnswer(mockUser4, 'D');
assert("User 4 answering 'D' for Option 1 correct is WRONG", res4.isCorrect === false);

// 3. Client-Side AnswerEngine checkMatch
console.log('\n--- 3. Client-Side AnswerEngine Matching Audit ---');
const dummyEvents = { on: () => {}, emit: () => {} };
const dummyState = { get: () => 'QUESTION' };
const dummyParticipants = { get: () => ({ id: 'u1', answers: [] }), registerParticipant: () => {} };
const ae = new globalThis.AnswerEngine(dummyEvents, dummyState, dummyParticipants);

const qSample = {
  type: 'MULTIPLE_CHOICE',
  question: 'عاصمة السعودية؟',
  options: ['الرياض', 'جدة', 'الدمام', 'مكة'],
  correctAnswer: 'الرياض' // Index 0 = A
};

assert("AnswerEngine: 'A' matches option 0", ae.checkMatch('A', qSample) === true);
assert("AnswerEngine: 'a' matches option 0", ae.checkMatch('a', qSample) === true);
assert("AnswerEngine: ' A ' matches option 0", ae.checkMatch(' A ', qSample) === true);
assert("AnswerEngine: 'B' does not match option 0", ae.checkMatch('B', qSample) === false);
assert("AnswerEngine: 'hello A' does not match option 0", ae.checkMatch('hello A', qSample) === false);
assert("AnswerEngine: 'AB' does not match option 0", ae.checkMatch('AB', qSample) === false);
assert("AnswerEngine: 'E' does not match option 0", ae.checkMatch('E', qSample) === false);

console.log('\n================================================================');
console.log(`🏁 A/B/C/D AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('================================================================\n');

process.exit(failed > 0 ? 1 : 0);
