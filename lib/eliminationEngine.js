/**
 * BYE QUIZ LIVE - Elimination Engine
 * Deterministic round qualification engine.
 *
 * The engine does not own the UI or round lifecycle. It receives the current
 * round pool and returns an immutable elimination decision:
 *   - survivors: players who continue
 *   - eliminated: players who leave the active seats
 *   - finalists: the final-round candidates
 *
 * Default policy:
 *   - LOWEST_SCORE
 *   - keep 50% of the active pool (rounded up)
 *   - never keep fewer than 2 players while a normal round continues
 *   - final round can narrow to finalistCount (default 3)
 */

export const ELIMINATION_MODES = Object.freeze({
  LOWEST_SCORE: 'LOWEST_SCORE',
  LOWEST_CORRECT: 'LOWEST_CORRECT',
  SCORE_THEN_SPEED: 'SCORE_THEN_SPEED'
});

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rankPlayers(players, mode) {
  return [...players].sort((a, b) => {
    if (mode === ELIMINATION_MODES.LOWEST_CORRECT) {
      return (
        numeric(b.correctAnswers) - numeric(a.correctAnswers) ||
        numeric(b.score) - numeric(a.score) ||
        numeric(a.wrongAnswers) - numeric(b.wrongAnswers) ||
        String(a.id).localeCompare(String(b.id))
      );
    }

    if (mode === ELIMINATION_MODES.SCORE_THEN_SPEED) {
      return (
        numeric(b.score) - numeric(a.score) ||
        numeric(b.correctAnswers) - numeric(a.correctAnswers) ||
        numeric(a.firstSpeed, Number.POSITIVE_INFINITY) -
          numeric(b.firstSpeed, Number.POSITIVE_INFINITY) ||
        numeric(a.wrongAnswers) - numeric(b.wrongAnswers) ||
        String(a.id).localeCompare(String(b.id))
      );
    }

    return (
      numeric(b.score) - numeric(a.score) ||
      numeric(b.correctAnswers) - numeric(a.correctAnswers) ||
      numeric(a.wrongAnswers) - numeric(b.wrongAnswers) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
}

export function calculateElimination(players = [], options = {}) {
  const mode = Object.values(ELIMINATION_MODES).includes(options.mode)
    ? options.mode
    : ELIMINATION_MODES.LOWEST_SCORE;

  const cleanPlayers = players.filter(Boolean).map((player, index) => ({
    ...player,
    _eliminationIndex: index
  }));

  if (cleanPlayers.length <= 1) {
    return {
      mode,
      total: cleanPlayers.length,
      survivorCount: cleanPlayers.length,
      eliminatedCount: 0,
      survivors: cleanPlayers.map(({ _eliminationIndex, ...p }) => p),
      eliminated: [],
      finalists: cleanPlayers.map(({ _eliminationIndex, ...p }) => p),
      cutoffScore: null,
      generatedAt: Date.now()
    };
  }

  const ranked = rankPlayers(cleanPlayers, mode);
  const finalRound = Boolean(options.finalRound);
  const configuredFinalists = Math.max(1, Math.floor(numeric(options.finalistCount, 3)));

  let survivorCount;
  if (finalRound) {
    survivorCount = Math.min(
      ranked.length,
      Math.max(1, configuredFinalists)
    );
  } else {
    const ratio = Math.min(
      0.95,
      Math.max(0.25, numeric(options.survivorRatio, 0.5))
    );
    survivorCount = Math.ceil(ranked.length * ratio);

    // A normal round must leave enough people for a real competition.
    if (ranked.length > 2) {
      survivorCount = Math.min(
        ranked.length - 1,
        Math.max(2, survivorCount)
      );
    }
  }

  const survivors = ranked.slice(0, survivorCount);
  const eliminated = ranked.slice(survivorCount);

  // Do not split a score tie at the cutoff in normal rounds unless that
  // would leave everybody alive. This keeps elimination fair and deterministic.
  if (!finalRound && survivors.length && eliminated.length) {
    const cutoff = survivors[survivors.length - 1];
    const next = eliminated[0];
    if (
      numeric(cutoff.score) === numeric(next.score) &&
      numeric(cutoff.correctAnswers) === numeric(next.correctAnswers)
    ) {
      let i = eliminated.length;
      while (
        i > 0 &&
        numeric(eliminated[i - 1].score) === numeric(cutoff.score) &&
        numeric(eliminated[i - 1].correctAnswers) === numeric(cutoff.correctAnswers)
      ) {
        i--;
      }
      const tied = eliminated.slice(i);
      survivors.push(...tied);
      eliminated.splice(i, tied.length);
    }
  }

  return {
    mode,
    total: ranked.length,
    survivorCount: survivors.length,
    eliminatedCount: eliminated.length,
    survivors: survivors.map(({ _eliminationIndex, ...p }) => p),
    eliminated: eliminated.map(({ _eliminationIndex, ...p }) => p),
    finalists: survivors.map(({ _eliminationIndex, ...p }) => p),
    cutoffScore: survivors.length ? numeric(survivors[survivors.length - 1].score) : null,
    generatedAt: Date.now()
  };
}

export default {
  ELIMINATION_MODES,
  calculateElimination
};
