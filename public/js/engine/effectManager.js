function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * BYE QUIZ LIVE - Effect & Visual Feedback Engine
 * Handles floating chat bubbles, like bursts, share pulses, gifts, and milestones.
 * Prioritizes Display Names & Real Avatars.
 */
class EffectManager {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;

    this.container = typeof document !== "undefined" ? document.getElementById("main-stream-container") || document.body : null;
    this.toastContainer = null;
    this.bannerContainer = null;
    this.achievementContainer = null;
    this.chatContainer = null;
    this.giftEngine = null;

    if (this.container) {
      this.initDomLayers();
      this.setupListeners();
    }
  }

  initDomLayers() {
    if (typeof document === "undefined" || !this.container) return;

    this.toastContainer = document.createElement("div");
    this.toastContainer.className = "effect-toast-slot";
    this.container.appendChild(this.toastContainer);

    this.bannerContainer = document.createElement("div");
    this.bannerContainer.className = "effect-banner-slot";
    this.container.appendChild(this.bannerContainer);

    this.achievementContainer = document.createElement("div");
    this.achievementContainer.className = "effect-achievement-slot";
    this.container.appendChild(this.achievementContainer);

    this.chatContainer = document.createElement("div");
    this.chatContainer.className = "effect-chat-slot";
    this.container.appendChild(this.chatContainer);

    // Initialize Gift Event Engine
    if (typeof GiftEventEngine !== "undefined") {
      this.giftEngine = new GiftEventEngine(this.events, this.state);
    }
  }

  setupListeners() {
    // 1. Reaction Queue Execution
    this.events.on("reaction:execute", (item) => {
      this.renderQueuedReaction(item);
    });

    // Live Floating Comments
    this.events.on("reaction:comment", (data) => {
      this.renderCommentToast(data.user || data, data.comment || data.message || "");
    });

    // 2. Immediate Lightweight Bursts (Likes / Shares / Follows)
    this.events.on("reaction:like_burst", (data) => {
      this.renderLikeBurst(data.count, data.total);
    });

    this.events.on("reaction:share_burst", (data) => {
      this.renderShareBurst(data.count);
    });

    this.events.on("reaction:follow_burst", (data) => {
      this.renderFollowToast(data.user);
    });

    this.events.on("reaction:follow_batch", (data) => {
      if (data.count === 1) {
        this.renderFollowToast(data.latestUser);
      } else {
        this.renderFollowBatchToast(data.count, data.latestUser);
      }
    });

    // 3. Achievements & Combos
    this.events.on("achievement:unlocked", (ach) => {
      this.renderAchievement(ach);
    });

    this.events.on("combo:triggered", (combo) => {
      this.renderCombo(combo);
    });
  }

  renderCommentToast(user, commentText) {
    if (typeof document === "undefined" || !this.chatContainer || !commentText) return;

    const rawName = user ? (user.displayName || user.nickname || user.username || user.uniqueId || 'مشاهد') : 'مشاهد';
    const name = escapeHtml(rawName);
    const realAvatarUrl = user ? (user.avatar || user.profilePictureUrl || user.profilePicture || user.avatarUrl) : null;
    const avatar = realAvatarUrl ? escapeHtml(realAvatarUrl) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawName)}`;
    const cleanComment = escapeHtml(commentText);

    // Answer tag check
    const isAnswer = ['A', 'B', 'C', 'D', 'أ', 'ب', 'ج', 'د', '!ANSWER', '!JOIN', 'تم'].some(prefix => 
      commentText.trim().toUpperCase().startsWith(prefix)
    );

    const bubble = document.createElement("div");
    bubble.className = "live-chat-bubble anim-comment-enter";
    bubble.innerHTML = `
      <img src="${avatar}" class="chat-bubble-avatar" alt="${name}" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawName)}';" />
      <div class="chat-bubble-content">
        <div class="chat-bubble-header">
          <span class="chat-bubble-author">${name}</span>
          ${isAnswer ? '<span class="chat-tag-pill answer-tag">إجابة</span>' : ''}
        </div>
        <div class="chat-bubble-text">${cleanComment}</div>
      </div>
    `;

    // Limit active chat bubbles to max 3
    while (this.chatContainer.children.length >= 3) {
      this.chatContainer.removeChild(this.chatContainer.firstChild);
    }

    this.chatContainer.appendChild(bubble);

    // Auto remove after 4.5 seconds
    setTimeout(() => {
      bubble.classList.add("animate-fade-up");
      setTimeout(() => {
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
      }, 350);
    }, 4500);
  }

  renderQueuedReaction(item) {
    const { type, data } = item;
    const settings = this.state.get("settings") || {};
    const isSound = settings.engagementSound !== false;

    switch (type) {
      case "CRITICAL_GIFT":
      case "SPECIAL_GIFT":
      case "NORMAL_GIFT":
        if (this.giftEngine) {
          this.giftEngine.enqueueGift(data);
        } else {
          this.renderGiftBanner(data);
        }
        break;

      case "LIKE_MILESTONE":
        this.renderMilestoneBanner({
          title: "إنجاز تفاعل اللايكات المباشر",
          subtitle: "تجاوز البث " + Number(data.threshold).toLocaleString() + " تفاعل حي!",
          iconName: "flame",
          tier: data.tier || 1
        });
        if (isSound && typeof window !== "undefined" && window.soundFX) {
          window.soundFX.playLikeMilestone(data.tier);
        }
        break;

      case "SHARE_MILESTONE":
        this.renderMilestoneBanner({
          title: "إنجاز مشاركات البث الفضائي",
          subtitle: "وصلت المشاركات إلى " + Number(data.threshold).toLocaleString() + " مشاركة!",
          iconName: "rocket",
          tier: 2
        });
        if (isSound && typeof window !== "undefined" && window.soundFX) {
          window.soundFX.playShareMilestone();
        }
        break;

      case "MAJOR_MILESTONE":
        this.renderMilestoneBanner({
          title: data.title || "إنجاز استثنائي في البث!",
          subtitle: data.message || "شكراً لدعمكم الأسطوري!",
          iconName: "crown",
          tier: 5
        });
        if (isSound && typeof window !== "undefined" && window.soundFX) {
          window.soundFX.playMajorMilestone();
        }
        if (typeof window !== "undefined" && window.confettiEngine) {
          window.confettiEngine.launch(100, "DIAMOND");
        }
        break;

      case "WINNER":
        if (isSound && typeof window !== "undefined" && window.soundFX) {
          window.soundFX.playWinner();
        }
        if (typeof window !== "undefined" && window.confettiEngine) {
          window.confettiEngine.launch(150, "DIAMOND");
        }
        break;

      case "FOLLOW":
        this.renderFollowToast(data.user || data);
        break;
    }
  }

  renderLikeBurst(count, total) {
    if (typeof document === "undefined" || !this.toastContainer) return;

    if (typeof window !== "undefined" && window.confettiEngine && window.confettiEngine.spawnFloatingReaction) {
      const spawnCount = Math.min(count, 5);
      for (let i = 0; i < spawnCount; i++) {
        window.confettiEngine.spawnFloatingReaction(null, null, 'NEON_HEART', '#ec4899');
      }
    }

    const heartIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("heart", { size: 14, color: "#ec4899" }) : "";
    const chip = document.createElement("div");
    chip.className = "live-burst-chip like-chip anim-gift-burst";
    chip.innerHTML = "<span class=\"burst-icon-wrap\">" + heartIcon + "</span> <span class=\"burst-count\">+" + count + "</span>";

    this.toastContainer.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.parentNode.removeChild(chip);
    }, 1800);
  }

  renderShareBurst(count) {
    if (typeof document === "undefined" || !this.toastContainer) return;

    if (typeof window !== "undefined" && window.confettiEngine && window.confettiEngine.spawnFloatingReaction) {
      window.confettiEngine.spawnFloatingReaction(null, null, 'DIAMOND', '#00f2fe');
    }

    const shareIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("share", { size: 14, color: "#00f2fe" }) : "";
    const chip = document.createElement("div");
    chip.className = "live-burst-chip share-chip anim-share-burst";
    chip.innerHTML = "<span class=\"burst-icon-wrap\">" + shareIcon + "</span> <span class=\"burst-count\">+" + count + " مشاركة</span>";

    this.toastContainer.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.parentNode.removeChild(chip);
    }, 2200);
  }

  renderFollowToast(user) {
    if (typeof document === "undefined" || !this.toastContainer || !user) return;

    const rawName = user.displayName || user.nickname || user.username || user.uniqueId || "متابع جديد";
    const name = escapeHtml(rawName);
    const realAvatarUrl = user.avatar || user.profilePictureUrl || user.profilePicture || user.avatarUrl;
    const avatar = realAvatarUrl ? escapeHtml(realAvatarUrl) : ("https://api.dicebear.com/7.x/avataaars/svg?seed=" + encodeURIComponent(rawName));
    const liveIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("live", { size: 12, color: "#10b981" }) : "";

    const toast = document.createElement("div");
    toast.className = "live-follow-toast anim-player-enter";
    toast.innerHTML = `<img src="${avatar}" class="follow-avatar" alt="${name}" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawName)}';" /><div class="follow-text"><span class="follow-name">${name}</span><span class="follow-action">${liveIcon} انضم للبث</span></div>`;

    this.toastContainer.appendChild(toast);

    if (this.state.get("settings").engagementSound && typeof window !== "undefined" && window.soundFX) {
      window.soundFX.playFollow();
    }

    setTimeout(() => {
      toast.classList.add("animate-slide-out");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 2500);
  }

  renderFollowBatchToast(count, latestUser) {
    if (typeof document === "undefined" || !this.toastContainer) return;

    const userIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("participants", { size: 16, color: "#00f2fe" }) : "";
    const toast = document.createElement("div");
    toast.className = "live-follow-toast batch anim-player-enter";
    toast.innerHTML = "<span class=\"follow-icon-box\">" + userIcon + "</span><div class=\"follow-text\"><span class=\"follow-name\">+" + count + " متابعين جدد!</span><span class=\"follow-action\">أهلاً بكم في BYE QUIZ LIVE</span></div>";

    this.toastContainer.appendChild(toast);

    if (this.state.get("settings").engagementSound && typeof window !== "undefined" && window.soundFX) {
      window.soundFX.playFollow();
    }

    setTimeout(() => {
      toast.classList.add("animate-slide-out");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 2500);
  }

  renderGiftBanner(data) {
    if (this.giftEngine) {
      this.giftEngine.enqueueGift(data);
    }
  }

  renderMilestoneBanner(data) {
    if (typeof document === "undefined" || !this.bannerContainer) return;

    const iconSvg = (typeof IconSystem !== "undefined") ? IconSystem.get(data.iconName || "trophy", { size: 24, color: "#ffd700" }) : "";
    const banner = document.createElement("div");
    banner.className = "milestone-banner tier-" + (data.tier || 1) + " anim-results-enter";
    banner.innerHTML = "<div class=\"milestone-icon-wrap\">" + iconSvg + "</div><div class=\"milestone-content\"><div class=\"milestone-title\">" + escapeHtml(data.title) + "</div><div class=\"milestone-sub\">" + escapeHtml(data.subtitle) + "</div></div>";

    this.bannerContainer.appendChild(banner);

    if (typeof window !== "undefined" && window.confettiEngine) {
      window.confettiEngine.launch((data.tier || 1) * 20, "SHARD");
    }

    setTimeout(() => {
      banner.classList.add("animate-fade-up");
      setTimeout(() => {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }, 3000);
  }

  renderAchievement(ach) {
    if (typeof document === "undefined" || !this.achievementContainer || !ach) return;

    const starIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("star", { size: 22, color: "#ffd700" }) : "";
    const popup = document.createElement("div");
    popup.className = "achievement-popup anim-results-enter";
    popup.innerHTML = "<div class=\"ach-icon-box\">" + starIcon + "</div><div class=\"ach-info\"><div class=\"ach-tag\">إنجاز جديد مُكتمل</div><div class=\"ach-title\">" + escapeHtml(ach.title) + "</div><div class=\"ach-desc\">" + escapeHtml(ach.description) + "</div></div>";

    this.achievementContainer.appendChild(popup);

    if (this.state.get("settings").engagementSound && typeof window !== "undefined" && window.soundFX) {
      window.soundFX.playAchievement();
    }
    if (typeof window !== "undefined" && window.confettiEngine) {
      window.confettiEngine.launch(60, "DIAMOND");
    }

    setTimeout(() => {
      popup.classList.add("animate-bounce-out");
      setTimeout(() => {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
      }, 500);
    }, 3500);
  }

  renderCombo(combo) {
    if (typeof document === "undefined" || !this.toastContainer) return;

    const flameIcon = (typeof IconSystem !== "undefined") ? IconSystem.get("flame", { size: 16, color: "#f59e0b" }) : "";
    const badge = document.createElement("div");
    badge.className = "combo-badge anim-gift-burst";
    badge.innerHTML = flameIcon + " <span>COMBO ×" + combo.multiplier + "</span>";

    this.toastContainer.appendChild(badge);

    if (this.state.get("settings").engagementSound && typeof window !== "undefined" && window.soundFX) {
      window.soundFX.playCombo(combo.multiplier);
    }

    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 1600);
  }
}

if (typeof window !== "undefined") {
  window.EffectManager = EffectManager;
}
if (typeof globalThis !== "undefined") {
  globalThis.EffectManager = EffectManager;
}
