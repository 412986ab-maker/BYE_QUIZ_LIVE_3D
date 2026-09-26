/**
 * BYE QUIZ LIVE - 3D Studio & Cinematic Camera Scene Manager
 * Controls 3D Scene Viewport, Dynamic Cinematic Camera Transitions,
 * Holographic 3D Stages, and Synchronized Sound & Visual Realism.
 */
class SceneManager {
  constructor(eventManager, gameState, participantManager, questionEngine, statisticsEngine) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;
    this.questions = questionEngine;
    this.stats = statisticsEngine;

    this.currentScene = 'WAITING';
    this.rouletteInterval = null;
    this.dom = {
      viewport: typeof document !== 'undefined' ? document.getElementById('studio-viewport') : null,
      stage: typeof document !== 'undefined' ? document.getElementById('stage-area') : null,
      headerCategory: typeof document !== 'undefined' ? document.getElementById('header-category') : null,
      timerContainer: typeof document !== 'undefined' ? document.getElementById('timer-container') : null,
      timerBar: typeof document !== 'undefined' ? document.getElementById('timer-bar') : null,
      timerText: typeof document !== 'undefined' ? document.getElementById('timer-text') : null,
      statParticipants: typeof document !== 'undefined' ? document.getElementById('stat-participants') : null,
      valViewers: typeof document !== 'undefined' ? document.getElementById('val-viewers') : null,
      valLikes: typeof document !== 'undefined' ? document.getElementById('val-likes') : null,
      valShares: typeof document !== 'undefined' ? document.getElementById('val-shares') : null,
      valGifts: typeof document !== 'undefined' ? document.getElementById('val-gifts') : null,
      valDiamonds: typeof document !== 'undefined' ? document.getElementById('val-diamonds') : null,
      valComments: typeof document !== 'undefined' ? document.getElementById('val-comments') : null,
      valRound: typeof document !== 'undefined' ? document.getElementById('val-round') : null,
      leaderboardList: typeof document !== 'undefined' ? document.getElementById('footer-leaderboard-items') : null
    };

