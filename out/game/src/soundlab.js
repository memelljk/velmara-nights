// soundlab.js — WebAudio-only synth: engine, siren, shots, rain hiss, bassline. M mutes.
window.VN = window.VN || {};
VN.sound = {
  ctx: null, muted: false, master: null, bassTimer: 0, note: 0,
  init: function () {
    if (this.ctx) return;
    // only create the context after a real user activation, so headless/probe
    // loads never emit the AudioContext autoplay warning
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  tone: function (freq, dur, type, vol, slide) {
    if (!this.ctx || this.muted) return;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(slide, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  },
  shot: function () { this.tone(180, 0.09, 'sawtooth', 0.3, 40); },
  siren: function () { this.tone(760, 0.28, 'sine', 0.05, 1180); },
  pickup: function () { this.tone(660, 0.12, 'sine', 0.2, 990); },
  cash: function () { this.tone(880, 0.1, 'triangle', 0.22); this.tone(1320, 0.16, 'triangle', 0.18); },
  crash: function () { this.tone(90, 0.25, 'sawtooth', 0.3, 35); },
  engine: function (speedRatio) { /* light: short blip throttled by play loop */ if (Math.random() < 0.06) this.tone(55 + speedRatio * 90, 0.08, 'sawtooth', 0.045); },
  bassline: function (dt) {
    this.bassTimer -= dt;
    if (this.bassTimer <= 0 && this.ctx && !this.muted) {
      var scale = [55, 55, 65.4, 49];
      this.tone(scale[this.note % 4], 0.22, 'triangle', 0.12);
      this.note++; this.bassTimer = 0.24;
    }
  },
  toggleMute: function () { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.16; return this.muted; }
};
