// soundlab.js — every sound in Velmara Nights is synthesised live with
// WebAudio: rain hiss, a minor-key bassline, engine hum tied to speed,
// sirens, gunshots, cash-register reward blips. No audio files, no network.
window.VN = window.VN || {};

VN.sound = (function () {
  'use strict';

  var ctx = null, master = null, muted = false;
  var engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  var bassTimer = 0, bassStep = 0, started = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startRain();
    startEngine();
    started = true;
    return true;
  }

  function noiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  function startRain() {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2); src.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    var g = ctx.createGain(); g.gain.value = 0.035;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start();
  }
  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 40;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 300;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  function noiseHit(dur, freq, vol) {
    if (!ctx || muted) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    var filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start();
  }

  // The bassline: A-minor pulse, one bar of eighths, only while playing.
  var BASS = [55, 0, 55, 55, 0, 65.4, 0, 49, 55, 0, 55, 55, 0, 82.4, 73.4, 49];
  function step(state, dt) {
    if (!ctx || muted) return;
    if (state.mode === 'play' || state.mode === 'drive') {
      bassTimer -= dt;
      if (bassTimer <= 0) {
        bassTimer = 0.21;
        var f = BASS[bassStep % BASS.length];
        bassStep++;
        if (f) blip(f, 0.19, 'triangle', 0.16);
      }
    }
    if (engineGain) {
      var target = 0, freq = 40;
      if (state.player && state.player.car) {
        var sp = Math.abs(state.player.car.speed);
        target = 0.05 + Math.min(0.06, sp * 0.0015);
        freq = 42 + sp * 2.6;
      }
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
    }
    if (sirenGain && sirenOsc) {
      var near = state.law && state.law.cruisers.length > 0;
      sirenGain.gain.setTargetAtTime(near && !muted ? 0.018 : 0, ctx.currentTime, 0.2);
      if (near) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(ctx.currentTime * 4.4) * 160, ctx.currentTime, 0.05);
    }
  }

  return {
    ensure: ensure,
    step: step,
    toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted: function () { return muted; },
    shot: function (far) { noiseHit(0.14, far ? 900 : 1600, far ? 0.10 : 0.22); blip(160, 0.08, 'square', 0.08, 60); },
    reloadClick: function () { blip(900, 0.05, 'square', 0.07); setTimeout(function () { blip(620, 0.05, 'square', 0.07); }, 90); },
    thud: function () { noiseHit(0.1, 300, 0.16); },
    crash: function () { noiseHit(0.3, 500, 0.2); blip(90, 0.25, 'sawtooth', 0.1, 40); },
    cash: function () { blip(880, 0.09, 'square', 0.1); setTimeout(function () { blip(1320, 0.14, 'square', 0.1); }, 80); },
    door: function () { blip(240, 0.07, 'square', 0.08, 180); },
    sirenBurst: function () { blip(700, 0.16, 'triangle', 0.1, 950); },
    missionDone: function () { var n = [523, 659, 784, 1046]; n.forEach(function (f, i) { setTimeout(function () { blip(f, 0.16, 'square', 0.09); }, i * 95); }); },
    panicAt: function () {}
  };
})();
