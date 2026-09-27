/**
 * BYE QUIZ LIVE — Special Entrance Manager
 * Matches TikTok LIVE member events against admin-configured VIP accounts
 * and emits a small cinematic overlay event to every connected game client.
 */
import eventBus from './eventBus.js';
import db from './database.js';
import logger from './logger.js';

const DEFAULT_DURATION = 3200;
const MIN_DURATION = 1500;
const MAX_DURATION = 8000;
const DEDUPE_MS = 15000;

const recentEntrances = new Map();

function normalize(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function normalizeConfig(raw = {}) {
  return {
    id: cleanText(raw.id || '', 64),
    uniqueId: cleanText(raw.uniqueId || '', 64).replace(/^@/, ''),
    displayName: cleanText(raw.displayName || '', 64),
    title: cleanText(raw.title || 'SPECIAL ENTRANCE', 48),
    subtitle: cleanText(raw.subtitle || 'دخول مميز', 80),
    tier: cleanText(raw.tier || 'VIP', 24).toUpperCase(),
    effect: cleanText(raw.effect || 'portal', 24).toLowerCase(),
    duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(raw.duration) || DEFAULT_DURATION)),
    imageUrl: cleanText(raw.imageUrl || '', 500),
    enabled: raw.enabled !== false
  };
}

function getConfiguredAccounts(settings = {}) {
  return Array.isArray(settings.specialEntrances)
    ? settings.specialEntrances.map(normalizeConfig).filter(item => item.uniqueId)
    : [];
}

eventBus.on('event', async (envelope) => {
  if (!envelope || envelope.type !== 'MEMBER') return;

  const user = envelope.user || {};
  const uniqueId = normalize(user.uniqueId || user.id);
  if (!uniqueId) return;

  const now = Date.now();
  const previous = recentEntrances.get(uniqueId) || 0;
  if (now - previous < DEDUPE_MS) return;

  try {
    const settings = await db.getSettings();
    const match = getConfiguredAccounts(settings).find(
      item => item.enabled && normalize(item.uniqueId) === uniqueId
    );
    if (!match) return;

    recentEntrances.set(uniqueId, now);

    // Keep the map bounded during long broadcasts.
    if (recentEntrances.size > 1000) {
      for (const [key, timestamp] of recentEntrances) {
        if (now - timestamp > DEDUPE_MS) recentEntrances.delete(key);
      }
    }

    const config = {
      ...match,
      displayName: match.displayName || user.displayName || user.nickname || uniqueId
    };

    eventBus.dispatch('SPECIAL_ENTRANCE', {
      user,
      config,
      member: envelope.payload || {},
      timestamp: now
    }, 'SPECIAL_ENTRANCE');

    logger.info('Special entrance triggered', {
      uniqueId,
      tier: config.tier,
      effect: config.effect
    });
  } catch (error) {
    logger.warn('Special entrance lookup failed', { error: error.message });
  }
});

export function validateSpecialEntrance(input = {}) {
  const item = normalizeConfig(input);
  if (!item.uniqueId) return { success: false, error: 'اسم مستخدم TikTok مطلوب' };
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(item.uniqueId)) {
    return { success: false, error: 'اسم المستخدم يحتوي على أحرف غير صالحة' };
  }

  const allowedEffects = new Set(['portal', 'gold', 'neon', 'lightning', 'cinematic']);
  if (!allowedEffects.has(item.effect)) item.effect = 'portal';

  const allowedTiers = new Set(['VIP', 'LEGEND', 'DIAMOND', 'SPECIAL', 'CUSTOM']);
  if (!allowedTiers.has(item.tier)) item.tier = 'CUSTOM';

  return { success: true, item };
}

export { normalizeConfig, getConfiguredAccounts };
