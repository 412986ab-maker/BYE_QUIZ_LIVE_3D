/**
 * BYE QUIZ LIVE - TikTok LIVE Connector
 *
 * Provider order:
 *  1) TikTool (when TIKTOOL_API_KEY is configured) - managed JSON WebSocket.
 *  2) Euler / tiktok-live-connector - legacy compatibility path.
 *
 * The provider is intentionally isolated from the game engine so the rest of
 * the application only consumes normalized CHAT/GIFT/LIKE/SHARE/FOLLOW/ROOM_USER
 * events through eventBus.
 */
import eventBus from './eventBus.js';
import logger from './logger.js';

export const CONNECTION_STATES = {
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '');
}

function userFromTikTool(data = {}) {
  const u = data.user || {};
  return {
    id: u.id || u.userId || u.uniqueId || data.userId || data.uniqueId || 'guest',
    uniqueId: u.uniqueId || u.username || data.user_unique_id || data.uniqueId || 'guest',
    nickname: u.nickname || u.displayName || u.uniqueId || data.user_unique_id || 'مشاهد',
    avatar: u.avatar || u.avatarUrl || u.profilePictureUrl || data.avatar || null,
    isRealAvatar: Boolean(u.avatar || u.avatarUrl || u.profilePictureUrl || data.avatar)
  };
}

class TikTokConnector {
  constructor() {
    this.state = CONNECTION_STATES.OFFLINE;
    this.username = process.env.TIKTOK_USERNAME || null;
    this.roomId = null;
    this.client = null;
    this.provider = null;

    this.connectedAt = null;
    this.streamStartTime = null;
    this.lastEventTime = null;
    this.lastSuccessfulConnection = null;
    this.lastError = null;
    this.viewerCount = 0;

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseDelayMs = 2000;
    this.maxDelayMs = 30000;
    this.reconnectTimer = null;
    this.connectionTimeoutTimer = null;
    this.connectionTimeoutMs = 15000;
    this.isManualDisconnect = false;
    this.connectGeneration = 0;
    this.pendingTikToolConnect = null;
  }

  getStatus() {
    return {
      status: this.state,
      username: this.username || process.env.TIKTOK_USERNAME || null,
      roomId: this.roomId,
      provider: this.provider || (process.env.TIKTOOL_API_KEY ? 'TIKTOOL' : 'EULER'),
      connectedAt: this.connectedAt,
      streamStartTime: this.streamStartTime,
      lastEventTime: this.lastEventTime,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      viewerCount: this.viewerCount,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastError: this.lastError
    };
  }

  setState(newState, errorMsg = null) {
    const oldState = this.state;
    this.state = newState;
    if (errorMsg) this.lastError = errorMsg;

    logger.info(`TikTok Connection State Changed: ${oldState} -> ${newState}`, {
      username: this.username,
      roomId: this.roomId,
      provider: this.provider,
      error: errorMsg
    });

    eventBus.dispatch('TIKTOK_STATUS', this.getStatus(), 'TIKTOK_CONNECTOR');
  }

  clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.reconnectTimer = null;
    this.connectionTimeoutTimer = null;
  }

  markConnected(roomId = null) {
    this.roomId = roomId || this.roomId;
    this.connectedAt = this.connectedAt || Date.now();
    this.lastSuccessfulConnection = Date.now();
    this.streamStartTime = this.streamStartTime || Date.now();
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.setState(CONNECTION_STATES.CONNECTED);

    eventBus.dispatch('STREAM_START', {
      roomId: this.roomId,
      username: this.username,
      timestamp: this.connectedAt,
      provider: this.provider
    }, 'TIKTOK_LIVE');
  }

  dispatchUserEvent(type, data = {}) {
    this.lastEventTime = Date.now();
    eventBus.dispatch(type, data, 'TIKTOK_LIVE');
  }

  handleTikToolMessage(raw) {
    let msg;
    try {
      const text = typeof raw === 'string'
        ? raw
        : raw?.data instanceof ArrayBuffer
          ? new TextDecoder().decode(raw.data)
          : String(raw?.data ?? raw);
      msg = JSON.parse(text);
    } catch (error) {
      logger.warn('TikTool sent a non-JSON message', { error: error.message });
      return;
    }

    const type = msg.event || msg.type;
    const data = msg.data || {};

    if (type === 'roomInfo') {
      const roomId = msg.roomId || data.roomId || data.room_id;
      if (roomId) this.roomId = String(roomId);
      if (this.state !== CONNECTION_STATES.CONNECTED) this.markConnected(this.roomId);
      return;
    }

    const user = userFromTikTool(data);

    switch (type) {
      case 'chat':
      case 'comment':
        this.dispatchUserEvent('CHAT', {
          user,
          comment: data.comment || data.text || '',
          msgId: data.msgId || data.messageId
        });
        break;

      case 'gift':
        this.dispatchUserEvent('GIFT', {
          user,
          giftId: data.giftId || data.gift_id,
          giftName: data.giftName || data.gift_name || 'هدية',
          giftCount: Number(data.repeatCount || data.giftCount || 1),
          repeatCount: Number(data.repeatCount || data.giftCount || 1),
          diamondCount: Number(data.diamondCount || data.diamond_count || 0),
          diamonds: Number(data.diamonds || 0) ||
            (Number(data.diamondCount || data.diamond_count || 0) * Number(data.repeatCount || data.giftCount || 1)),
          repeatEnd: data.repeatEnd !== undefined ? Boolean(data.repeatEnd) : true
        });
        break;

      case 'like':
        this.dispatchUserEvent('LIKE', {
          user,
          likeCount: Number(data.likeCount || 1),
          totalLikeCount: Number(data.totalLikes || data.totalLikeCount || 0)
        });
        break;

      case 'share':
        this.dispatchUserEvent('SHARE', {
          user,
          shareCount: Number(data.shareCount || 1),
          totalShareCount: Number(data.totalShares || data.totalShareCount || 0)
        });
        break;

      case 'follow':
        this.dispatchUserEvent('FOLLOW', { user });
        break;

      case 'social':
        if (data.action === 'follow') this.dispatchUserEvent('FOLLOW', { user });
        if (data.action === 'share') this.dispatchUserEvent('SHARE', { user, shareCount: 1, totalShareCount: 0 });
        break;

      case 'member':
        // Member events are useful as a live presence signal; the authoritative
        // viewer counter comes from roomUserSeq.
        this.lastEventTime = Date.now();
        break;

      case 'roomUserSeq':
      case 'viewer_count':
        this.viewerCount = Number(data.viewerCount || data.viewer_count || 0);
        this.dispatchUserEvent('ROOM_USER', { viewerCount: this.viewerCount });
        break;

      case 'streamEnd':
      case 'liveEnd':
      case 'live.end':
        this.handleStreamEnd();
        break;

      default:
        // Preserve unknown events in logs without breaking the connection.
        logger.info('TikTool event received', { type });
        break;
    }
  }

  async connectTikTool(username, generation) {
    const apiKey = process.env.TIKTOOL_API_KEY || process.env.TIKTOOLS_API_KEY || process.env.TIKTOK_LIVE_API_KEY;
    if (!apiKey) {
      throw new Error('TIKTOOL_API_KEY غير مضبوط');
    }
    if (typeof globalThis.WebSocket !== 'function') {
      throw new Error('WebSocket غير متوفر في إصدار Node الحالي');
    }

    const uniqueId = normalizeUsername(username);
    const url = `wss://api.tik.tools?uniqueId=${encodeURIComponent(uniqueId)}&apiKey=${encodeURIComponent(apiKey)}`;

    return await new Promise((resolve, reject) => {
      let settled = false;
      let opened = false;
      const ws = new WebSocket(url);
      this.client = ws;
      this.provider = 'TIKTOOL';

      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.connectionTimeoutTimer);
        if (error) reject(error);
        else resolve({ success: true, status: this.state, roomId: this.roomId, provider: this.provider });
      };

      this.connectionTimeoutTimer = setTimeout(() => {
        if (!settled) {
          try { ws.close(); } catch (_) {}
          finish(new Error('انتهت مهلة الاتصال بمزوّد TikTool'));
        }
      }, this.connectionTimeoutMs);

      ws.addEventListener('open', () => {
        if (generation !== this.connectGeneration || this.isManualDisconnect) return;
        opened = true;
        // A live socket is already established. Wait briefly for roomInfo so
        // the admin can see the real room id before reporting success.
        this.setState(CONNECTION_STATES.CONNECTED);
        setTimeout(() => {
          if (!settled && opened) finish();
        }, 2500);
      });

      ws.addEventListener('message', event => {
        if (generation !== this.connectGeneration || this.isManualDisconnect) return;
        this.handleTikToolMessage(event);
        if (this.state === CONNECTION_STATES.CONNECTED && this.roomId) finish();
      });

      ws.addEventListener('error', event => {
        const message = event?.message || 'TikTool WebSocket error';
        this.lastError = message;
        if (!settled) finish(new Error(message));
      });

      ws.addEventListener('close', event => {
        if (generation !== this.connectGeneration) return;
        if (!settled) {
          finish(new Error(`TikTool WebSocket closed before connection (code ${event?.code ?? 'unknown'})`));
        }
        if (!this.isManualDisconnect) {
          this.handleDisconnectOrError(new Error(`TikTool WebSocket closed (code ${event?.code ?? 'unknown'})`));
        }
      });
    });
  }

  async connectEuler(username, generation) {
    const { WebcastPushConnection } = await import('tiktok-live-connector/legacy');

    if (generation !== this.connectGeneration) {
      throw new Error('محاولة اتصال قديمة تم إلغاؤها');
    }

    this.provider = 'EULER';
    this.client = new WebcastPushConnection(username, {
      signApiKey: process.env.SIGN_API_KEY || undefined,
      processInitialData: false,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 1000,
      clientParams: {
        app_language: 'ar-SA',
        webcast_language: 'ar-SA'
      }
    });

    this.setupEulerListeners();
    const connectionState = await this.client.connect();
    if (generation !== this.connectGeneration) {
      try { this.client.disconnect(); } catch (_) {}
      throw new Error('محاولة اتصال قديمة تم إلغاؤها');
    }

    this.roomId = connectionState.roomId;
    this.markConnected(this.roomId);
    return { success: true, status: this.state, roomId: this.roomId, provider: this.provider };
  }

  setupEulerListeners() {
    if (!this.client) return;

    this.client.on('chat', data => {
      this.dispatchUserEvent('CHAT', {
        id: data.userId || data.uniqueId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl,
        comment: data.comment,
        msgId: data.msgId
      });
    });

    this.client.on('gift', data => {
      this.dispatchUserEvent('GIFT', {
        id: data.userId || data.uniqueId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl,
        giftId: data.giftId,
        giftName: data.giftName,
        giftCount: data.repeatCount || 1,
        diamondCount: data.diamondCount || 0,
        repeatEnd: data.repeatEnd !== undefined ? data.repeatEnd : true
      });
    });

    this.client.on('like', data => {
      this.dispatchUserEvent('LIKE', {
        id: data.userId || data.uniqueId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl,
        likeCount: data.likeCount || 1,
        totalLikeCount: data.totalLikeCount || 0
      });
    });

    this.client.on('share', data => {
      this.dispatchUserEvent('SHARE', {
        id: data.userId || data.uniqueId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl,
        shareCount: data.shareCount || 1,
        totalShareCount: data.totalShareCount || 0
      });
    });

    this.client.on('follow', data => {
      this.dispatchUserEvent('FOLLOW', {
        id: data.userId || data.uniqueId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl
      });
    });

    this.client.on('roomUser', data => {
      this.viewerCount = data.viewerCount || 0;
      this.dispatchUserEvent('ROOM_USER', { viewerCount: this.viewerCount });
    });

    this.client.on('streamEnd', () => this.handleStreamEnd());

    this.client.on('disconnected', () => {
      if (!this.isManualDisconnect) {
        this.handleDisconnectOrError(new Error('انقطع اتصال البث المباشر بشكل مفاجئ'));
      }
    });

    this.client.on('error', err => this.handleDisconnectOrError(err));
  }

  handleStreamEnd() {
    this.clearTimers();
    this.setState(CONNECTION_STATES.OFFLINE, 'انتهى البث المباشر');
    eventBus.dispatch('STREAM_END', { timestamp: Date.now() }, 'TIKTOK_LIVE');
  }

  async connect(username = this.username) {
    if (!username || typeof username !== 'string') {
      const err = 'اسم مستخدم تيك توك غير صالح';
      this.setState(CONNECTION_STATES.ERROR, err);
      return { success: false, error: err };
    }

    this.username = username.trim();
    this.isManualDisconnect = false;
    this.clearTimers();
    this.connectGeneration += 1;
    const generation = this.connectGeneration;

    if (this.client) {
      try { this.client.close?.(); } catch (_) {}
      try { this.client.disconnect?.(); } catch (_) {}
      this.client = null;
    }

    this.roomId = null;
    this.connectedAt = null;
    this.streamStartTime = null;
    this.lastError = null;
    this.setState(CONNECTION_STATES.CONNECTING);

    try {
      const useTikTool = Boolean(
        process.env.TIKTOOL_API_KEY ||
        process.env.TIKTOOLS_API_KEY ||
        process.env.TIKTOK_LIVE_API_KEY
      );

      return useTikTool
        ? await this.connectTikTool(this.username, generation)
        : await this.connectEuler(normalizeUsername(this.username), generation);
    } catch (err) {
      if (generation !== this.connectGeneration || this.isManualDisconnect) {
        return { success: false, error: 'تم إلغاء محاولة الاتصال السابقة', status: this.state };
      }
      clearTimeout(this.connectionTimeoutTimer);
      logger.warn(`Failed to connect to TikTok LIVE for @${this.username}`, {
        provider: this.provider,
        error: err.message
      });
      this.handleDisconnectOrError(err);
      return { success: false, error: err.message, status: this.state, provider: this.provider };
    }
  }

  handleDisconnectOrError(err) {
    if (this.isManualDisconnect) {
      this.setState(CONNECTION_STATES.OFFLINE);
      return;
    }

    const message = err?.message || String(err) || 'Unknown error';
    this.lastError = message;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      this.setState(CONNECTION_STATES.RECONNECTING, message);

      const delay = Math.min(
        this.baseDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
        this.maxDelayMs
      );

      logger.warn(`Scheduling auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms...`);

      this.reconnectTimer = setTimeout(() => {
        this.connect(this.username);
      }, delay);
    } else {
      this.setState(
        CONNECTION_STATES.ERROR,
        `فشل الاتصال بعد ${this.maxReconnectAttempts} محاولات: ${message}`
      );
    }
  }

  disconnect() {
    this.isManualDisconnect = true;
    this.connectGeneration += 1;
    this.clearTimers();

    if (this.client) {
      try { this.client.close?.(); } catch (_) {}
      try { this.client.disconnect?.(); } catch (_) {}
      this.client = null;
    }

    this.roomId = null;
    this.connectedAt = null;
    this.streamStartTime = null;
    this.setState(CONNECTION_STATES.OFFLINE);
    eventBus.dispatch('DISCONNECT', { timestamp: Date.now() }, 'TIKTOK_CONNECTOR');
    return { success: true, status: this.state };
  }

  reconnect() {
    const username = this.username || process.env.TIKTOK_USERNAME;
    this.disconnect();
    this.reconnectAttempts = 0;
    return this.connect(username);
  }
}

export const tiktokConnector = new TikTokConnector();
export default tiktokConnector;
