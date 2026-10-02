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

    // Real VIP/special entrance renderer. The server event is authoritative;
    // this client layer only renders the non-blocking overlay.
    if (typeof SpecialEntranceEngine !== 'undefined') {
      try { this.specialEntrance = new SpecialEntranceEngine(this.events); } catch (e) { console.warn('[GameEngine] SpecialEntranceEngine init failed:', e); }
    }
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

    const columns = Math.min(8, Math.max(3, Number(settings.seatColumns) || 5));
    const rows = Math.min(8, Math.max(2, Number(settings.seatRows) || 4));
    const avatarSize = Math.min(64, Math.max(32, Number(settings.seatAvatarSize) || 44));
    document.documentElement.style.setProperty("--bye-seat-columns", String(columns));
    document.documentElement.style.setProperty("--bye-seat-rows", String(rows));
    document.documentElement.style.setProperty("--bye-seat-avatar-size", `${avatarSize}px`);
  }

  applyAuthoritativeGameSnapshot(game = {}) {
    const settings = this.state.get("settings") || {};
    if (game.currentQuestion) this.state.set("currentQuestion", game.currentQuestion);

    if (Number.isFinite(Number(game.roundNumber))) {
      const round = this.state.get("round") || {};
      this.state.set("round", {
        ...round,
        roundNumber: Number(game.roundNumber),
        targetParticipants: Number(game.targetParticipants || settings.targetParticipants || 36),
        currentWinner: game.currentWinner || null
      });
    }

    if (game.engagement) {
      this.state.set("engagement", { ...this.state.get("engagement"), ...game.engagement });
    }

    if (game.participants && Array.isArray(game.participants)) {
      this.participants.clearParticipants();
      for (const participant of game.participants) {
        this.participants.addParticipant({
          ...participant,
          username: participant.uniqueId || participant.username || participant.id,
          displayName: participant.displayName || participant.nickname,
          avatar: participant.avatar
        });
      }
    }

    const remaining = Number(game.remainingSeconds);
    if (Number.isFinite(remaining)) {
      const currentTimer = this.state.get("timer") || {};
      this.state.set("timer", {
        ...currentTimer,
        remaining: Math.max(0, remaining),
        active: remaining > 0
      });
    }

    const phase = game.phase;
    const phaseSceneMap = {
      STUDIO_INTRO: "WAITING",
      REGISTRATION_OPEN: "REGISTRATION",
      REGISTRATION_CLOSED: "REGISTRATION",
      NEXT_ROUND_REGISTRATION: "REGISTRATION",
      SUSPENSE: "PARTICIPANTS",
      PREPARING: "PREPARING",
      QUESTION: "QUESTION",
      ANSWER_LOCK: "LOCK",
      QUESTION_RESULT: "ANSWERS",
      ROUND_RESULTS: "ANSWERS",
      ELIMINATION: "ELIMINATION",
      DRAW: "DRAW",
      FINAL: "FINAL",
      CHAMPION: "WINNER",
      VICTORY: "WINNER"
    };

    const stateSceneMap = {
      LOBBY: "REGISTRATION",
      PLAYER_SELECTION: "REGISTRATION",
      PREPARING: "PREPARING",
      QUESTION: "QUESTION",
      ANSWERING: "QUESTION",
      RESULT: "ANSWERS",
      WINNER: "DRAW",
      NEXT_ROUND: "REGISTRATION",
      ENDED: "WINNER",
      PAUSED: this.scenes.currentScene
    };

    const scene = phaseSceneMap[phase] || stateSceneMap[game.state] || "WAITING";
    this.scenes.transitionTo(scene, game);

    this.events.emit("authoritative:snapshot", game);
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
      if (payload.game) {
        this.applyAuthoritativeGameSnapshot(payload.game);
      }
    } else if (type === "TIKTOK_STATUS" && payload) {
      this.updateLiveIndicator(payload.status);
    } else if (type === "STREAM_START") {
      this.updateLiveIndicator("CONNECTED");
    } else if (type === "STREAM_END" || type === "DISCONNECT") {
      this.updateLiveIndicator("OFFLINE");
    } else if (["CHAT", "GIFT", "LIKE", "SHARE", "FOLLOW", "MEMBER", "ROOM_USER"].includes(type)) {
      this.updateLiveIndicator("CONNECTED");
    }

    switch (type) {
      case "SPECIAL_ENTRANCE": {
        // Presentation only: never changes the authoritative game scene.
        this.events.emit("SPECIAL_ENTRANCE", payload || {});
        break;
      }

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

      case "TARGET_REACHED": {
        const targetPayload = payload || {};
        this.scenes.transitionTo("PARTICIPANTS", targetPayload);
        this.scenes.renderParticipantsCompleteCelebration(() => {
          let count = 3;
          this.scenes.renderCountdownOverlay(count);
          const interval = setInterval(() => {
            count -= 1;
            if (count > 0) {
              this.scenes.renderCountdownOverlay(count);
            } else {
              clearInterval(interval);
            }
          }, 1000);
          if (interval.unref) interval.unref();
        });
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

      case "QUESTION_STARTED": {
        if (payload?.question) {
          this.state.set("currentQuestion", payload.question);
        }
        const duration = Number(payload?.duration || payload?.question?.timeLimit || this.state.get("settings").questionDuration || 15);
        this.state.set("timer", {
          duration,
          remaining: duration,
          active: true,
          startTime: Date.now()
        });
        this.scenes.transitionTo("QUESTION", payload || {});
        break;
      }

      case "TIMER_TICK": {
        const remaining = Math.max(0, Number(payload?.remaining ?? 0));
        const current = this.state.get("timer") || {};
        this.state.set("timer", {
          ...current,
          remaining,
          active: remaining > 0
        });
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
          // Seat/layout settings are live: rebuild the visible TikTok-style guest grid immediately.
          if (this.scenes && (this.scenes.currentScene === "REGISTRATION" || this.scenes.currentScene === "JOIN" || this.scenes.currentScene === "SEATS")) {
            this.scenes.renderRegistrationScene();
          }
        }
        break;
      }

      case "GAME_PHASE_CHANGED": {
        const p = payload || {};
        this.state.set("blueprintPhase", p.phase || null);
        this.state.set("phaseClock", {
          startedAt: p.startedAt || Date.now(),
          endsAt: p.endsAt || null,
          durationMs: Number(p.durationMs || 0)
        });
        this.events.emit("GAME_PHASE_CHANGED", p);
        break;
      }

      case "ANSWER_LOCK": {
        this.state.set("answerLocked", true);
        this.scenes.transitionTo("LOCK", payload || {});
        this.questions.stopTimer();
        break;
      }

      case "GAME_STATE_CHANGED": {
        if (payload && payload.state) {
          const serverState = payload.state;
          if (payload.currentQuestion) {
            this.state.set("currentQuestion", payload.currentQuestion);
          }

          switch (serverState) {
            case "LOBBY":
            case "PLAYER_SELECTION":
              this.state.set("scene", "REGISTRATION");
              break;
            case "PREPARING":
              this.scenes.transitionTo("PREPARING", payload);
              break;
            case "QUESTION":
            case "ANSWERING":
              this.scenes.transitionTo("QUESTION", payload);
              break;
            case "RESULT":
              this.scenes.transitionTo("ANSWERS", payload);
              break;
            case "WINNER":
              // The authoritative WINNER event below starts the cinematic draw.
              break;
            case "PAUSED":
              this.round.pauseRound();
              break;
            case "ENDED":
              this.scenes.transitionTo("WAITING", payload);
              break;
            default:
              break;
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

      case "QUESTION_ENDED":
      case "END_QUESTION": {
        this.state.set("answerLocked", false);
        this.questions.stopTimer();
        this.scenes.transitionTo("ANSWERS", payload || {});
        break;
      }

      case "ELIMINATION_STARTED": {
        const p = payload || {};
        this.state.set("elimination", p);
        this.events.emit("elimination:started", p);
        this.scenes.transitionTo("ELIMINATION", p);
        break;
      }

      case "ELIMINATION_COMPLETED": {
        const p = payload || {};
        this.state.set("elimination", p);
        this.events.emit("elimination:completed", p);
        break;
      }

      case "FINAL_STARTED": {
        const p = payload || {};
        this.state.set("final", p);
        this.scenes.transitionTo("FINAL", p);
        break;
      }

      case "DRAW_STARTED":
      case "START_DRAW": {
        this.scenes.transitionTo("DRAW", payload || {});
        if (type === "START_DRAW") {
          this.draw.spin(payload ? payload.winnerId : null);
        }
        break;
      }

      case "WINNER": {
        const winnerId = payload?.winner?.id || payload?.participant?.id || payload?.winnerId || null;
        this.scenes.transitionTo("DRAW", payload || {});
        this.draw.spin(winnerId);
        break;
      }

      case "CHAMPION": {
        const p = payload || {};
        this.state.set("currentWinner", p.winner || p.participant || null);
        this.scenes.transitionTo("WINNER", p);
        break;
      }

      case "VICTORY": {
        const p = payload || {};
        this.state.set("currentWinner", p.winner || p.participant || null);
        this.scenes.transitionTo("WINNER", p);
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

      case "ROUND_STARTED": {
        const p = payload || {};
        this.state.resetRound();

        // Server sends the qualified players that carry into the next round.
        // Keep those seats and open only the remaining capacity for new joins.
        if (Array.isArray(p.qualified)) {
          this.participants.clearParticipants();
          for (const participant of p.qualified) {
            this.participants.addParticipant({
              ...participant,
              username: participant.uniqueId || participant.username || participant.id,
              displayName: participant.displayName || participant.nickname,
              avatar: participant.avatar
            });
          }
        }

        this.state.set("elimination", null);
        this.scenes.transitionTo("REGISTRATION", p);
        break;
      }

      case "GAME_RESET":
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
  window.gameInstance = window.gameEngine || null;
}
if (typeof globalThis !== "undefined") {
  globalThis.GameEngine = GameEngine;
}
