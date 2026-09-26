/**
 * BYE QUIZ LIVE - Master Game Engine Entry
 * Initializes Subsystems, binds Central Event Bus to Network,
 * tracks 5 Realtime Metrics, and routes Admin Stage Transitions instantly.
 */
class GameEngine {
  constructor() {
    this.events = new EventManager();
    this.state = new GameState(this.events);
    this.questions = new QuestionEngine(this.events, this.state);
    this.participants = new ParticipantManager(this.events, this.state);
    this.answers = new AnswerEngine(this.events, this.state, this.participants, this.questions);
    this.draw = new DrawEngine(this.events, this.state, this.participants);
    this.score = new ScoreEngine(this.events, this.state, this.participants);
    this.stats = new StatisticsEngine(this.events, this.state);
    this.reaction = new ReactionEngine(this.events, this.state);
    this.milestones = new MilestoneEngine(this.events, this.state);
    this.aggregator = new ReactionAggregator(this.events, this.state);
    this.queue = new ReactionQueue(this.events, this.state);
    this.effects = new EffectManager(this.events, this.state);
    this.scenes = new SceneManager(
      this.events,
      this.state,
      this.participants,
      this.questions,
      this.stats
    );
    this.round = new RoundManager(
      this.events,
      this.state,
      this.participants,
      this.questions,
      this.draw,
      this.scenes
    );

    // Initialize 3D WebGL Studio Engine (with graceful fallback)
    if (typeof Scene3DEngine !== 'undefined' && typeof window !== 'undefined') {
      try {
        window.scene3dEngine = new Scene3DEngine('webgl-stage');
      } catch (e) {
        console.warn('[GameEngine] Scene3DEngine init bypassed:', e);
      }
    }

    this.sseConnection = null;
    this.initNetworkBridge();
  }

  start() {
    this.scenes.render("WAITING");
  }

  applyAuthoritativeSettings(settings = {}) {
    const target = Number(settings.targetParticipants);
    const duration = Number(settings.questionDuration);
    const participantEl = document.getElementById("stat-participants");
    const timerEl = document.getElementById("timer-text");
    if (participantEl) {
      const count = this.participants?.drawPool?.length ?? this.participants?.participants?.length ?? 0;
      participantEl.textContent = String(count);
    }
    if (timerEl && Number.isFinite(duration) && duration > 0) {
      timerEl.textContent = String(duration);
    }
    document.documentElement.style.setProperty("--bye-target-participants", Number.isFinite(target) ? String(target) : "36");
  }

