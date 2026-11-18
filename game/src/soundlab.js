// soundlab.js - every sound in Velmara Nights is synthesised with raw
// WebAudio: a two-oscillator engine, a two-tone siren, noise-burst gunshots,
// filtered rain hiss and a minor-key bassline sequencer. No audio files.
// The context is created lazily on the first user gesture; M mutes.
window.VN = window.VN || {};

VN.SFX = (function () {
  let ctx = null, master = null, muted = false;
  let engineOsc = null, engineOsc2 = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenOn = false, sirenT = 0;
  let rainSrc = null, bassTimer = null, bassStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startRain();
      startBass();
      return true;
    } catch (e) {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startRain() {
    rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer(2);
    rainSrc.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.035;
    rainSrc.connect(filt); filt.connect(g); g.connect(master);
    rainSrc.start();
  }

  const BASSLINE = [55, 0, 55, 65.4, 0, 55, 0, 82.4, 55, 0, 55, 65.4, 0, 49, 0, 73.4];
  function startBass() {
    bassTimer = setInterval(() => {
      if (!ctx || muted || ctx.state !== 'running') return;
      const f = BASSLINE[bassStep % BASSLINE.length];
      bassStep++;
      if (!f) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + 0.24);
    }, 240);
  }

  function burst(freq, dur, gain, type) {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = type || 'bandpass'; filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  function tone(freq, dur, gain, type, slideTo) {
    if (!ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setValueAtTime(m ? 0 : 0.5, ctx.currentTime);
    },
    get muted() { return muted; },
    shot(far) { burst(far ? 1400 : 900, far ? 0.12 : 0.16, far ? 0.12 : 0.3); },
    swing() { burst(500, 0.08, 0.08, 'lowpass'); },
    reload() { tone(300, 0.07, 0.1, 'square'); setTimeout(() => tone(520, 0.06, 0.1, 'square'), 130); },
    crash() { burst(240, 0.3, 0.32, 'lowpass'); },
    cash() { tone(880, 0.09, 0.12, 'sine'); setTimeout(() => tone(1320, 0.12, 0.12, 'sine'), 80); },
    ding() { tone(660, 0.15, 0.12, 'sine'); },
    fail() { tone(220, 0.3, 0.14, 'sawtooth', 110); },
    door() { tone(180, 0.08, 0.1, 'square'); },
    engine(on, speedRatio) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc2 = ctx.createOscillator();
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        engineOsc.type = 'sawtooth'; engineOsc2.type = 'square';
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500;
        engineOsc.connect(filt); engineOsc2.connect(filt); filt.connect(engineGain); engineGain.connect(master);
        engineOsc.start(); engineOsc2.start();
      }
      if (engineOsc) {
        const f = 55 + Math.abs(speedRatio || 0) * 130;
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.06);
        engineOsc2.frequency.setTargetAtTime(f * 0.5 + 2, ctx.currentTime, 0.06);
        engineGain.gain.setTargetAtTime(on ? 0.05 + Math.abs(speedRatio || 0) * 0.05 : 0, ctx.currentTime, 0.1);
      }
    },
    siren(active) {
      if (!ensure()) return;
      if (active && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle'; sirenGain.gain.value = 0.028;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        sirenOn = true;
      }
      if (sirenOsc) {
        sirenT += 0.05;
        sirenOsc.frequency.setValueAtTime(Math.sin(sirenT * 4) > 0 ? 720 : 540, ctx.currentTime);
        sirenGain.gain.setTargetAtTime(active ? 0.028 : 0, ctx.currentTime, 0.2);
        if (!active && sirenGain.gain.value < 0.002) {
          try { sirenOsc.stop(); } catch (e) { /* already stopped */ }
          sirenOsc = null; sirenOn = false;
        }
      }
    },
  };
})();
