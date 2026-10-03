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
let accountsCache = null;

function normalize(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  // Accept plain handles, @handles, and pasted TikTok profile URLs.
  raw = raw
    .replace(/^https?:\/\/(?:www\.)?tiktok\.com\//i, '')
    .replace(/^https?:\/\/(?:m\.)?tiktok\.com\//i, '')
    .split(/[?#]/, 1)[0]
    .replace(/^@/, '')
    .replace(/\/$/, '');

  // Some users paste the profile path as /@name.
  raw = raw.replace(/^@/, '');
  return raw.toLowerCase();
}

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function normalizeConfig(raw = {}) {
  return {
    id: cleanText(raw.id || '', 64),
    uniqueId: cleanText(raw.uniqueId || '', 500)
      .trim()
      .replace(/^https?:\/\/(?:www\.)?tiktok\.com\//i, '')
      .replace(/^https?:\/\/(?:m\.)?tiktok\.com\//i, '')
      .split(/[?#]/, 1)[0]
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .slice(0, 64),
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
  if (!envelope) return;

  if (envelope.type === 'SPECIAL_ENTRANCES_UPDATED' || envelope.type === 'SETTINGS_UPDATED') {
    const next = envelope.payload || envelope;
    const specialEntrances = Array.isArray(next)
      ? next
      : (Array.isArray(next.specialEntrances) ? next.specialEntrances : []);
    accountsCache = getConfiguredAccounts(
      envelope.type === 'SPECIAL_ENTRANCES_UPDATED'
        ? { specialEntrances }
        : next
    );
    return;
  }

  if (envelope.type !== 'MEMBER') return;

  const user = envelope.user || {};
  const uniqueId = normalize(user.uniqueId || user.id);
  if (!uniqueId) return;

  const now = Date.now();
  const previous = recentEntrances.get(uniqueId) || 0;
  if (now - previous < DEDUPE_MS) return;

  try {
    if (!accountsCache) {
      const settings = await db.getSettings();
      accountsCache = getConfiguredAccounts(settings);
    }

    const match = accountsCache.find(
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

    const liveDisplayName = cleanText(user.displayName || user.nickname || uniqueId, 64);
    const liveAvatar = cleanText(user.avatar || user.profilePictureUrl || '', 500);
    const config = {
      ...match,
      // TikTok LIVE is the authoritative source for the real profile identity.
      // Manual displayName/imageUrl are only fallbacks when TikTok does not send them.
      displayName: liveDisplayName || match.displayName || uniqueId,
      imageUrl: liveAvatar || match.imageUrl || ''
    };

    eventBus.dispatch('SPECIAL_ENTRANCE', {
      user,
      config,
      member: envelope.payload || {},
      timestamp: now
    }, 'SPECIAL_ENTRANCE');

    // Persist the live profile metadata so the admin list can show the real
    // TikTok name/avatar after the first actual appearance in the LIVE.
    if (liveDisplayName || liveAvatar) {
      try {
        const settings = await db.getSettings();
        const list = Array.isArray(settings.specialEntrances) ? [...settings.specialEntrances] : [];
        const index = list.findIndex(item => normalize(item.uniqueId) === uniqueId);
        if (index >= 0) {
          const next = { ...list[index] };
          let changed = false;
          if (liveDisplayName && next.displayName !== liveDisplayName) { next.displayName = liveDisplayName; changed = true; }
          if (liveAvatar && next.imageUrl !== liveAvatar) { next.imageUrl = liveAvatar; changed = true; }
          if (changed) {
            list[index] = next;
            await db.setSetting('specialEntrances', list);
            accountsCache = getConfiguredAccounts({ specialEntrances: list });
            eventBus.dispatch('SPECIAL_ENTRANCES_UPDATED', list, 'TIKTOK_LIVE_PROFILE');
          }
        }
      } catch (profileSaveError) {
        logger.warn('Special entrance profile cache update failed', { error: profileSaveError.message });
      }
    }

    logger.info('Special entrance triggered', {
      uniqueId,
      displayName: config.displayName,
      hasRealAvatar: Boolean(liveAvatar),
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