  updateLiveIndicator(status) {
    const liveTag = document.getElementById("live-status-pill");
    if (!liveTag) return;

    if (status === "CONNECTED") {
      liveTag.style.background = "linear-gradient(135deg, #10b981, #059669)";
      liveTag.style.color = "#ffffff";
      liveTag.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.6)";
      liveTag.classList.add("pulse-active");
    } else {
      liveTag.style.background = "rgba(15, 23, 42, 0.7)";
      liveTag.style.color = "var(--text-dim)";
      liveTag.style.boxShadow = "none";
      liveTag.classList.remove("pulse-active");
    }
  }

  initNetworkBridge() {
    if (typeof EventSource === "undefined") return;

    this.sseConnection = new EventSource("/api/events");

    this.sseConnection.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerEvent(msg);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    this.sseConnection.onerror = () => {
      this.updateLiveIndicator("OFFLINE");
    };
  }

  handleServerEvent(msg) {
    if (!msg || !msg.type) return;
    const { type, payload, user } = msg;

    // LIVE status indicator and initial snapshot state
    if (type === "INIT_SNAPSHOT" && payload) {
      if (payload.tiktok) this.updateLiveIndicator(payload.tiktok.status);
      if (payload.settings) {
        const mergedSettings = { ...this.state.get("settings"), ...payload.settings };
        this.state.set("settings", mergedSettings);
        window.dispatchEvent(new CustomEvent("byequiz:settings", { detail: mergedSettings }));
        this.applyAuthoritativeSettings(mergedSettings);
      }
      if (payload.engagement) {
        const eng = { ...this.state.get("engagement"), ...payload.engagement };
        this.state.set("engagement", eng);
      }
      if (payload.game && payload.game.state) {
        if (payload.game.state === "QUESTION") {
          if (payload.game.currentQuestion) {
            this.state.set("currentQuestion", payload.game.currentQuestion);
          }
        }
      }
    } else if (type === "TIKTOK_STATUS" && payload) {
      this.updateLiveIndicator(payload.status);
    } else if (type === "STREAM_START") {
      this.updateLiveIndicator("CONNECTED");
    } else if (type === "STREAM_END" || type === "DISCONNECT") {
      this.updateLiveIndicator("OFFLINE");
    } else if (["CHAT", "GIFT", "LIKE", "SHARE", "FOLLOW", "ROOM_USER"].includes(type)) {
      this.updateLiveIndicator("CONNECTED");
    }

    switch (type) {
      // Automatic participant collection / preparation lifecycle
      case "COLLECTION_STARTED":
      case "COLLECTION_TICK": {
        if (type === "COLLECTION_STARTED" || type === "COLLECTION_TICK") {
          const p = payload || {};
          this.state.set("collection", p);
          this.events.emit("collection:update", p);
          if (this.scenes.currentScene !== "REGISTRATION") this.scenes.transitionTo("REGISTRATION", p);
        }
        break;
      }

      case "COLLECTION_CLOSED": {
        this.state.set("collection", payload || {});
        this.events.emit("collection:closed", payload || {});
        break;
      }

      case "QUESTION_PREPARING":
      case "PREPARATION_TICK": {
        const p = payload || {};
        this.state.set("preparation", p);
        this.events.emit("preparation:update", p);
        if (this.scenes.currentScene !== "PREPARING") this.scenes.transitionTo("PREPARING", p);
        break;
      }

      // 1. Live Chat / Answers
      case "CHAT": {
        const sender = user || payload;
        const commentText = payload?.comment || payload?.text || "";
        const eng = this.state.get("engagement") || {};
        eng.comments = (eng.comments || 0) + 1;
        this.state.set("engagement", eng);

        this.answers.processComment(sender, commentText);
        this.events.emit("reaction:comment", {
          user: sender,
          comment: commentText
        });
        break;
      }

      // 2. Live Gifts
      case "GIFT": {
        const sender = user || payload;
        const giftCount = payload.giftCount || 1;
        const diamondCount = payload.diamondCount || 0;
        const diamonds = payload.diamonds || (diamondCount * giftCount) || 1;

        const eng = this.state.get("engagement") || {};
        eng.diamonds = (eng.diamonds || 0) + diamonds;
        eng.totalGifts = (eng.totalGifts || 0) + giftCount;
        this.state.set("engagement", eng);

        const giftPayload = {
          ...payload,
          user: sender,
          displayName: sender.displayName || sender.nickname,
          avatar: sender.avatar,
          diamonds,
          giftCount
        };

        this.events.emit("gift:received", giftPayload);
        this.events.emit("reaction:gift_event", giftPayload);
        this.events.emit("engagement:gift_update", giftPayload);

        const giftTierType = diamonds >= 1000 ? "CRITICAL_GIFT" : (diamonds >= 100 ? "SPECIAL_GIFT" : "NORMAL_GIFT");

        this.events.emit("reaction:enqueue", {
          type: giftTierType,
          data: giftPayload,
          duration: diamonds >= 1000 ? 4500 : (diamonds >= 100 ? 3500 : 2500)
        });
        break;
      }

      // 3. Live Likes
      case "LIKE": {
        const currentLikes = this.state.get("engagement").likes || 0;
        let newTotal = payload.totalLikeCount;
        if (!newTotal || newTotal < currentLikes) {
          newTotal = currentLikes + (payload.likeCount || 1);
        }

        const eng = this.state.get("engagement");
        eng.likes = newTotal;
        this.state.set("engagement", eng);

        this.events.emit("engagement:like_raw", payload);
        this.events.emit("engagement:like_update", {
          totalLikes: newTotal,
          count: payload.likeCount || 1
        });
        this.events.emit("LIKE_RECEIVED", { totalLikes: newTotal, ...payload });
        break;
      }

      // 4. Live Shares
      case "SHARE": {
        const currentShares = this.state.get("engagement").shares || 0;
        let newTotal = payload.totalShareCount;
        if (!newTotal || newTotal < currentShares) {
          newTotal = currentShares + (payload.shareCount || 1);
        }

        const eng = this.state.get("engagement");
        eng.shares = newTotal;
        this.state.set("engagement", eng);

        this.events.emit("engagement:share_raw", payload);
        this.events.emit("engagement:share_update", {
          totalShares: newTotal,
          count: payload.shareCount || 1
        });
        this.events.emit("SHARE_RECEIVED", { totalShares: newTotal, ...payload });
        break;
      }

      // 5. Live Follow
      case "FOLLOW": {
        const eng = this.state.get("engagement");
        eng.followers = (eng.followers || 0) + 1;
        this.state.set("engagement", eng);

        this.events.emit("engagement:follow_raw", payload);
        this.events.emit("FOLLOW_RECEIVED", payload);
        break;
      }

      // 6. Live Viewer Count & Room User Update
      case "ROOM_USER":
      case "VIEWER_UPDATE": {
        const vCount = payload && (payload.viewerCount !== undefined ? payload.viewerCount : payload.count);
        if (vCount !== undefined) {
          const eng = this.state.get("engagement") || {};
          eng.viewerCount = vCount;
          if (vCount > (eng.peakViewers || 0)) {
            eng.peakViewers = vCount;
          }
          this.state.set("engagement", eng);
          this.events.emit("engagement:viewer_update", payload);
          this.events.emit("ROOM_USER_JOINED", payload);
        }
        break;
      }

      case "PARTICIPANT_JOINED": {
        if (payload && payload.participant) {
          this.participants.add(payload.participant);
          this.events.emit("PARTICIPANT_JOINED", payload.participant);
        }
        break;
      }

      case "SETTINGS_UPDATED": {
        if (payload) {
          const mergedSettings = { ...this.state.get("settings"), ...payload };
          this.state.set("settings", mergedSettings);
          window.dispatchEvent(new CustomEvent("byequiz:settings", { detail: mergedSettings }));
          this.applyAuthoritativeSettings(mergedSettings);
        }
        break;
      }

      case "GAME_STATE_CHANGED": {
        if (payload && payload.state) {
          if (payload.state === "PAUSED") {
            this.round.pauseRound();
          } else if (payload.state === "QUESTION") {
            if (payload.currentQuestion) {
              this.state.set("currentQuestion", payload.currentQuestion);
              this.scenes.render("QUESTION");
            }
          }
        }
        break;
      }

      // Realtime Stage Transitions from Admin
      case "START_GAME":
      case "START_REGISTRATION": {
        this.scenes.transitionTo("REGISTRATION");
        break;
      }

      case "PAUSE_GAME":
      case "PAUSE_ROUND": {
        this.round.pauseRound();
        break;
      }

      case "RESUME_GAME": {
        this.round.resumeRound();
        break;
      }

      case "STOP_GAME": {
        this.scenes.transitionTo("WAITING");
        break;
      }

      case "START_ROUND":
      case "NEXT_ROUND": {
        this.round.startNewRound(payload ? payload.roundNumber : null);
        break;
      }

      case "START_QUESTION":
      case "NEXT_QUESTION": {
        this.startQuestion(payload ? payload.questionId : null, payload ? payload.duration : null);
        break;
      }

      case "END_QUESTION": {
        this.questions.stopTimer();
        this.scenes.transitionTo("ANSWERS");
        break;
      }

      case "START_DRAW": {
        this.scenes.transitionTo("DRAW");
        this.draw.spin(payload ? payload.winnerId : null);
        break;
      }

      case "SHOW_WINNER": {
        this.scenes.transitionTo("WINNER", payload || {});
        break;
      }

      case "SHOW_STATS":
      case "SHOW_PODIUM": {
        this.scenes.transitionTo("PODIUM");
        break;
      }

      case "SET_PARTICIPANT_TARGET": {
        if (payload && payload.target !== undefined) {
          this.state.updateSettings({ targetParticipants: parseInt(payload.target, 10) });
        }
        break;
      }

      case "SET_QUESTION_TIME": {
        if (payload && payload.duration) {
          this.state.updateSettings({ questionDuration: parseInt(payload.duration, 10) });
        }
        break;
      }

      case "SET_SCENE": {
        if (payload && payload.scene) {
          this.scenes.transitionTo(payload.scene, payload);
        }
        break;
      }

      case "RESET_ROUND": {
        this.round.resetRound();
        break;
      }

      case "RESET_ALL": {
        this.participants.clearParticipants();
        this.state.resetAll();
        this.scenes.transitionTo("WAITING");
        break;
      }

      default:
        this.events.emit("network:" + type, payload);
        break;
    }
  }

  startQuestion(questionId = null, duration = null) {
    this.questions.next(questionId, duration);
    this.scenes.transitionTo("QUESTION");
  }
}

if (typeof window !== "undefined") {
  window.GameEngine = GameEngine;
}
if (typeof globalThis !== "undefined") {
  globalThis.GameEngine = GameEngine;
}
