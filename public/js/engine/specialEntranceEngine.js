/**
 * BYE QUIZ LIVE — Special Entrance Renderer
 * Compact cinematic VIP entrance that never replaces the active game scene.
 */
class SpecialEntranceEngine {
  constructor(events) {
    this.events = events;
    this.queue = [];
    this.active = false;
    this.root = null;
    this.current = null;

    this.events.on('SPECIAL_ENTRANCE', payload => this.enqueue(payload));
    this.ensureRoot();
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    this.root = document.getElementById('special-entrance-layer');
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'special-entrance-layer';
      this.root.className = 'special-entrance-layer';
      this.root.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.root);
    }
    return this.root;
  }

  enqueue(payload = {}) {
    const config = payload.config || {};
    const user = payload.user || {};
    const item = {
      ...payload,
      config: {
        tier: 'VIP',
        effect: 'portal',
        duration: 3200,
        title: 'SPECIAL ENTRANCE',
        subtitle: 'دخول مميز',
        ...config
      },
      user: {
        uniqueId: user.uniqueId || 'viewer',
        displayName: user.displayName || user.nickname || user.uniqueId || 'مشاهد',
        avatar: user.avatar || null
      }
    };

    // Do not let a burst of repeated member events flood the overlay.
    const key = String(item.user.uniqueId || '').toLowerCase();
    if (this.current && String(this.current.user.uniqueId || '').toLowerCase() === key) return;
    if (this.queue.some(x => String(x.user.uniqueId || '').toLowerCase() === key)) return;

    this.queue.push(item);
    if (this.queue.length > 4) this.queue.splice(0, this.queue.length - 4);
    this.playNext();
  }

  playNext() {
    if (this.active || this.queue.length === 0) return;
    const item = this.queue.shift();
    this.active = true;
    this.current = item;

    const root = this.ensureRoot();
    if (!root) {
      this.active = false;
      this.current = null;
      return;
    }

    const config = item.config;
    const user = item.user;
    const effect = ['portal', 'gold', 'neon', 'lightning', 'cinematic'].includes(String(config.effect))
      ? String(config.effect)
      : 'portal';
    const tier = String(config.tier || 'VIP').toLowerCase();
    const duration = Math.min(8000, Math.max(1500, Number(config.duration) || 3200));

    const card = document.createElement('div');
    card.className = 'special-entrance-card effect-' + effect + ' tier-' + tier;
    card.style.setProperty('--special-duration', duration + 'ms');

    const avatar = document.createElement('div');
    avatar.className = 'special-entrance-avatar';
    if (config.imageUrl || user.avatar) {
      const img = document.createElement('img');
      img.src = config.imageUrl || user.avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        img.remove();
        avatar.appendChild(this.createInitials(user.displayName));
      };
      avatar.appendChild(img);
    } else {
      avatar.appendChild(this.createInitials(user.displayName));
    }

    const copy = document.createElement('div');
    copy.className = 'special-entrance-copy';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'special-entrance-eyebrow';
    eyebrow.textContent = String(config.tier || 'VIP');

    const name = document.createElement('div');
    name.className = 'special-entrance-name';
    name.textContent = String(config.displayName || user.displayName || user.uniqueId);

    const title = document.createElement('div');
    title.className = 'special-entrance-title';
    title.textContent = String(config.title || 'SPECIAL ENTRANCE');

    const subtitle = document.createElement('div');
    subtitle.className = 'special-entrance-subtitle';
    subtitle.textContent = String(config.subtitle || 'دخول مميز');

    copy.append(eyebrow, name, title, subtitle);

    const sigil = document.createElement('div');
    sigil.className = 'special-entrance-sigil';
    sigil.innerHTML = '<span></span><span></span><span></span>';

    card.append(avatar, copy, sigil);
    root.appendChild(card);

    requestAnimationFrame(() => card.classList.add('is-visible'));

    window.setTimeout(() => {
      card.classList.remove('is-visible');
      card.classList.add('is-leaving');
      window.setTimeout(() => {
        card.remove();
        this.active = false;
        this.current = null;
        this.playNext();
      }, 520);
    }, Math.max(900, duration - 520));
  }

  createInitials(name) {
    const node = document.createElement('span');
    node.className = 'special-entrance-initials';
    const clean = String(name || 'VIP').trim();
    node.textContent = clean.slice(0, 2).toUpperCase();
    return node;
  }
}

if (typeof window !== 'undefined') {
  window.SpecialEntranceEngine = SpecialEntranceEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SpecialEntranceEngine = SpecialEntranceEngine;
}
