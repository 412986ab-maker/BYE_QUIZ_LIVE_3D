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
 * 3D Realistic Participant Card Component
 * Adds holographic depth, metallic bevels, avatar lighting rings,
 * and reactive elevation states (idle / correct / wrong / winner).
 */
class ParticipantCard {
  static getFallbackAvatar(name = 'Player') {
    const safeName = encodeURIComponent((name || 'Player').toString().trim());
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeName}`;
  }

  static renderAvatar(user, customClass = '', size = 40) {
    const rawName = user ? (user.displayName || user.nickname || user.username || user.uniqueId || 'مشارك') : 'مشارك';
    const name = escapeHtml(rawName);
    
    const realAvatarUrl = user ? (user.avatar || user.profilePictureUrl || user.profilePicture || user.avatarUrl) : null;
    const avatarUrl = realAvatarUrl ? escapeHtml(realAvatarUrl) : ParticipantCard.getFallbackAvatar(name);
    const fallback = ParticipantCard.getFallbackAvatar(name);

    return `
      <div class="avatar-3d-wrapper" style="width: ${size}px; height: ${size}px;">
        <div class="avatar-neon-aura"></div>
        <img src="${avatarUrl}" 
             class="p-avatar ${customClass}" 
             alt="${name}" 
             loading="lazy"
             onerror="this.onerror=null; this.src='${fallback}';" 
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />
      </div>
    `;
  }

  static renderSlot(user, index = 0, total = 36) {
    if (!user) {
      return `
        <div class="p-slot empty guest-slot" aria-label="مقعد ضيف فارغ">
          <div class="guest-avatar-placeholder" aria-hidden="true"></div>
        </div>
      `;
    }

    const name = escapeHtml(user.displayName || user.nickname || 'لاعب');
    const avatar = ParticipantCard.renderAvatar(user, 'slot-img', 44);
    const isWinner = user.isWinner || user.wins > 0;
    const isCorrect = user.score > 0;

    return `
      <div class="p-slot occupied guest-slot animate-pop ${isWinner ? 'state-winner' : (isCorrect ? 'state-elevated' : '')}" id="slot-${user.id || index}">
        ${avatar}
        <span class="slot-name">${name}</span>
      </div>
    `;
  }

  static renderChip(user, rank = null) {
    if (!user) return '';
    const name = escapeHtml(user.displayName || user.nickname || 'لاعب');
    const score = user.points || user.score || 0;
    const avatar = ParticipantCard.renderAvatar(user, 'chip-img', 30);
    const rankHtml = rank !== null ? `<span class="chip-rank">#${rank}</span>` : '';
    const flameIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('flame', { size: 12, color: '#f59e0b' }) : '';
    const streakHtml = (user.streak >= 3) ? `<span class="chip-streak">${flameIcon} ${user.streak}</span>` : '';

    return `
      <div class="p-chip 3d-chip-glass">
        ${rankHtml}
        ${avatar}
        <span class="chip-name">${name}</span>
        ${streakHtml}
        <span class="chip-score">${score} نقطة</span>
      </div>
    `;
  }

  static renderSpotlight(user, title = 'أسرع إجابة') {
    if (!user) return '';
    const name = escapeHtml(user.displayName || user.nickname || 'البطل');
    const avatar = ParticipantCard.renderAvatar(user, 'spotlight-img', 56);
    const speed = user.speedSeconds ? `${user.speedSeconds} ثانية` : '';
    const timerIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('timer', { size: 14, color: '#00f2fe' }) : '';
    const boltIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('bolt', { size: 16, color: '#ffd700' }) : '';

    return `
      <div class="p-spotlight-card 3d-spotlight-hero animate-bounce-in">
        <div class="spotlight-title">${boltIcon} ${escapeHtml(title)}</div>
        <div class="spotlight-body">
          ${avatar}
          <div class="spotlight-info">
            <div class="spotlight-name">${name}</div>
            ${speed ? `<div class="spotlight-speed">${timerIcon} في غضون ${speed}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.ParticipantCard = ParticipantCard;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ParticipantCard = ParticipantCard;
}
