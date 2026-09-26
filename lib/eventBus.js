/**
 * Central Event Normalizer & Event Bus
 * Standardizes raw events into uniform event envelopes.
 * Preserves Display Names & Real Profile Pictures from source.
 */
import { EventEmitter } from 'node:events';
import logger from './logger.js';
import { sanitizeText, sanitizeUserId } from './security.js';

export class EventNormalizer {
  static normalize(rawType, rawData, source = 'TIKTOK_LIVE') {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(4, 9)}`;
    const timestamp = Date.now();

    // User details extraction (Prioritizes Display Name & Real Profile Picture)
    const rawUser = rawData?.user || rawData || {};
    const userId = sanitizeUserId(rawUser.id || rawUser.userId || rawUser.uniqueId || '');
    const uniqueId = sanitizeText(rawUser.uniqueId || rawUser.username || userId || 'guest', 64);
    
    // Priority: Display Name / Nickname -> Name -> UniqueId
    const rawDisplayName = rawUser.displayName || rawUser.nickname || rawUser.name || rawUser.uniqueId || 'مشاهد';
    const displayName = sanitizeText(rawDisplayName, 64);
    const nickname = displayName;

    // Real Profile Picture / Avatar extraction (falls back to Dicebear ONLY if none provided)
    const realAvatar = rawUser.profilePictureUrl || rawUser.profilePicture || rawUser.avatarUrl || rawUser.avatar || null;
    const avatar = realAvatar ? sanitizeText(realAvatar, 500) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uniqueId)}`;

    const user = {
      id: userId || `u_${uniqueId}`,
      uniqueId,
      nickname,
      displayName,
      avatar,
      isRealAvatar: Boolean(realAvatar)
    };

    let type = rawType.toUpperCase();
    let payload = { ...rawData };

    switch (type) {
      case 'CHAT':
      case 'COMMENT': {
        type = 'CHAT';
        payload = {
          comment: sanitizeText(rawData.comment || rawData.text || '', 300),
          msgId: rawData.msgId || `msg_${Date.now()}_${Math.random().toString(36).substring(4)}`
        };
        break;
      }

      case 'GIFT': {
        const giftCount = parseInt(rawData.giftCount || rawData.repeatCount || 1, 10);
        const diamondCount = parseInt(rawData.diamondCount || 0, 10);
        const diamonds = rawData.diamonds || (diamondCount * giftCount);
        payload = {
          giftId: rawData.giftId || 'gift_custom',
          giftName: sanitizeText(rawData.giftName || 'هدية', 64),
          giftCount,
          diamondCount,
          diamonds,
          repeatEnd: rawData.repeatEnd !== undefined ? rawData.repeatEnd : true
        };
        break;
      }

      case 'LIKE': {
        payload = {
          likeCount: parseInt(rawData.likeCount || 1, 10),
          totalLikeCount: parseInt(rawData.totalLikeCount || 0, 10)
        };
        break;
      }

      case 'SHARE': {
        payload = {
          shareCount: parseInt(rawData.shareCount || 1, 10),
          totalShareCount: parseInt(rawData.totalShareCount || 0, 10)
        };
        break;
      }

      case 'FOLLOW': {
        payload = {};
        break;
      }

      case 'ROOM_USER':
      case 'VIEWER_UPDATE': {
        type = 'ROOM_USER';
        payload = {
          viewerCount: parseInt(rawData.viewerCount !== undefined ? rawData.viewerCount : (rawData.count || 0), 10)
        };
        break;
      }

      case 'STREAM_START':
      case 'STREAM_END':
      case 'DISCONNECT':
      case 'ERROR': {
        payload = {
          message: sanitizeText(rawData.message || '', 200),
          reason: rawData.reason || ''
        };
        break;
      }

      default:
        break;
    }

    return {
      id,
      type,
      timestamp,
      source,
      user,
      payload
    };
  }
}

class CentralEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  dispatch(rawType, rawData, source = 'TIKTOK_LIVE') {
    const envelope = EventNormalizer.normalize(rawType, rawData, source);
    
    // Structured log for essential events
    if (envelope.type === 'CHAT' || envelope.type === 'GIFT' || envelope.type === 'ERROR') {
      logger.event(`Event dispatched: ${envelope.type}`, {
        id: envelope.id,
        user: envelope.user.displayName,
        type: envelope.type
      });
    }

    // Emit generic and specific events
    this.emit('event', envelope);
    this.emit(`event:${envelope.type}`, envelope);
    return envelope;
  }
}

export const eventBus = new CentralEventBus();
export default eventBus;
