/**
 * BYE QUIZ LIVE - Master Blueprint Phase Machine
 *
 * The legacy server state names remain compatible with the existing client.
 * This module adds a canonical phase layer so the runtime follows the
 * technical blueprint without forcing a breaking UI rewrite.
 */

export const GAME_PHASES = Object.freeze({
  STUDIO_INTRO: 'STUDIO_INTRO',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  SUSPENSE: 'SUSPENSE',
  PREPARING: 'PREPARING',
  QUESTION: 'QUESTION',
  ANSWER_LOCK: 'ANSWER_LOCK',
  QUESTION_RESULT: 'QUESTION_RESULT',
  ROUND_RESULTS: 'ROUND_RESULTS',
  ELIMINATION: 'ELIMINATION',
  DRAW: 'DRAW',
  NEXT_ROUND_REGISTRATION: 'NEXT_ROUND_REGISTRATION',
  FINAL: 'FINAL',
  CHAMPION: 'CHAMPION',
  VICTORY: 'VICTORY'
});

const TRANSITIONS = {
  STUDIO_INTRO: new Set(['REGISTRATION_OPEN']),
  REGISTRATION_OPEN: new Set(['REGISTRATION_CLOSED', 'SUSPENSE']),
  REGISTRATION_CLOSED: new Set(['SUSPENSE', 'PREPARING']),
  SUSPENSE: new Set(['PREPARING', 'REGISTRATION_OPEN']),
  PREPARING: new Set(['QUESTION', 'REGISTRATION_OPEN']),
  QUESTION: new Set(['ANSWER_LOCK', 'QUESTION_RESULT']),
  ANSWER_LOCK: new Set(['QUESTION_RESULT']),
  QUESTION_RESULT: new Set(['ROUND_RESULTS', 'ELIMINATION', 'DRAW']),
  ROUND_RESULTS: new Set(['ELIMINATION', 'DRAW', 'NEXT_ROUND_REGISTRATION', 'FINAL']),
  ELIMINATION: new Set(['DRAW', 'NEXT_ROUND_REGISTRATION', 'FINAL']),
  DRAW: new Set(['NEXT_ROUND_REGISTRATION', 'FINAL', 'CHAMPION']),
  NEXT_ROUND_REGISTRATION: new Set(['REGISTRATION_OPEN', 'REGISTRATION_CLOSED']),
  FINAL: new Set(['CHAMPION', 'VICTORY']),
  CHAMPION: new Set(['VICTORY', 'STUDIO_INTRO']),
  VICTORY: new Set(['STUDIO_INTRO', 'REGISTRATION_OPEN'])
};

export function isValidPhase(value) {
  return Object.prototype.hasOwnProperty.call(GAME_PHASES, value);
}

export function canTransitionPhase(from, to) {
  if (!from || from === to) return true;
  if (!isValidPhase(from) || !isValidPhase(to)) return false;
  return Boolean(TRANSITIONS[from]?.has(to));
}

export function legacyStateToPhase(state, context = {}) {
  switch (state) {
    case 'LOBBY':
      return context.hasStarted ? GAME_PHASES.REGISTRATION_OPEN : GAME_PHASES.STUDIO_INTRO;
    case 'PLAYER_SELECTION':
      return GAME_PHASES.REGISTRATION_OPEN;
    case 'PREPARING':
      return GAME_PHASES.PREPARING;
    case 'QUESTION':
    case 'ANSWERING':
      return GAME_PHASES.QUESTION;
    case 'RESULT':
      return GAME_PHASES.QUESTION_RESULT;
    case 'WINNER':
      return GAME_PHASES.DRAW;
    case 'NEXT_ROUND':
      return GAME_PHASES.NEXT_ROUND_REGISTRATION;
    case 'ENDED':
      return GAME_PHASES.VICTORY;
    default:
      return GAME_PHASES.STUDIO_INTRO;
  }
}

export function phaseToLegacyState(phase) {
  switch (phase) {
    case GAME_PHASES.REGISTRATION_OPEN:
    case GAME_PHASES.REGISTRATION_CLOSED:
    case GAME_PHASES.NEXT_ROUND_REGISTRATION:
      return 'PLAYER_SELECTION';
    case GAME_PHASES.PREPARING:
      return 'PREPARING';
    case GAME_PHASES.QUESTION:
      return 'QUESTION';
    case GAME_PHASES.ANSWER_LOCK:
      return 'ANSWERING';
    case GAME_PHASES.QUESTION_RESULT:
    case GAME_PHASES.ROUND_RESULTS:
      return 'RESULT';
    case GAME_PHASES.DRAW:
    case GAME_PHASES.CHAMPION:
      return 'WINNER';
    case GAME_PHASES.VICTORY:
      return 'ENDED';
    default:
      return 'LOBBY';
  }
}

export function phaseDurationMs(phase, settings = {}) {
  const seconds = {
    [GAME_PHASES.SUSPENSE]: settings.suspenseDuration,
    [GAME_PHASES.PREPARING]: settings.preparationDuration,
    [GAME_PHASES.ANSWER_LOCK]: settings.answerLockDuration,
    [GAME_PHASES.VICTORY]: settings.victoryDuration
  }[phase];

  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

export function createPhaseRecord(phase, settings = {}, now = Date.now()) {
  const durationMs = phaseDurationMs(phase, settings);
  return {
    phase,
    startedAt: now,
    endsAt: durationMs > 0 ? now + durationMs : null,
    durationMs,
    serverTime: now
  };
}

export function getTransitionTable() {
  return Object.fromEntries(
    Object.entries(TRANSITIONS).map(([key, values]) => [key, [...values]])
  );
}