    this.setupListeners();
    this.initAudioUnlock();
  }

  setupListeners() {
    this.state.subscribe('scene', (scene) => this.render(scene));
    this.state.subscribe('engagement', () => this.updateHeaderStats());
    this.state.subscribe('timer', (timer) => this.updateTimerDisplay(timer));

    this.events.on('PARTICIPANT_JOINED', (participant) => {
      this.updateHeaderStats();
      if (this.currentScene === 'WAITING' || this.currentScene === 'REGISTRATION' || this.currentScene === 'JOIN') {
        const pool = this.participants.getDrawPoolUsers();
        if (pool.length === 1) {
          this.triggerFirstParticipantCinematic(participant);
        } else {
          this.renderRegistrationGrid();
        }
      }
    });

    this.events.on('PARTICIPANTS_UPDATED', () => {
      this.updateHeaderStats();
      if (this.currentScene === 'JOIN' || this.currentScene === 'REGISTRATION') {
        this.renderRegistrationGrid();
      }
    });

    this.events.on('score:updated', () => this.updateLeaderboard());
  }

  initAudioUnlock() {
    if (typeof document === 'undefined') return;

    const isUnlocked = localStorage.getItem('byequiz_audio_unlocked');
    if (!isUnlocked) {
      const banner = document.createElement('div');
      banner.className = 'audio-unlock-banner';
      banner.innerHTML = `${IconSystem.get('sound', { size: 16 })} <span>اضغط لتفعيل الصوت والأجواء السينمائية</span>`;
      banner.onclick = () => {
        if (window.soundFX) {
          window.soundFX.init();
          window.soundFX.startAmbientDrone();
        }
        localStorage.setItem('byequiz_audio_unlocked', 'true');
        banner.remove();
      };
      document.body.appendChild(banner);
    } else {
      document.addEventListener('click', () => {
        if (window.soundFX && !window.soundFX.ambientActive) {
          window.soundFX.startAmbientDrone();
        }
      }, { once: true });
    }
  }

  setCameraMode(mode, targetSeat = null) {
    const container = document.getElementById('main-stream-container') || document.body;
    if (!container) return;

    container.classList.remove(
      'cam-wide', 'cam-seats', 'cam-hero-first', 'cam-question',
      'cam-lock', 'cam-answers', 'cam-draw', 'cam-winner', 'cam-podium'
    );

    switch (mode) {
      case 'WIDE':
      case 'WELCOME':
      case 'LOBBY':
        container.classList.add('cam-wide');
        break;
      case 'SEATS':
      case 'REGISTRATION':
        container.classList.add('cam-seats');
        break;
      case 'FIRST_JOIN':
        container.classList.add('cam-hero-first');
        break;
      case 'QUESTION':
      case 'ANSWERING':
        container.classList.add('cam-question');
        break;
      case 'LOCK':
        container.classList.add('cam-lock');
        break;
      case 'ANSWERS':
      case 'RESULTS':
      case 'RESULT':
        container.classList.add('cam-answers');
        break;
      case 'DRAW':
        container.classList.add('cam-draw');
        break;
      case 'WINNER':
        container.classList.add('cam-winner');
        break;
      case 'PODIUM':
      case 'STATS':
        container.classList.add('cam-podium');
        break;
      default:
        container.classList.add('cam-wide');
        break;
    }

    // Direct WebGL 3D Studio Camera Synchronization
    if (window.scene3dEngine && window.scene3dEngine.isSupported) {
      window.scene3dEngine.setCameraMode(mode, targetSeat);
    }
  }

  transitionTo(sceneName, payload = {}) {
    this.currentScene = sceneName;
    this.state.set('scene', sceneName);
    if (window.soundFX && window.soundFX.playTransition) {
      window.soundFX.playTransition();
    }
    this.events.emit(`scene:${sceneName.toLowerCase()}`, payload);
    this.events.emit('SCENE_CHANGED', { scene: sceneName, payload });
  }

  render(sceneName) {
    if (!this.dom.stage) return;
    this.currentScene = sceneName;

    if (this.rouletteInterval) {
      clearInterval(this.rouletteInterval);
      this.rouletteInterval = null;
    }

    // Camera perspective adjustment
    this.setCameraMode(sceneName);

    // Timer visibility: Active during QUESTION, ANSWERING, LOCK
    if (this.dom.timerContainer) {
      const showTimer = ['QUESTION', 'ANSWERING', 'LOCK'].includes(sceneName);
      this.dom.timerContainer.style.visibility = showTimer ? 'visible' : 'hidden';
    }

    switch (sceneName) {
      case 'WAITING':
      case 'WELCOME':
        this.renderWaitingScene();
        break;
      case 'JOIN':
      case 'REGISTRATION':
      case 'SEATS':
        this.renderRegistrationScene();
        break;
      case 'PREPARING':
        this.renderPreparationScene();
        break;
      case 'COUNTDOWN':
      case 'PARTICIPANTS':
        this.renderParticipantsScene();
        break;
      case 'QUESTION':
      case 'ANSWERING':
        this.renderQuestionScene();
        break;
      case 'LOCK':
        this.renderLockScene();
        break;
      case 'REVEAL':
      case 'RESULTS':
      case 'ANSWERS':
        this.renderAnswersScene();
        break;
      case 'DRAW':
        this.renderDrawScene();
        break;
      case 'WINNER':
        this.renderWinnerScene();
        break;
      case 'LEADERBOARD':
      case 'PODIUM':
      case 'STATS':
        this.renderPodiumScene();
        break;
      default:
        this.renderRegistrationScene();
        break;
    }
  }

  // 1. WELCOME / WAITING SCENE (3D Interactive Studio Stage)
  renderWaitingScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('live', { size: 16 })} <span>ساحة المسابقات التفاعلية المباشرة</span>`;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-welcome-enter 3d-stage-hologram" id="welcome-scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('timer', { size: 14 })} <span>الاستعداد المباشر • البث الحي</span>
        </div>
        <div class="waiting-hero-box 3d-glass-panel">
          <div class="radar-spinner-box 3d-floating-element">
            <div class="radar-ring"></div>
            <div class="radar-ring-inner"></div>
            <div class="radar-center-icon">
              ${IconSystem.get('live', { size: 38, color: 'var(--cyber-cyan)' })}
            </div>
          </div>
          <h2 class="waiting-title 3d-title-glow">BYE QUIZ LIVE</h2>
          <p class="waiting-subtitle">المسابقة التفاعلية الكبرى للبث المباشر. استعد للتحدي والجوائز الفورية!</p>

          <div class="waiting-features-grid">
            <div class="waiting-feature-card 3d-feature-box">
              ${IconSystem.get('star', { size: 22 })}
              <span class="waiting-feature-title">تحديات وأسئلة</span>
            </div>
            <div class="waiting-feature-card 3d-feature-box">
              ${IconSystem.get('draw', { size: 22 })}
              <span class="waiting-feature-title">سحب الحظ</span>
            </div>
            <div class="waiting-feature-card 3d-feature-box">
              ${IconSystem.get('trophy', { size: 22 })}
              <span class="waiting-feature-title">جوائز المتصدرين</span>
            </div>
          </div>

          <!-- Interactive "تم" Start Action Button -->
          <div style="margin-top: 20px; display: flex; justify-content: center; width: 100%;">
            <button class="btn-welcome-done 3d-btn-tactile" id="btn-welcome-done" onclick="window.gameInstance ? window.gameInstance.scenes.handleWelcomeDone() : null">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>تم (بدء الفعالية)</span>
            </button>
          </div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">اكتب في التعليقات لفتح مقاعد الجولة:</span>
          <span class="join-keyword-pill">!join أو "تم"</span>
        </div>
      </div>
    `;
  }

  handleWelcomeDone() {
    const frame = document.getElementById('welcome-scene-frame');
    if (frame) {
      frame.classList.add('anim-welcome-exit');
    }

    if (window.soundFX && window.soundFX.playTransition) {
      window.soundFX.playTransition();
    }

    setTimeout(() => {
      const pool = this.participants.getDrawPoolUsers();
      if (pool && pool.length > 0) {
        this.triggerFirstParticipantCinematic(pool[0]);
      } else {
        this.transitionTo('REGISTRATION');
      }
    }, 450);
  }

  // First Participant Cinematic Hero Focus
  triggerFirstParticipantCinematic(participant = {}) {
    this.currentScene = 'FIRST_JOIN';
    this.setCameraMode('FIRST_JOIN');

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('live', { size: 16 })} <span>افتتاح المقاعد • المشترك الأول</span>`;
    }

    if (window.soundFX) {
      if (window.soundFX.playFanfare) window.soundFX.playFanfare();
      else if (window.soundFX.playWinner) window.soundFX.playWinner();
    }
    if (window.confettiEngine && window.confettiEngine.spawnShockwave) {
      window.confettiEngine.spawnShockwave(window.innerWidth / 2, window.innerHeight / 2, '#34d399', 180);
    }
    if (window.confettiFX && window.confettiFX.burst) {
      window.confettiFX.burst();
    }

    const name = participant.displayName || participant.nickname || 'المتسابق الأول';
    const avatarUrl = participant.avatar || ParticipantCard.getFallbackAvatar(name);

    if (this.dom.stage) {
      this.dom.stage.innerHTML = `
        <div class="scene-frame anim-player-enter 3d-hero-focus">
          <div class="scene-title-badge">
            ${IconSystem.get('star', { size: 14, color: 'var(--luxury-gold)' })} <span>افتتاح مقاعد الجولة!</span>
          </div>
          <div class="first-join-cinematic-frame 3d-glass-panel">
            <div class="first-join-halo-aura"></div>
            <div class="first-join-badge-tag">
              ${IconSystem.get('crown', { size: 14, color: '#34d399' })} <span>المشترك الأول • مقعد رقم #1</span>
            </div>
            <div class="first-join-avatar-box 3d-avatar-pedestal">
              <div class="first-join-ring-spinner"></div>
              <img src="${avatarUrl}" class="first-join-avatar-img" alt="${name}" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(name)}';" />
              <span class="first-join-slot-pill">VIP #1</span>
            </div>
            <div class="first-join-name">${name}</div>
            <div class="first-join-desc">انضم إلى المنافسة! جارٍ فتح مقاعد الجولة...</div>
          </div>
          <div class="join-callout-box 3d-callout-panel">
            <span class="join-instruction">اكتب في الشات لحجز مقعدك الآن:</span>
            <span class="join-keyword-pill">!join أو "تم"</span>
          </div>
        </div>
      `;
    }

    setTimeout(() => {
      this.transitionTo('REGISTRATION');
    }, 2800);
  }

  // 2. JOIN / REGISTRATION / SEATS SCENE (3D Grid Array)
  renderRegistrationScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('participants', { size: 16 })} <span>مرحلة حجز المقاعد والتسجيل</span>`;
    }

    const targetValue = Number(this.state.get('settings').targetParticipants);
    const target = Number.isFinite(targetValue) ? Math.max(0, targetValue) : 36;
    const pool = this.participants.getDrawPoolUsers();

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-seats-enter 3d-seats-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('participants', { size: 14 })} <span>مقاعد المتسابقين (${pool.length} / ${target})</span>
        </div>
        <div class="join-grid-container 3d-grid-viewport" id="reg-grid">
          <!-- Filled dynamically -->
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">اكتب في الشات للانضمام وحجز المقعد:</span>
          <span class="join-keyword-pill">!join أو "تم"</span>
        </div>
      </div>
    `;

    this.renderRegistrationGrid();
  }

  renderRegistrationGrid() {
    const gridEl = document.getElementById('reg-grid');
    if (!gridEl) return;

    const targetValue = Number(this.state.get('settings').targetParticipants);
    const target = Number.isFinite(targetValue) ? Math.max(0, targetValue) : 36;
    const pool = this.participants.getDrawPoolUsers();

    if (pool.length === 0) {
      gridEl.innerHTML = `
        <div class="seats-empty-waiting 3d-glass-panel">
          <div class="seats-waiting-pulse"></div>
          <span>بانتظار انضمام أول متسابق... اكتب <b>!join</b> أو <b>تم</b> في التعليقات</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (let i = 0; i < target; i++) {
      const user = pool[i] || null;
      html += ParticipantCard.renderSlot(user, i, target);
    }
    gridEl.innerHTML = html;

    if (window.scene3dEngine && window.scene3dEngine.isSupported) {
      for (let i = 0; i < target; i++) {
        window.scene3dEngine.setPedestalUser(i, pool[i] || null);
      }
    }
  }

  // 3. COUNTDOWN & PARTICIPANTS COMPLETE SCENE
  renderParticipantsScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('correct', { size: 16 })} <span>اكتملت مقاعد الجولة!</span>`;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-question-enter 3d-countdown-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('trophy', { size: 14 })} <span>الاستعداد لطرح السؤال</span>
        </div>
        <div class="countdown-hero 3d-glass-panel">
          <div class="countdown-big-num 3d-pulsing-number" id="countdown-num">3</div>
          <div style="font-size: 14px; font-weight: 800; color: var(--text-dim); margin-top: 8px;">
            تجهّز للإجابة بأسرع وقت!
          </div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">طريقة الإجابة في الشات:</span>
          <span class="join-keyword-pill">!answer A أو أ / ب / ج / د</span>
        </div>
      </div>
    `;
  }

  // 4. QUESTION & ANSWERING SCENE (3D Holographic Stage)
  renderQuestionScene() {
    const q = this.state.get('currentQuestion') || {
      category: 'ثقافة عامة',
      question: 'في انتظار طرح السؤال...',
      options: ['أ', 'ب', 'ج', 'د'],
      points: 100
    };

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('question', { size: 16 })} <span>${q.category || 'ثقافة عامة'}</span>`;
    }

    const letters = ['A', 'B', 'C', 'D'];
    const arabicLetters = ['أ', 'ب', 'ج', 'د'];
    let optionsHtml = '';

    if (Array.isArray(q.options) && q.options.length > 0) {
      optionsHtml = q.options.map((opt, idx) => `
        <div class="question-option-card 3d-option-card" id="opt-card-${idx}">
          <div class="option-badge-key 3d-key-badge">${arabicLetters[idx] || letters[idx]}</div>
          <div class="option-text">${typeof opt === 'object' ? (opt.text || '') : opt}</div>
        </div>
      `).join('');
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-question-enter 3d-question-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('question', { size: 14 })} <span>سؤال التحدي (+${q.points || 100} نقطة)</span>
        </div>
        <div class="question-hero-box 3d-hologram-screen">
          <div class="question-hologram-scanline"></div>
          <div class="question-text-title">${q.question || q.text || ''}</div>
          <div class="options-container-grid">
            ${optionsHtml}
          </div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">أرسل الحرف الصحيح في التعليقات:</span>
          <span class="join-keyword-pill">أ / ب / ج / د</span>
        </div>
      </div>
    `;
  }

  // 5. LOCK SCENE
  renderLockScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('lock', { size: 16 })} <span>انتهى الوقت - إغلاق الإجابات</span>`;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame 3d-lock-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('lock', { size: 14 })} <span>إغلاق الإجابات</span>
        </div>
        <div class="lock-hero-box 3d-glass-panel">
          ${IconSystem.get('lock', { size: 54, color: 'var(--neon-magenta)' })}
          <div class="lock-title">تم إغلاق استقبال الإجابات</div>
          <div class="lock-subtitle">جارٍ تدقيق إجابات المتسابقين واحتساب سرعة الاستجابة...</div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">لحظات وتظهر النتيجة الصحيحة:</span>
          <span class="join-keyword-pill">Reveal Answers</span>
        </div>
      </div>
    `;
  }

  // 6. ANSWERS & RESULTS SCENE
  renderAnswersScene() {
    const q = this.state.get('currentQuestion') || {};
    const correctAns = q.correctAnswer || 'أ';

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('correct', { size: 16 })} <span>النتيجة والإجابة الصحيحة</span>`;
    }

    if (window.soundFX) window.soundFX.playCorrect();
    if (window.confettiEngine && window.confettiEngine.spawnShockwave) {
      window.confettiEngine.spawnShockwave(window.innerWidth / 2, window.innerHeight / 2, '#10b981', 200);
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-results-enter 3d-results-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('correct', { size: 14 })} <span>الإجابة المعتمدة</span>
        </div>
        <div class="results-hero-box 3d-glass-panel 3d-correct-glow">
          <div class="correct-badge-pill">
            ${IconSystem.get('correct', { size: 20 })} الإجابة الصحيحة
          </div>
          <div class="correct-answer-text">${correctAns}</div>
          ${q.explanation ? `<div class="answer-explanation">${q.explanation}</div>` : ''}
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">تجهّز لسحب الحظ وتحديد الفائز:</span>
          <span class="join-keyword-pill">Lucky Draw</span>
        </div>
      </div>
    `;
  }

  // 7. LUCKY DRAW & ROULETTE SCENE (3D Spinning Pedestal)
  renderDrawScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('draw', { size: 16 })} <span>سحب الحظ العشوائي</span>`;
    }

    const pool = this.participants.getDrawPoolUsers();
    const candidate = pool[0] || {
      displayName: 'متسابق محظوظ',
      nickname: 'متسابق محظوظ',
      avatar: ParticipantCard.getFallbackAvatar('Lucky')
    };

    this.dom.stage.innerHTML = `
      <div class="scene-frame 3d-draw-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('draw', { size: 14 })} <span>عجلة السحب العشوائي</span>
        </div>
        <div class="draw-hero-box 3d-glass-panel 3d-roulette-pedestal">
          <div class="roulette-wheel-halo"></div>
          <div class="draw-avatar-frame" id="roulette-avatar-frame">
            <img src="${candidate.avatar}" class="roulette-candidate-avatar" id="roulette-img" alt="${candidate.displayName}" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(candidate.displayName)}';" />
          </div>
          <div class="draw-candidate-name" id="roulette-name">${candidate.displayName || candidate.nickname}</div>
          <div class="draw-pool-count">المؤهلون للسحب: <b>${pool.length}</b> متسابق</div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">جارٍ اختيار بطل الجولة عشوائياً...</span>
          <span class="join-keyword-pill">Lucky Draw</span>
        </div>
      </div>
    `;

    this.events.on('draw:step', ({ candidate: c }) => {
      const img = document.getElementById('roulette-img');
      const name = document.getElementById('roulette-name');
      const dName = c.displayName || c.nickname || 'مشارك';
      if (img && c.avatar) img.src = c.avatar;
      if (name) name.textContent = dName;
      if (window.soundFX) window.soundFX.playTick(false);
    });
  }

  // 8. WINNER SCENE (3D Grand Champion Arena)
  renderWinnerScene(winnerData = {}) {
    const winner = winnerData.participant || winnerData.winner || this.state.get('currentWinner') || {
      displayName: 'بطل الجولة',
      nickname: 'بطل الجولة',
      score: 500,
      avatar: ParticipantCard.getFallbackAvatar('Winner')
    };

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('trophy', { size: 16 })} <span>بطل الجولة الفائز!</span>`;
    }

    if (window.soundFX) window.soundFX.playWinner();
    if (window.confettiFX) window.confettiFX.celebrateWinner();

    if (window.scene3dEngine && window.scene3dEngine.isSupported) {
      const pool = this.participants.getDrawPoolUsers();
      let winnerIdx = pool.findIndex(p => p && (p.userId === winner.userId || p.uniqueId === winner.uniqueId || p.nickname === winner.nickname || p.displayName === winner.displayName));
      if (winnerIdx < 0) winnerIdx = 0;
      window.scene3dEngine.setPedestalState(winnerIdx, 'WINNER');
      window.scene3dEngine.setCameraMode('WINNER', winnerIdx);
    }

    const winnerName = winner.displayName || winner.nickname;
    const winnerAvatar = winner.avatar || ParticipantCard.getFallbackAvatar(winnerName);

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-winner-entrance 3d-winner-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('trophy', { size: 14 })} <span>مبروك الفوز والتتويج!</span>
        </div>
        <div class="winner-hero-box 3d-glass-panel 3d-winner-pedestal">
          <div class="winner-avatar-frame 3d-floating-element">
            <div class="winner-crown-icon">
              ${IconSystem.get('trophy', { size: 30, color: 'var(--luxury-gold)' })}
            </div>
            <img src="${winnerAvatar}" class="winner-avatar-img" alt="${winnerName}" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(winnerName)}';" />
          </div>
          <div class="winner-title 3d-title-gold">WINNER!</div>
          <div class="winner-name">${winnerName}</div>
          <div class="winner-score-pill 3d-btn-tactile">
            ${IconSystem.get('winner', { size: 16 })} +${winner.score || 500} نقطة
          </div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">تجهّز للجولة التالية فوراً:</span>
          <span class="join-keyword-pill">Next Round</span>
        </div>
      </div>
    `;
  }

  // 9. LEADERBOARD & PODIUM SCENE (3D Stage Podium)
  renderPodiumScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('ranking', { size: 16 })} <span>منصة المتصدرين الكبرى</span>`;
    }

    const leaders = this.participants.getLeaderboard(10);
    const top1 = leaders[0] || null;
    const top2 = leaders[1] || null;
    const top3 = leaders[2] || null;

    let restHtml = '';
    for (let i = 3; i < leaders.length; i++) {
      const u = leaders[i];
      const name = u.displayName || u.nickname;
      const avatar = u.avatar || ParticipantCard.getFallbackAvatar(name);
      restHtml += `
        <div class="leader-item-card 3d-chip-glass">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:'Orbitron'; font-weight:900; font-size:12px; color:var(--text-dim);">#${i + 1}</span>
            <img src="${avatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" alt="${name}" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(name)}';" />
            <span style="font-size:12px; font-weight:700;">${name}</span>
          </div>
          <span style="font-family:'Orbitron'; font-weight:800; font-size:12px; color:var(--cyber-cyan);">${u.score || u.points || 0} pts</span>
        </div>
      `;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame anim-results-enter 3d-podium-stage">
        <div class="scene-title-badge">
          ${IconSystem.get('ranking', { size: 14 })} <span>لوحة شرف الأبطال</span>
        </div>
        <div class="leaderboard-stage-box 3d-glass-panel">
          <div class="podium-row 3d-podium-pedestals">
            <!-- Rank 2 -->
            <div class="podium-card rank-2 3d-pedestal-silver">
              <span style="font-size:11px; font-weight:900; color:#94a3b8;">#2</span>
              ${top2 ? `<img src="${top2.avatar || ParticipantCard.getFallbackAvatar(top2.displayName || top2.nickname)}" style="width:36px; height:36px; border-radius:50%; margin:4px 0; object-fit:cover;" alt="" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(top2.displayName || top2.nickname)}';" /><span style="font-size:10px; font-weight:700;">${top2.displayName || top2.nickname}</span><span style="font-family:'Orbitron'; font-size:10px; color:var(--cyber-teal);">${top2.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
            <!-- Rank 1 -->
            <div class="podium-card rank-1 3d-pedestal-gold">
              ${IconSystem.get('trophy', { size: 20, color: 'var(--luxury-gold)' })}
              <span style="font-size:12px; font-weight:900; color:var(--luxury-gold);">#1</span>
              ${top1 ? `<img src="${top1.avatar || ParticipantCard.getFallbackAvatar(top1.displayName || top1.nickname)}" style="width:48px; height:48px; border-radius:50%; border:2px solid var(--luxury-gold); margin:4px 0; object-fit:cover;" alt="" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(top1.displayName || top1.nickname)}';" /><span style="font-size:11px; font-weight:800;">${top1.displayName || top1.nickname}</span><span style="font-family:'Orbitron'; font-size:11px; color:var(--luxury-gold); font-weight:900;">${top1.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
            <!-- Rank 3 -->
            <div class="podium-card rank-3 3d-pedestal-bronze">
              <span style="font-size:11px; font-weight:900; color:#d97706;">#3</span>
              ${top3 ? `<img src="${top3.avatar || ParticipantCard.getFallbackAvatar(top3.displayName || top3.nickname)}" style="width:36px; height:36px; border-radius:50%; margin:4px 0; object-fit:cover;" alt="" onerror="this.onerror=null; this.src='${ParticipantCard.getFallbackAvatar(top3.displayName || top3.nickname)}';" /><span style="font-size:10px; font-weight:700;">${top3.displayName || top3.nickname}</span><span style="font-family:'Orbitron'; font-size:10px; color:var(--cyber-teal);">${top3.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
          </div>
          <div class="leaderboard-scroll-list">
            ${restHtml || '<div style="color:var(--text-dim); text-align:center; font-size:11px;">في انتظار بقية النتائج...</div>'}
          </div>
        </div>
        <div class="join-callout-box 3d-callout-panel">
          <span class="join-instruction">تحديثات الصدارة مستمرة طوال البث:</span>
          <span class="join-keyword-pill">Live Leaderboard</span>
        </div>
      </div>
    `;
  }

  // Update all 5 Top Realtime Metric Counters
  updateHeaderStats() {
    const eng = this.state.get('engagement') || {};
    const round = this.state.get('round') || { roundNumber: 1 };
    const pool = this.participants.getDrawPoolUsers();

    if (this.dom.statParticipants) this.dom.statParticipants.textContent = pool.length;
    if (this.dom.valViewers) this.dom.valViewers.textContent = eng.viewerCount !== undefined ? eng.viewerCount : (eng.viewers || 0);
    if (this.dom.valLikes) this.dom.valLikes.textContent = eng.likes || 0;
    if (this.dom.valShares) this.dom.valShares.textContent = eng.shares || 0;
    if (this.dom.valGifts) this.dom.valGifts.textContent = eng.totalGifts || eng.gifts || 0;
    if (this.dom.valDiamonds) this.dom.valDiamonds.textContent = eng.diamonds || 0;
    if (this.dom.valComments) this.dom.valComments.textContent = eng.comments || 0;
    if (this.dom.valRound) this.dom.valRound.textContent = `ROUND ${String(round.roundNumber || 1).padStart(2, '0')}`;
  }

  updateTimerDisplay(timer) {
    if (!this.dom.timerText || !this.dom.timerBar) return;
    const settings = this.state.get('settings') || {};
    const configuredDuration = Number(settings.questionDuration);
    const fallbackDuration = Number.isFinite(configuredDuration) && configuredDuration > 0 ? configuredDuration : 15;
    const remaining = timer.remaining !== undefined ? timer.remaining : fallbackDuration;
    const duration = Number(timer.duration) > 0 ? Number(timer.duration) : fallbackDuration;

    this.dom.timerText.textContent = remaining;

    const totalDash = 188.4;
    const offset = totalDash - (remaining / duration) * totalDash;
    this.dom.timerBar.style.strokeDashoffset = offset;

    const isUrgent = remaining <= 5;
    if (isUrgent) {
      this.dom.timerBar.classList.add('timer-urgent');
      if (window.soundFX) window.soundFX.playTick(true);
    } else {
      this.dom.timerBar.classList.remove('timer-urgent');
      if (window.soundFX && remaining < duration) window.soundFX.playTick(false);
    }
  }

  updateLeaderboard() {
    if (!this.dom.leaderboardList) return;
    const leaders = this.participants.getLeaderboard(5);
    if (!leaders.length) return;

    this.dom.leaderboardList.innerHTML = leaders.map((u, i) => ParticipantCard.renderChip(u, i + 1)).join('');
  }
}

if (typeof window !== 'undefined') {
  window.SceneManager = SceneManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SceneManager = SceneManager;
}
