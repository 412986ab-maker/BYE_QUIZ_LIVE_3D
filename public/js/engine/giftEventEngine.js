/**
 * BYE QUIZ LIVE - Multi-Tier Cinematic Gift Engine
 * 9-Stage Event Flow with dynamic SVG vector artifacts.
 * Prioritizes Display Names & Real Avatars.
 */
class GiftEventEngine {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.queue = [];
    this.isProcessing = false;
    this.rootContainer = typeof document !== 'undefined' ? document.getElementById('main-stream-container') || document.body : null;

    this.setupListeners();
  }

  setupListeners() {
    this.events.on('gift:received', (giftData) => {
      this.enqueueGift(giftData);
    });

    this.events.on('reaction:gift_event', (giftData) => {
      this.enqueueGift(giftData);
    });

    this.events.on('GIFT_RECEIVED', (giftData) => {
      this.enqueueGift(giftData);
    });
  }

  getGiftTier(diamonds) {
    if (diamonds >= 2000) return 'LEGENDARY';
    if (diamonds >= 500) return 'EPIC';
    if (diamonds >= 50) return 'PREMIUM';
    return 'COMMON';
  }

  enqueueGift(giftData) {
    const diamonds = giftData.diamonds || ((giftData.diamondCount || 1) * (giftData.giftCount || 1)) || 1;
    const tier = this.getGiftTier(diamonds);

    const item = {
      id: `gift_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      data: giftData,
      diamonds,
      tier,
      timestamp: Date.now()
    };

    if (tier === 'LEGENDARY') {
      this.queue.unshift(item); // Prioritize legendary gifts
    } else {
      this.queue.push(item);
    }

    if (!this.isProcessing) {
      this.processNextGift();
    }
  }

  async processNextGift() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const currentItem = this.queue.shift();

    try {
      await this.executeCinematicSequence(currentItem);
    } catch (err) {
      console.error('Gift cinematic sequence error:', err);
    }

    this.processNextGift();
  }

  getGiftArtifactSVG(tier, size = 100) {
    switch (tier) {
      case 'LEGENDARY':
        return `
          <div class="gift-artifact-wrapper artifact-legendary">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="goldAura" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ffd700" />
                  <stop offset="50%" stop-color="#ff9900" />
                  <stop offset="100%" stop-color="#ff007f" />
                </linearGradient>
                <filter id="goldGlow">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#goldAura)" stroke-width="2" stroke-dasharray="8 4" class="spin-ring" />
              <circle cx="50" cy="50" r="34" fill="rgba(255,215,0,0.15)" stroke="#ffd700" stroke-width="1.5" />
              <path d="M26 65 L32 38 L42 50 L50 30 L58 50 L68 38 L74 65 Z" fill="url(#goldAura)" filter="url(#goldGlow)" />
              <polygon points="50,18 54,26 46,26" fill="#ffffff" />
              <circle cx="50" cy="54" r="6" fill="#ffffff" />
              <rect x="28" y="67" width="44" height="6" rx="2" fill="#ffd700" />
            </svg>
          </div>
        `;

      case 'EPIC':
        return `
          <div class="gift-artifact-wrapper artifact-epic">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="epicAura" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00f2fe" />
                  <stop offset="50%" stop-color="#a855f7" />
                  <stop offset="100%" stop-color="#ec4899" />
                </linearGradient>
              </defs>
              <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#epicAura)" stroke-width="2" transform="rotate(30 50 50)" class="spin-ring" />
              <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#epicAura)" stroke-width="2" transform="rotate(-30 50 50)" class="spin-ring-rev" />
              <polygon points="50,15 62,38 85,50 62,62 50,85 38,62 15,50 38,38" fill="url(#epicAura)" opacity="0.85" />
              <circle cx="50" cy="50" r="10" fill="#ffffff" />
            </svg>
          </div>
        `;

      case 'PREMIUM':
        return `
          <div class="gift-artifact-wrapper artifact-premium">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="premGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00f2fe" />
                  <stop offset="100%" stop-color="#4facfe" />
                </linearGradient>
              </defs>
              <polygon points="50,12 80,32 80,68 50,88 20,68 20,32" fill="rgba(0,242,254,0.15)" stroke="url(#premGrad)" stroke-width="2.5" />
              <polygon points="50,22 70,36 70,64 50,78 30,64 30,36" fill="url(#premGrad)" opacity="0.75" />
              <line x1="50" y1="22" x2="50" y2="78" stroke="#ffffff" stroke-width="1.5" />
            </svg>
          </div>
        `;

      default:
        return `
          <div class="gift-artifact-wrapper artifact-common">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="28" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="2" />
              <polygon points="50,26 56,44 74,50 56,56 50,74 44,56 26,50 44,44" fill="#10b981" />
              <circle cx="50" cy="50" r="5" fill="#ffffff" />
            </svg>
          </div>
        `;
    }
  }

  async executeCinematicSequence(item) {
    const { data, diamonds, tier } = item;
    const scene = this.state.get('scene');
    const isQuestionScene = scene === 'QUESTION' || scene === 'ANSWERING';

    const rawSenderName = data.displayName || data.nickname || data.user?.displayName || data.user?.nickname || data.sender || 'داعم مجهول';
    const senderName = rawSenderName;
    const realAvatarUrl = data.avatar || data.profilePictureUrl || data.user?.avatar || data.user?.profilePictureUrl || data.senderAvatar;
    const avatar = realAvatarUrl || (`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}`);
    const giftName = data.giftName || 'هدية';
    const count = data.giftCount || data.repeatCount || 1;

    // Audio & Frame Pulse
    if (typeof window !== 'undefined' && window.soundFX) {
      if (tier === 'LEGENDARY') window.soundFX.playWinner();
      else if (tier === 'EPIC') window.soundFX.playMajorMilestone();
      else if (tier === 'PREMIUM') window.soundFX.playGiftBig();
      else window.soundFX.playGiftSmall();
    }

    // Canvas Particles
    if (typeof window !== 'undefined' && window.confettiEngine) {
      const pCount = (tier === 'LEGENDARY') ? 120 : (tier === 'EPIC') ? 70 : (tier === 'PREMIUM') ? 35 : 15;
      window.confettiEngine.launch(pCount, tier === 'LEGENDARY' ? 'DIAMOND' : 'SHARD');
      if (tier === 'LEGENDARY' || tier === 'EPIC') {
        window.confettiEngine.spawnShockwave(window.innerWidth / 2, window.innerHeight / 2, tier === 'LEGENDARY' ? '#ffd700' : '#00f2fe', 220);
      }
    }

    // Gift Card
    const eventCard = document.createElement('div');
    eventCard.className = `cinematic-gift-card tier-${tier.toLowerCase()} anim-gift-burst`;

    const diamondIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('diamond', { size: 14, color: '#00f2fe' }) : '';

    eventCard.innerHTML = `
      <div class="gift-card-ambient-aura"></div>
      <div class="gift-card-body">
        <div class="gift-visual-core">
          ${this.getGiftArtifactSVG(tier, 44)}
        </div>
        <div class="gift-details-core">
          <div class="gift-sender-row">
            <img src="${avatar}" class="gift-avatar-img" alt="${senderName}" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}';" />
            <div class="gift-user-meta">
              <div class="gift-sender-title">${senderName}</div>
              <div class="gift-rank-pill">${tier} SUPPORTER</div>
            </div>
          </div>
          <div class="gift-name-row">
            <span class="gift-action-verb">أرسل</span>
            <span class="gift-item-title">${giftName}</span>
            ${count > 1 ? `<span class="gift-repeat-pill">×${count}</span>` : ''}
            <span class="gift-diamonds-pill">${diamondIcon} <b>${diamonds}</b></span>
          </div>
        </div>
      </div>
    `;

    if (this.rootContainer) {
      this.rootContainer.appendChild(eventCard);
    }

    if (tier === 'LEGENDARY' && !isQuestionScene) {
      const container = document.querySelector('.stream-container');
      if (container) {
        container.classList.add('screen-pulse-shake');
        setTimeout(() => container.classList.remove('screen-pulse-shake'), 600);
      }
    }

    const displayDuration = (tier === 'LEGENDARY') ? 3200 : (tier === 'EPIC') ? 2600 : 2000;
    await new Promise((resolve) => setTimeout(resolve, displayDuration));

    eventCard.classList.add('animate-gift-exit');
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (eventCard.parentNode) {
      eventCard.parentNode.removeChild(eventCard);
    }
  }
}

if (typeof window !== 'undefined') {
  window.GiftEventEngine = GiftEventEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GiftEventEngine = GiftEventEngine;
}
