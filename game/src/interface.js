// interface.js — every pixel of DOM over the 3D view: HUD (cash, rep rank,
// clock, health, wanted stars, speed, ammo), the objective banner, LIVE
// circular minimap, the full city map on P, title / pause / dialogue /
// WASTED / BUSTED screens and toast messages.
window.VN = window.VN || {};

VN.ui = (function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  var els = {};
  var toastTimer = 0, bannerTimer = 0, damageTimer = 0;
  var mapStatic = null; // offscreen canvas with roads/buildings, drawn once

  function init(state) {
    ['hud', 'cash', 'rep', 'clock', 'healthbar', 'stars', 'speed', 'ammo', 'vehicle',
     'objective', 'objlabel', 'objdist', 'minimap', 'bigmap', 'title', 'pause',
     'dialogue', 'dlgname', 'dlgtext', 'toast', 'banner', 'wasted', 'busted',
     'bustedbar', 'vignette', 'crosshair', 'prompt', 'muted'].forEach(function (id) { els[id] = el(id); });
    buildStaticMap(state);
  }

  function buildStaticMap(state) {
    mapStatic = document.createElement('canvas');
    mapStatic.width = 440; mapStatic.height = 440;
    var g = mapStatic.getContext('2d');
    g.fillStyle = '#101322'; g.fillRect(0, 0, 440, 440);
    g.strokeStyle = '#2c3350'; g.lineWidth = 5;
    for (var i = -4; i <= 4; i++) {
      var p = 220 + i * 48 * 0.92;
      g.beginPath(); g.moveTo(p, 8); g.lineTo(p, 432); g.stroke();
      g.beginPath(); g.moveTo(8, p); g.lineTo(432, p); g.stroke();
    }
    g.fillStyle = '#0b2f4a'; g.fillRect(0, 388, 440, 52); // harbor water
    g.fillStyle = '#39406b';
    state.city.colliders.forEach(function (c) {
      var x = 220 + c.x0 * 0.92, y = 220 + c.z0 * 0.92;
      g.fillRect(x, y, Math.max(2, (c.x1 - c.x0) * 0.92), Math.max(2, (c.z1 - c.z0) * 0.92));
    });
  }
  function w2m(x, z) { return [220 + x * 0.92, 220 + z * 0.92]; }

  function drawBlips(g, state, scale, cx, cy, range) {
    function plot(x, z, color, r) {
      var dx = (x - state.player.x) * scale, dz = (z - state.player.z) * scale;
      if (range && dx * dx + dz * dz > range * range) return;
      g.fillStyle = color;
      g.beginPath(); g.arc(cx + dx, cy + dz, r, 0, 7); g.fill();
    }
    var obj = VN.story.currentObjective(state);
    if (obj.stage && obj.stage.at) {
      var t = state.story.locs[obj.stage.at];
      plot(t.x, t.z, '#ffd740', 4);
    }
    if (obj.stage && obj.stage.kind === 'steal') {
      for (var i = 0; i < state.parked.length; i++) if (state.parked[i].special === 'orphee') plot(state.parked[i].x, state.parked[i].z, '#3b2bd8', 4);
    }
    state.law.cruisers.forEach(function (c) { plot(c.x, c.z, '#4da3ff', 3); });
    state.peds.forEach(function (p) { if (!p.dead) plot(p.x, p.z, '#9aa2ae', 1.6); });
    state.traffic.forEach(function (c) { if (!c.dead) plot(c.x, c.z, '#c8ccd4', 1.8); });
    state.thugs.forEach(function (t2) { if (!t2.dead) plot(t2.x, t2.z, '#ff5252', 3); });
  }

  function drawMinimap(state) {
    var cv = els.minimap;
    if (!cv) return;
    var g = cv.getContext('2d');
    var S = cv.width, C = S / 2, scale = 0.62, range = C - 4;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, 7); g.clip();
    g.fillStyle = '#101322'; g.fillRect(0, 0, S, S);
    var px = 220 + state.player.x * 0.92, py = 220 + state.player.z * 0.92;
    g.restore();
    // precise blit: static map recentred on the player
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, 7); g.clip();
    var srcSize = (S / scale) * 0.92;
    g.drawImage(mapStatic, px - srcSize / 2, py - srcSize / 2, srcSize, srcSize, 0, 0, S, S);
    drawBlips(g, state, scale, C, C, range);
    // player arrow
    g.translate(C, C); g.rotate(state.mode === 'drive' && state.player.car ? -state.player.car.ry + Math.PI : -state.player.ry + Math.PI);
    g.fillStyle = '#ff2e88';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,46,136,0.65)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 2, 0, 7); g.stroke();
  }

  function drawBigMap(state) {
    var cv = els.bigmap;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(mapStatic, 0, 0, cv.width, cv.height);
    var s = cv.width / 440;
    function plot(x, z, color, r) {
      var p = w2m(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(p[0] * s, p[1] * s, r, 0, 7); g.fill();
    }
    var obj = VN.story.currentObjective(state);
    if (obj.stage && obj.stage.at) { var t = state.story.locs[obj.stage.at]; plot(t.x, t.z, '#ffd740', 6); }
    state.law.cruisers.forEach(function (c) { plot(c.x, c.z, '#4da3ff', 4); });
    plot(state.player.x, state.player.z, '#ff2e88', 6);
    g.fillStyle = '#e8ecf4'; g.font = 'bold 15px Arial';
    g.fillText('VELMARA — P to close', 14, 24);
    g.font = '12px Arial'; g.fillStyle = '#9fe8ff';
    g.fillText('NEON MILE', 150, 190); g.fillText('OLD MARKET', 120, 300);
    g.fillText('THE HEIGHTS', 30, 90); g.fillText('DOCKYARDS', 330, 260); g.fillText('HARBOR', 190, 420);
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function update(state, dt) {
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) els.toast.classList.remove('show'); }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) els.banner.classList.remove('show'); }
    if (damageTimer > 0) { damageTimer -= dt; els.vignette.style.opacity = Math.max(0, damageTimer * 1.6); }
    if (state.mode === 'title' || state.mode === 'wasted' || state.mode === 'busted') return;

    var p = state.player;
    els.cash.textContent = '$' + p.cash.toLocaleString('en-US');
    els.rep.textContent = VN.story.rankFor(p.rep) + ' · ' + p.rep + ' REP';
    var clockSec = (22 * 3600 + state.timeOfDay) % 86400;
    els.clock.textContent = fmtTime(clockSec);
    els.healthbar.style.width = Math.max(0, p.health) + '%';
    els.healthbar.style.background = p.health > 35 ? '#69f0ae' : '#ff5252';
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < state.law.wanted ? '★' : '☆';
    els.stars.textContent = stars;
    els.stars.style.opacity = state.law.wanted ? 1 : 0.25;
    if (state.mode === 'drive' && p.car) {
      els.speed.textContent = Math.round(Math.abs(p.car.speed) * 3.6) + ' km/h';
      els.vehicle.textContent = p.car.def.name + (p.car.health < 55 ? ' · SMOKING' : '');
    } else {
      els.speed.textContent = '';
      els.vehicle.textContent = '';
    }
    els.ammo.textContent = state.mode === 'foot' && p.aiming ? 'PISTOL ' + state.combat.ammo + ' / ' + state.combat.reserve + (state.combat.reloading > 0 ? ' · RELOADING' : '') : '';
    els.crosshair.style.display = state.mode === 'foot' && p.aiming ? 'block' : 'none';

    var obj = VN.story.currentObjective(state);
    els.objlabel.textContent = obj.label || '';
    var distTxt = '';
    if (obj.stage && obj.stage.at) {
      var t = state.story.locs[obj.stage.at];
      var d = Math.sqrt((p.x - t.x) * (p.x - t.x) + (p.z - t.z) * (p.z - t.z));
      distTxt = Math.round(d) + ' m';
    } else if (obj.stage && obj.stage.kind === 'steal') {
      distTxt = 'find it behind the Rialto';
    } else if (obj.stage && obj.stage.kind === 'escape') {
      distTxt = state.law.wanted > 0 ? 'heat ' + Math.round(state.law.heat) + '%' : '';
    }
    if (obj.stage && (obj.stage.time || obj.stage.kind === 'hold')) {
      distTxt += (distTxt ? ' · ' : '') + fmtTime(Math.max(0, state.story.timer));
    }
    if (state.story.side) distTxt += (distTxt ? ' · ' : '') + fmtTime(Math.max(0, state.story.timer));
    els.objdist.textContent = distTxt;

    drawMinimap(state);
    if (state.showMap) drawBigMap(state);

    if (state.mode === 'busted') {
      els.bustedbar.style.width = Math.round(state.law.bustedMeter * 100) + '%';
    }
  }

  function toast(state, msg) { els.toast.textContent = msg; els.toast.classList.add('show'); toastTimer = 3.4; }
  function banner(state, msg) { els.banner.textContent = msg; els.banner.classList.add('show'); bannerTimer = 3.2; }
  function flashDamage(state) { damageTimer = 0.55; els.vignette.style.opacity = 0.85; }
  function setPrompt(msg) {
    if (!els.prompt) return;
    els.prompt.textContent = msg || '';
    els.prompt.style.display = msg ? 'block' : 'none';
  }

  // Dialogue: queue of [name, line]; callback when finished.
  var dlgQueue = [], dlgCb = null;
  function dialogue(state, lines, cb) {
    dlgQueue = lines.slice();
    dlgCb = cb || null;
    state.prevMode = state.mode;
    state.mode = 'dialogue';
    els.dialogue.classList.add('show');
    nextLine(state);
  }
  function nextLine(state) {
    if (!dlgQueue.length) {
      els.dialogue.classList.remove('show');
      state.mode = state.prevMode === 'dialogue' ? 'foot' : (state.prevMode || 'foot');
      if (state.mode === 'title') state.mode = 'foot';
      var cb = dlgCb; dlgCb = null;
      if (cb) cb();
      return;
    }
    var line = dlgQueue.shift();
    els.dlgname.textContent = line[0];
    els.dlgtext.textContent = line[1];
  }
  function dialogueOpen() { return els.dialogue && els.dialogue.classList.contains('show'); }

  function showWasted(state) {
    els.wasted.classList.add('show');
    if (VN.sound) VN.sound.thud();
  }
  function hideWasted() { els.wasted.classList.remove('show'); }
  function showBusted(state) {
    els.busted.classList.add('show');
  }
  function hideBusted() { els.busted.classList.remove('show'); }

  return {
    init: init, update: update, toast: toast, banner: banner,
    flashDamage: flashDamage, setPrompt: setPrompt,
    dialogue: dialogue, nextLine: nextLine, dialogueOpen: dialogueOpen,
    showWasted: showWasted, hideWasted: hideWasted,
    showBusted: showBusted, hideBusted: hideBusted,
    drawBigMap: drawBigMap, els: function () { return els; }
  };
})();
