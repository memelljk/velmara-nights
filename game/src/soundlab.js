// soundlab.js — every sound in Velmara Nights is synthesised live with
// WebAudio: a two-stroke engine note tied to speed, police sirens, rain on
// wet asphalt, gunshots, UI blips and a moody minor-key bassline that
// follows the player around the city. No audio files, no network. M mutes.
window.V = window.V || {};
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var engineOsc = null, engineGain = null, engineFilter = null;
  var sirenOsc = null, sirenGain = null, sirenLfo = null;
  var bassTimer = 0, bassStep = 0;
  var started = false;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function noiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startAmbience() {
    if (!ensure() || started) return;
    started = true;
    // rain: looped filtered noise, soft and constant
    var rain = ctx.createBufferSource();
    rain.buffer = noiseBuffer(2.2);
    rain.loop = true;
    var rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 900;
    var rainGain = ctx.createGain();
    rainGain.gain.value = 0.05;
    rain.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(master);
    rain.start();
    // engine: sawtooth through a lowpass, pitch follows the driven car
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    // siren: square wave with an LFO sweeping its pitch
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 800;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 0.65;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); sirenLfo.start();
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, filterFreq, vol, type) {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    var f = ctx.createBiquadFilter();
    f.type = type || 'highpass';
    f.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // The bassline: A minor, one bar of eighth notes, sequenced on the
  // animation clock from play.js (updateSound).
  var BASSLINE = [55, 0, 55, 65.4, 0, 55, 0, 82.4, 55, 0, 55, 65.4, 0, 98, 82.4, 73.4];
  function updateSound(dt, state) {
    if (!ctx || !started) return;
    // engine follows the car Jax is driving (or idles off on foot)
    var target = 0, freq = 55;
    if (state.driving) {
      target = 0.05 + Math.min(0.1, Math.abs(state.speed) * 0.0022);
      freq = 52 + Math.abs(state.speed) * 3.4 + (state.throttle > 0 ? 9 : 0);
    }
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.09);
    engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.06);
    engineFilter.frequency.setTargetAtTime(280 + Math.abs(state.speed) * 22, ctx.currentTime, 0.1);
    // siren swells with the nearest cruiser
    var sirenTarget = 0;
    if (state.nearestCopDist < 60 && state.stars > 0) {
      sirenTarget = 0.028 * (1 - state.nearestCopDist / 60) + 0.004;
    }
    sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
    // bassline runs while playing
    if (state.playing) {
      bassTimer -= dt;
      if (bassTimer <= 0) {
        bassTimer = 0.235;
        var note = BASSLINE[bassStep % BASSLINE.length];
        bassStep++;
        if (note) blip(note, 0.22, 'triangle', 0.11);
        if (bassStep % 8 === 4) blip(220, 0.3, 'sine', 0.03); // ghost pad
      }
    }
  }

  var sound = {
    start: startAmbience,
    update: updateSound,
    gunshot: function (far) { noiseBurst(0.16, 500, far ? 0.10 : 0.3, 'lowpass'); blip(150, 0.08, 'square', 0.1, 60); },
    click: function () { blip(900, 0.05, 'square', 0.08); },
    reload: function () { blip(320, 0.07, 'square', 0.1); setTimeout(function () { blip(520, 0.06, 'square', 0.1); }, 130); },
    thud: function () { noiseBurst(0.1, 300, 0.25, 'lowpass'); },
    cash: function () { blip(880, 0.09, 'sine', 0.14); setTimeout(function () { blip(1318, 0.14, 'sine', 0.14); }, 70); },
    checkpoint: function () { blip(660, 0.1, 'sine', 0.15); setTimeout(function () { blip(990, 0.16, 'sine', 0.15); }, 90); },
    missionStart: function () { blip(392, 0.14, 'triangle', 0.16); setTimeout(function () { blip(523, 0.2, 'triangle', 0.16); }, 120); },
    missionFail: function () { blip(300, 0.25, 'triangle', 0.15, 170); },
    door: function () { noiseBurst(0.07, 1200, 0.1, 'bandpass'); },
    crash: function () { noiseBurst(0.28, 240, 0.32, 'lowpass'); },
    sirenBlip: function () { blip(700, 0.16, 'triangle', 0.1, 1050); },
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted: function () { return muted; }
  };
  V.sound = sound;
})();
