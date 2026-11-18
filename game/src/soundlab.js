// soundlab.js — every sound in Velmara Nights is synthesised live with WebAudio.
// No audio files: a rain-noise loop, a two-oscillator engine, a police siren,
// noise-burst gunshots, UI blips and a moody minor-key bassline sequencer.

export class SoundLab {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.bassTimer = 0;
    this.bassStep = 0;
    this.started = false;
  }

  /** Must be called from a user gesture at least once. Safe to call again. */
  start() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this._startRain();
    this._startEngine();
    this._startSiren();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startRain() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 20;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    this.engineOsc2.connect(filter);
    filter.connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  /** rpm01: 0..1 throttle/speed blend; driving: whether the player is in a car. */
  setEngine(rpm01, driving) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + rpm01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.09);
    this.engineOsc.frequency.setTargetAtTime(42 + rpm01 * 118, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(21 + rpm01 * 59, t, 0.06);
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  /** level: 0..1 how present the police are this frame. */
  setSiren(level, timeSeconds) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(level * 0.035, t, 0.2);
    if (level > 0.01) {
      const wail = Math.sin(timeSeconds * 2.4) * 0.5 + 0.5;
      this.sirenOsc.frequency.setTargetAtTime(650 + wail * 350, t, 0.05);
    }
  }

  gunshot(enemy = false) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.16);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = enemy ? 900 : 1500;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(enemy ? 0.22 : 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.17);
  }

  dryFire() {
    this._blip(1900, 0.04, 0.12, 'square');
  }

  reload() {
    this._blip(500, 0.05, 0.15, 'square');
    setTimeout(() => this._blip(760, 0.05, 0.15, 'square'), 130);
  }

  punch() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.09);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  cash() {
    this._blip(1180, 0.07, 0.16, 'sine');
    setTimeout(() => this._blip(1560, 0.1, 0.16, 'sine'), 70);
  }

  carDoor() {
    this._blip(140, 0.08, 0.3, 'square');
  }

  crash(intensity = 1) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.6, 0.25 * intensity + 0.15), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  sirenWhoop() {
    this._blip(880, 0.12, 0.1, 'triangle');
  }

  missionDone() {
    if (!this.started) return;
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 0.18, 'triangle'), i * 110));
  }

  _blip(freq, dur, vol, type = 'sine') {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A slow synthwave bassline in D minor, stepped by the game loop's clock. */
  updateBass(dt, active) {
    if (!this.started || !active) return;
    this.bassTimer -= dt;
    if (this.bassTimer > 0) return;
    this.bassTimer = 0.235;
    const line = [73.4, 0, 73.4, 87.3, 0, 73.4, 0, 65.4, 73.4, 0, 73.4, 98, 0, 110, 98, 87.3];
    const note = line[this.bassStep % line.length];
    this.bassStep++;
    if (note) this._bassNote(note);
  }

  _bassNote(freq) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
  }
}
