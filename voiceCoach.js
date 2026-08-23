/**
 * Voice Coach & Audio Feedback Engine
 * Utilizes Web Speech API for real-time spoken cues and Web Audio API for telemetry chime sounds.
 */

export class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.volume = 1.0;
    this.rate = 1.05;
    this.lastSpokenText = '';
    this.lastSpeakTime = 0;
    this.minIntervalMs = 3500; // Throttle spoken feedback
    this.audioCtx = null;
    this.synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
  }

  initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  toggle(enabled) {
    this.enabled = enabled !== undefined ? enabled : !this.enabled;
    if (!this.enabled && this.synth) {
      this.synth.cancel();
    }
    return this.enabled;
  }

  /**
   * Speaks coaching feedback with intelligent throttling and deduplication
   */
  speak(text, priority = false) {
    if (!this.enabled || !this.synth || !text) return;

    const now = Date.now();
    // Don't repeat the exact same feedback within 4.5 seconds unless high priority
    if (!priority && text === this.lastSpokenText && now - this.lastSpeakTime < 4500) {
      return;
    }
    // Throttle general speech interval
    if (!priority && now - this.lastSpeakTime < this.minIntervalMs) {
      return;
    }

    if (priority) {
      this.synth.cancel(); // Interrupt current speech for emergency warnings
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    utterance.pitch = 1.0;

    // Pick a natural English voice if available
    const voices = this.synth.getVoices();
    const naturalVoice = voices.find(v => (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David'))));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.lastSpokenText = text;
    this.lastSpeakTime = now;
    this.synth.speak(utterance);
  }

  /**
   * Plays synthetic telemetry beeps and chimes using Web Audio API
   */
  playChime(type = 'rep_success') {
    if (!this.enabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'rep_success') {
      // Pleasant double tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'warning') {
      // Dissonant alert tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'start') {
      // Ascending chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'danger_siren') {
      // Urgent oscillating warning siren
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(350, now + 0.12);
      osc.frequency.linearRampToValueAtTime(700, now + 0.24);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'lock_success') {
      // Futuristic positive lock chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }
}
