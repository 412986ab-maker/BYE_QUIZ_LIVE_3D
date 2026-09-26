/**
 * BYE QUIZ LIVE - High-End Procedural Web Audio Synthesizer
 * Generates studio atmosphere, cinematic whooshes, harmonic chimes,
 * tension countdown pulses, and victory fanfares directly via Web Audio API.
 * 100% Zero External Audio Files | Zero Latency | Mobile GPU & Battery Friendly
 */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.85;
    this.lastSoundTime = new Map();
    this.minIntervalMs = 70;
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientGain = null;
    this.ambientActive = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  canPlay(soundKey) {
    if (!this.enabled || !this.ctx) return false;
    const now = Date.now();
    const last = this.lastSoundTime.get(soundKey) || 0;
    if (now - last < this.minIntervalMs) return false;
    this.lastSoundTime.set(soundKey, now);
    return true;
  }

  // 1. Studio Ambient Atmosphere Pad (Soft futuristic live drone)
  startAmbientDrone() {
    this.init();
    if (!this.ctx || this.ambientActive) return;
    try {
      this.ambientActive = true;
      const now = this.ctx.currentTime;
      
      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientGain = this.ctx.createGain();

      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, now); // A1 note
      
      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(110, now); // A2 note

      this.ambientGain.gain.setValueAtTime(0.001, now);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.04 * this.volume, now + 3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);

      this.ambientOsc1.connect(filter);
      this.ambientOsc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.ambientOsc1.start(now);
      this.ambientOsc2.start(now);
    } catch (e) {}
  }

  // 2. Cinematic Camera Whoosh & Stage Transition
  playTransition() {
    this.init();
    if (!this.canPlay('transition')) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.35);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.35);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18 * this.volume, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // 3. Question Countdown Tick (Dynamic frequency ramp on urgent)
  playTick(urgent = false) {
    this.init();
    if (!this.canPlay('tick')) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = urgent ? 'sawtooth' : 'sine';
      const startFreq = urgent ? 920 : 650;
      const endFreq = urgent ? 550 : 380;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);

      gain.gain.setValueAtTime((urgent ? 0.22 : 0.14) * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  // 4. Correct Answer Harmonic Chime (Rich Major Chord Progression)
  playCorrect() {
    this.init();
    if (!this.canPlay('correct')) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.22 * this.volume, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.35);
      });
    } catch (e) {}
  }

  // 5. Wrong Answer Low Thud
  playWrong() {
    this.init();
    if (!this.canPlay('wrong')) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.22);

      gain.gain.setValueAtTime(0.25 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  // 6. First Participant Fanfare
  playFanfare() {
    this.init();
    if (!this.canPlay('fanfare')) return;
    try {
      const now = this.ctx.currentTime;
      const chords = [
        [440, 554.37, 659.25], // A major
        [587.33, 739.99, 880]  // D major
      ];
      chords.forEach((chord, cIdx) => {
        const time = now + cIdx * 0.18;
        chord.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.18 * this.volume, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(time);
          osc.stop(time + 0.4);
        });
      });
    } catch (e) {}
  }

  // 7. Grand Winner Triumphant Fanfare
  playWinner() {
    this.init();
    if (!this.canPlay('winner')) return;
    try {
      const now = this.ctx.currentTime;
      const sequence = [
        { notes: [523.25, 659.25, 783.99], dur: 0.18, offset: 0 },
        { notes: [523.25, 659.25, 783.99], dur: 0.18, offset: 0.2 },
        { notes: [523.25, 659.25, 783.99], dur: 0.18, offset: 0.4 },
        { notes: [659.25, 830.61, 987.77], dur: 0.22, offset: 0.62 },
        { notes: [783.99, 987.77, 1174.66], dur: 0.25, offset: 0.86 },
        { notes: [1046.50, 1318.51, 1567.98], dur: 0.8, offset: 1.12 }
      ];

      sequence.forEach((step) => {
        const stepTime = now + step.offset;
        step.notes.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, stepTime);
          gain.gain.setValueAtTime(0.2 * this.volume, stepTime);
          gain.gain.exponentialRampToValueAtTime(0.001, stepTime + step.dur);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(stepTime);
          osc.stop(stepTime + step.dur);
        });
      });
    } catch (e) {}
  }

  // 8. Gift Event Audio (Small & Big Tiers)
  playGiftSmall() {
    this.init();
    if (!this.canPlay('gift_small')) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
      gain.gain.setValueAtTime(0.18 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  playGiftBig() {
    this.init();
    if (!this.canPlay('gift_big')) return;
    try {
      const now = this.ctx.currentTime;
      [587.33, 880, 1174.66, 1760].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.2 * this.volume, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    } catch (e) {}
  }

  playMajorMilestone() {
    this.playWinner();
  }

  playLikeMilestone() {
    this.playCorrect();
  }

  playShareMilestone() {
    this.playTransition();
  }

  playFollow() {
    this.playGiftSmall();
  }

  playCombo(multiplier = 2) {
    this.init();
    if (!this.canPlay('combo')) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 * Math.min(multiplier, 5), now);
      osc.frequency.exponentialRampToValueAtTime(600 * Math.min(multiplier, 5), now + 0.15);
      gain.gain.setValueAtTime(0.15 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  playAchievement() {
    this.playCorrect();
  }
}

if (typeof window !== 'undefined') {
  window.SoundFX = SoundFX;
  window.soundFX = new SoundFX();
}
if (typeof globalThis !== 'undefined') {
  globalThis.SoundFX = SoundFX;
}
