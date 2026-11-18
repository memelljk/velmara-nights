// interface.js — everything drawn over the 3D world: the HUD (cash, rep
// rank, clock, health, wanted stars, BUSTED meter, speed and ammo), the
// objective banner, the LIVE circular minimap, the full city map on P,
// dialogue boxes, toasts, and the title / pause / end screens.
window.V = window.V || {};
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  var ui = {
    hud: el('hud'), cash: el('hud-cash'), rep: el('hud-rep'), rank: el('hud-rank'),
    clock: el('hud-clock'), healthFill: el('health-fill'),
    bustedWrap: el('busted-wrap'), bustedFill: el('busted-fill'),
    stars: el('hud-stars'), objective: el('objective'), objLabel: el('obj-label'),
    objDist: el('obj-dist'), objTimer: el('obj-timer'),
    minimap: el('minimap'), carBox: el('hud-car'), speed: el('hud-speed'),
    carName: el('hud-car-name'), carHealth: el('car-health-fill'),
    ammo: el('hud-ammo'), ammoMag: el('ammo-mag'), ammoRes: el('ammo-res'),
    interact: el('interact'), crosshair: el('crosshair'), toastBox: el('toast'),
    dialogue: el('dialogue'), dlgWho: el('dlg-who'), dlgText: el('dlg-text'),
    bigmap: el('bigmap'), mapCanvas: el('mapcanvas'),
    title: el('title-screen'), pause: el('pause-screen'), end: el('end-screen'),
    endTitle: el('end-title'), endSub: el('end-sub'),
    damageFlash: el('damage-flash'),
    btnNew: el('btn-new'), btnContinue: el('btn-continue'),
    btnResume: el('btn-resume'), btnSave: el('btn-save'), btnRestart: el('btn-restart'),
    pauseStats: el('pause-stats')
  };
  var toastT = 0;
  var mapCtx = ui.minimap.getContext('2d');
  var bigCtx = ui.mapCanvas.getContext('2d');
  var lastMinimapAt = 0;

  V.toast = function (text, seconds) {
    ui.toastBox.textContent = text;
    ui.toastBox.classList.remove('hidden');
    toastT = seconds || 3.4;
  };

  // Dialogue rendering: story.js owns the queue, we own the box.
  V.onDialogue = function (d) {
    if (!d) { ui.dialogue.classList.add('hidden'); return; }
    var line = d.lines[d.idx];
    ui.dlgWho.textContent = line.who;
    ui.dlgText.textContent = line.text;
    ui.dialogue.classList.remove('hidden');
  };

  function fmtClock(minutes) {
    var h = Math.floor(minutes / 60) % 24;
    var m = Math.floor(minutes % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function drawMinimap(state, now) {
    if (now - lastMinimapAt < 90) return;
    lastMinimapAt = now;
    var S = 184, C = S / 2, RANGE = 105; // metres shown across the disc
    var scale = S / (RANGE * 2);
    var px = state.px, pz = state.pz;
    mapCtx.clearRect(0, 0, S, S);
    mapCtx.fillStyle = '#11141d';
    mapCtx.fillRect(0, 0, S, S);
    function mx(x) { return C + (x - px) * scale; }
    function mz(z) { return C + (z - pz) * scale; }
    // harbour water
    mapCtx.fillStyle = '#10324e';
    mapCtx.fillRect(0, mz(264), S, S);
    // roads
    mapCtx.strokeStyle = '#2c3140';
    mapCtx.lineWidth = 24 * scale + 2;
    state.city.roadLines.forEach(function (r) {
      mapCtx.beginPath(); mapCtx.moveTo(mx(r), 0); mapCtx.lineTo(mx(r), S); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, mz(r)); mapCtx.lineTo(S, mz(r)); mapCtx.stroke();
    });
    mapCtx.strokeStyle = '#484f63';
    mapCtx.lineWidth = 1;
    state.city.roadLines.forEach(function (r) {
      mapCtx.beginPath(); mapCtx.moveTo(mx(r), 0); mapCtx.lineTo(mx(r), S); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, mz(r)); mapCtx.lineTo(S, mz(r)); mapCtx.stroke();
    });
    function blip(x, z, colour, r) {
      var bx = mx(x), bz = mz(z);
      if (bx < -6 || bx > S + 6 || bz < -6 || bz > S + 6) return;
      mapCtx.fillStyle = colour;
      mapCtx.beginPath(); mapCtx.arc(bx, bz, r || 3, 0, 6.3); mapCtx.fill();
    }
    var i;
    for (i = 0; i < V.peds.length; i++) blip(V.peds[i].x, V.peds[i].z, 'rgba(200,205,215,0.5)', 1.6);
    for (i = 0; i < V.thugs.length; i++) if (!V.thugs[i].dead) blip(V.thugs[i].x, V.thugs[i].z, '#ff5f6e', 2.6);
    // police flash blue/red
    var flashBlue = (now % 600) < 300;
    for (i = 0; i < V.cruisers.length; i++) {
      blip(V.cruisers[i].x, V.cruisers[i].z, flashBlue ? '#4d8dff' : '#ff4d5e', 3.4);
    }
    for (i = 0; i < V.officers.length; i++) blip(V.officers[i].x, V.officers[i].z, '#4d8dff', 2.4);
    blip(state.city.odileBooth.x, state.city.odileBooth.z, '#ff5fc8', 3.4);
    if (V.objective.visible) blip(V.objective.x, V.objective.z, '#ffd34d', 4);
    // player arrow, pointing where Jax faces
    mapCtx.save();
    mapCtx.translate(C, C);
    mapCtx.rotate(-state.ry + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(0, 3); mapCtx.lineTo(-5, 6);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  function drawBigMap(state) {
    var S = 620, W = 640; // world -320..320
    var sc = S / W;
    function mx(x) { return (x + 320) * sc; }
    function mz(z) { return (z + 320) * sc; }
    bigCtx.fillStyle = '#0d1017';
    bigCtx.fillRect(0, 0, S, S);
    bigCtx.fillStyle = '#10324e';
    bigCtx.fillRect(0, mz(264), S, S - mz(264));
    bigCtx.strokeStyle = '#39415a';
    bigCtx.lineWidth = 15;
    state.city.roadLines.forEach(function (r) {
      bigCtx.beginPath(); bigCtx.moveTo(mx(r), 0); bigCtx.lineTo(mx(r), S); bigCtx.stroke();
      bigCtx.beginPath(); bigCtx.moveTo(0, mz(r)); bigCtx.lineTo(S, mz(r)); bigCtx.stroke();
    });
    bigCtx.fillStyle = 'rgba(232,236,244,0.55)';
    bigCtx.font = 'bold 15px Arial';
    bigCtx.textAlign = 'center';
    bigCtx.fillText('NEON MILE', mx(-192), mz(-60));
    bigCtx.fillText('OLD MARKET', mx(-48), mz(6));
    bigCtx.fillText('THE HEIGHTS', mx(144), mz(-150));
    bigCtx.fillText('HARBOR', mx(-48), mz(200));
    bigCtx.fillText('DOCKYARDS', mx(150), mz(150));
    bigCtx.font = '11px Arial';
    bigCtx.fillStyle = '#5ff2c8';
    bigCtx.fillText('ST. MIRELLA HOSPITAL', mx(150), mz(-138));
    bigCtx.fillText('DOCK NINE', mx(96), mz(292));
    function dot(x, z, colour, r) {
      bigCtx.fillStyle = colour;
      bigCtx.beginPath(); bigCtx.arc(mx(x), mz(z), r, 0, 6.3); bigCtx.fill();
    }
    dot(state.city.odileBooth.x, state.city.odileBooth.z, '#ff5fc8', 5);
    for (var i = 0; i < V.cruisers.length; i++) dot(V.cruisers[i].x, V.cruisers[i].z, '#4d8dff', 4);
    if (V.objective.visible) dot(V.objective.x, V.objective.z, '#ffd34d', 6);
    // player triangle
    bigCtx.save();
    bigCtx.translate(mx(state.px), mz(state.pz));
    bigCtx.rotate(-state.ry + Math.PI);
    bigCtx.fillStyle = '#ffffff';
    bigCtx.beginPath();
    bigCtx.moveTo(0, -9); bigCtx.lineTo(6, 8); bigCtx.lineTo(0, 4); bigCtx.lineTo(-6, 8);
    bigCtx.closePath(); bigCtx.fill();
    bigCtx.restore();
  }

  // One call per frame from play.js with the whole HUD state.
  function update(state, now) {
    ui.cash.textContent = '$' + state.cash.toLocaleString('en-US');
    ui.rep.textContent = 'REP ' + state.rep + ' · ';
    ui.rank.textContent = state.rank;
    ui.clock.textContent = fmtClock(state.clockMinutes);
    ui.healthFill.style.width = Math.max(0, state.health) + '%';
    if (state.busted > 0.01) {
      ui.bustedWrap.classList.remove('hidden');
      ui.bustedFill.style.width = (state.busted * 100).toFixed(0) + '%';
    } else ui.bustedWrap.classList.add('hidden');
    var starsHtml = '';
    for (var i = 0; i < 5; i++) {
      starsHtml += '<span class="' + (i < state.stars ? 'on' : 'off') + '">★</span>';
    }
    if (ui.stars.innerHTML !== starsHtml) ui.stars.innerHTML = starsHtml;
    ui.stars.style.visibility = state.stars > 0 ? 'visible' : 'hidden';
    if (V.objective.visible) {
      ui.objective.classList.remove('hidden');
      ui.objLabel.textContent = V.objective.label;
      ui.objDist.textContent = V.objective.dist > 1 ? Math.round(V.objective.dist) + ' m' : '';
      ui.objTimer.textContent = (V.objective.timer !== null && V.objective.timer !== undefined)
        ? fmtTime(V.objective.timer) : '';
    } else ui.objective.classList.add('hidden');
    if (state.inCar) {
      ui.carBox.classList.remove('hidden');
      ui.speed.textContent = Math.round(Math.abs(state.carSpeed) * 3.6);
      ui.carName.textContent = state.carName;
      ui.carHealth.style.width = Math.max(0, state.carHealth) + '%';
      ui.carHealth.style.background = state.carHealth < 30 ? '#ff5f6e' : '#7fb8ff';
      ui.ammo.classList.add('hidden');
    } else {
      ui.carBox.classList.add('hidden');
      ui.ammo.classList.remove('hidden');
      ui.ammoMag.textContent = state.ammo;
      ui.ammoRes.textContent = state.reserve;
      ui.ammoMag.className = state.reloading ? 'reloading' : '';
    }
    ui.crosshair.classList.toggle('hidden', !(state.playing && !state.inCar));
    if (toastT > 0) {
      toastT -= state.dt;
      if (toastT <= 0) ui.toastBox.classList.add('hidden');
    }
    if (state.mapOpen) drawBigMap(state);
    else drawMinimap(state, now);
  }

  function showEnd(kind, sub) {
    ui.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    ui.endTitle.className = kind === 'busted' ? 'busted' : '';
    ui.endSub.textContent = sub;
    ui.end.classList.remove('hidden');
  }
  function hideEnd() { ui.end.classList.add('hidden'); }

  function flashDamage() {
    ui.damageFlash.style.transition = 'none';
    ui.damageFlash.style.opacity = '1';
    requestAnimationFrame(function () {
      ui.damageFlash.style.transition = 'opacity 0.5s';
      ui.damageFlash.style.opacity = '0';
    });
  }

  V.ui = {
    el: ui,
    update: update,
    showEnd: showEnd,
    hideEnd: hideEnd,
    flashDamage: flashDamage,
    fmtTime: fmtTime
  };
})();
