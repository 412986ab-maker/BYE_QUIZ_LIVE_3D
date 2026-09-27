import eventBus from './eventBus.js';
import db from './database.js';
import logger from './logger.js';

// Automatic participant collection -> preparation -> question flow.
// Loaded as a side-effect module from commandParser to preserve the existing game engine.
let game = null;
let collectionTimer = null;
let preparationTimer = null;
let remaining = 0;
let initialized = false;

const DEFAULT_COLLECTION_SECONDS = 30;
const DEFAULT_PREPARATION_SECONDS = 5;

async function getGame() {
  if (!game) {
    const mod = await import('./serverGameState.js');
    game = mod.serverGameState;
  }
  return game;
}

function clearTimers() {
  if (collectionTimer) clearInterval(collectionTimer);
  if (preparationTimer) clearTimeout(preparationTimer);
  collectionTimer = null;
  preparationTimer = null;
}

async function prepareAndStart() {
  const state = await getGame();
  if (state.state !== 'PLAYER_SELECTION') return;

  if (state.drawPool.length === 0) {
    eventBus.dispatch('COLLECTION_EMPTY', {
      roundNumber: state.roundNumber,
      reason: 'NO_PARTICIPANTS'
    }, 'AUTO_FLOW');
    state.setState('LOBBY');
    return;
  }

  if (state.setState) state.setState('PREPARING');

  let questionId = null;
  try {
    const list = db.getQuestionsSync ? db.getQuestionsSync() : (db.collections?.questions || []);
    if (Array.isArray(list) && list.length) {
      const q = list[Math.floor(Math.random() * list.length)];
      questionId = q?.id ?? null;
    }
  } catch (error) {
    logger.warn('Automatic question preparation failed', { error: error.message });
  }

  const prepSeconds = Math.max(1, Number(state.preparationDuration) || DEFAULT_PREPARATION_SECONDS);
  remaining = prepSeconds;

  eventBus.dispatch('QUESTION_PREPARING', {
    roundNumber: state.roundNumber,
    participantsCount: state.drawPool.length,
    preparationDuration: prepSeconds,
    remaining,
    questionReady: Boolean(questionId)
  }, 'AUTO_FLOW');

  const tick = setInterval(() => {
    remaining -= 1;
    eventBus.dispatch('PREPARATION_TICK', {
      remaining: Math.max(remaining, 0),
      duration: prepSeconds,
      participantsCount: state.drawPool.length
    }, 'AUTO_FLOW');
    if (remaining <= 0) clearInterval(tick);
  }, 1000);

  preparationTimer = setTimeout(async () => {
    if (state.state !== 'PREPARING') return;
    try {
      await state.startQuestion(questionId);
    } catch (error) {
      logger.error('Automatic question start failed', { error: error.message });
      state.setState('LOBBY');
    }
  }, prepSeconds * 1000);
}

async function startCollection(reason = 'START_GAME') {
  const state = await getGame();
  clearTimers();

  if (state.state === 'QUESTION' || state.state === 'ANSWERING' || state.state === 'RESULT' || state.state === 'WINNER') return;

  if (state.drawPool.length === 0) {
    state.setState('PLAYER_SELECTION');
  } else if (state.state !== 'PLAYER_SELECTION') {
    state.setState('PLAYER_SELECTION');
  }

  const configured = Number(state.collectionDuration);
  const duration = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_COLLECTION_SECONDS;
  remaining = duration;

  eventBus.dispatch('COLLECTION_STARTED', {
    roundNumber: state.roundNumber,
    duration,
    remaining,
    target: state.targetParticipants,
    reason
  }, 'AUTO_FLOW');

  collectionTimer = setInterval(async () => {
    remaining -= 1;
    eventBus.dispatch('COLLECTION_TICK', {
      remaining: Math.max(remaining, 0),
      duration,
      count: state.drawPool.length,
      target: state.targetParticipants
    }, 'AUTO_FLOW');

    const targetReached = state.targetParticipants > 0 && state.drawPool.length >= state.targetParticipants;
    if (remaining <= 0 || targetReached) {
      clearInterval(collectionTimer);
      collectionTimer = null;
      eventBus.dispatch('COLLECTION_CLOSED', {
        roundNumber: state.roundNumber,
        count: state.drawPool.length,
        target: state.targetParticipants,
        reason: targetReached ? 'TARGET_REACHED' : 'TIME_EXPIRED'
      }, 'AUTO_FLOW');
      await prepareAndStart();
    }
  }, 1000);
}

async function init() {
  if (initialized) return;
  initialized = true;
  eventBus.on('event', async (envelope) => {
    try {
      if (envelope.type === 'START_GAME') {
        const state = await getGame();
        if (state.autoCollection) await startCollection('START_GAME');
      } else if (envelope.type === 'ROUND_STARTED') {
        const state = await getGame();
        if (state.autoCollection) await startCollection('ROUND_STARTED');
      } else if (envelope.type === 'RESET_ALL' || envelope.type === 'GAME_RESET') {
        clearTimers();
      }
    } catch (error) {
      logger.error('Automatic participant flow error', { error: error.message });
    }
  });
}

init();

export { startCollection };
