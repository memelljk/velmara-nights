// interface.js - every 2D surface of Velmara Nights: the HUD (cash, rep
// rank, clock, health, wanted stars, speed, ammo, objective banner with
// distance and countdown), the live circular minimap, the full city map,
// dialogue boxes, toasts, and the title / pause / busted / wasted screens.
window.VN = window.VN || {};

VN.REP_RANKS = [
  [0, 'NOBODY'], [40, 'RUNNER'], [100, 'WHEELMAN'], [190, 'SMUGGLER'],
  [300, 'FIXER FRIEND'], [450, 'VELMARA LEGEND'],
];
VN.repRank = function (rep) {
  let name = 'NOBODY';
  for (const [need, label] of VN.REP_RANKS) if (rep >= need) name = label;
  return name;
};

VN.UI = class UI {
  constructor(G) {
    this.G = G;
    this.el = {};
    const ids = ['hud', 'cash', 'rep', 'clock', 'healthFill', 'stars', 'speedo', 'ammo',
      'objective', 'objTitle', 'objText', 'objMeta', 'dialogue', 'dlgName', 'dlgText',
      'toast', 'title', 'pauseMenu', 'endCard', 'endTitle', 'endText', 'bustedFill',
      'bustedWrap', 'mapWrap', 'interact', 'minimap', 'bigmap', 'continueBtn', 'saveNote'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mm = this.el.minimap.getContext('2d');
    this.bm = this.el.bigmap.getContext('2d');
    this.objective = null;
    this.toastT = 0;
    this.mapOpen = false;
  }

  setObjective(title, text) { this.objective = { title, text }; this.el.objective.style.display = 'block'; }
  clearObjective() { this.objective = null; this.el.objective.style.display = 'none'; }

  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    this.toastT = 3.4;
  }

  showDialogue(name, text) {
    this.el.dialogue.style.display = 'block';
    this.el.dlgName.textContent = name;
    this.el.dlgText.textContent = text;
  }
  hideDialogue() { this.el.dialogue.style.display = 'none'; }

  showTitle(canContinue) {
    this.el.title.style.display = 'flex';
    this.el.continueBtn.style.display = canContinue ? 'block' : 'none';
    this.el.hud.style.display = 'none';
  }
  hideTitle() { this.el.title.style.display = 'none'; this.el.hud.style.display = 'block'; }
  showPause(on) { this.el.pauseMenu.style.display = on ? 'flex' : 'none'; }
  showEnd(title, text) {
    this.el.endTitle.textContent = title;
    this.el.endText.textContent = text;
    this.el.endCard.style.display = 'flex';
  }
  hideEnd() { this.el.endCard.style.display = 'none'; }

  fmtClock() {
    const mins = Math.floor(this.G.clockMinutes) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return hh + ':' + mm;
  }

  update(dt) {
    const G = this.G;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.style.opacity = '0'; }
    this.el.cash.textContent = '$' + G.cash.toLocaleString('en-US');
    this.el.rep.textContent = VN.repRank(G.rep) + ' - REP ' + G.rep;
    this.el.clock.textContent = this.fmtClock();
    this.el.healthFill.style.width = VN.clamp(G.health, 0, 100) + '%';
    this.el.healthFill.style.background = G.health > 30 ? '#53d769' : '#ff453a';
    const stars = G.law ? G.law.stars : 0;
    this.el.stars.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
    this.el.stars.style.color = stars ? '#ffd60a' : '#3a4152';
    if (G.mode === 'car' && G.playerCar) {
      this.el.speedo.style.display = 'block';
      this.el.speedo.textContent = Math.round(Math.abs(G.playerCar.speed) * 3.2) + ' km/h';
    } else this.el.speedo.style.display = 'none';
    if (G.mode === 'foot') {
      this.el.ammo.style.display = 'block';
      this.el.ammo.textContent = G.combat.reloading > 0 ? 'RELOADING' : 'PISTOL ' + G.combat.ammo + ' / ' + G.combat.reserve;
    } else this.el.ammo.style.display = 'none';

    // Objective banner: label + live distance / countdown.
    if (this.objective && G.story) {
      this.el.objTitle.textContent = this.objective.title;
      let text = this.objective.text;
      const leg = G.story.currentLeg();
      if (G.story.active && leg) {
        if (leg.kind === 'fight') text += ' - ' + (G.story.active.aliveCount != null ? G.story.active.aliveCount : leg.count) + ' standing';
        if (leg.kind === 'hold') text += ' - ' + Math.ceil(G.story.active.holdT) + 's';
      }
      this.el.objText.textContent = text;
      const pt = G.story.objectivePoint();
      let meta = '';
      if (pt) meta = Math.round(VN.dist2d(G.focusX(), G.focusZ(), pt.x, pt.z)) + ' m';
      if (G.story.active && leg && leg.kind === 'timed') meta += ' - ' + Math.ceil(G.story.active.timer) + 's';
      if (G.story.sideJob && G.story.sideJob.kind === 'courier') meta += ' - ' + Math.ceil(G.story.sideJob.timer) + 's';
      this.el.objMeta.textContent = meta;
    }

    // BUSTED meter.
    const bm = G.law ? G.law.bustedMeter : 0;
    this.el.bustedWrap.style.display = bm > 0.02 ? 'block' : 'none';
    this.el.bustedFill.style.width = Math.round(bm * 100) + '%';

    // Interact prompt.
    const hint = G.interactHint();
    if (hint) { this.el.interact.style.display = 'block'; this.el.interact.textContent = hint; }
    else this.el.interact.style.display = 'none';

    this.drawMinimap();
    if (this.mapOpen) this.drawBigMap();
  }

  worldToMap(x, z, size, range, cx, cz) {
    const s = size / (range * 2);
    return [size / 2 + (x - cx) * s, size / 2 + (z - cz) * s];
  }

  drawRoads(g, size, range, cx, cz) {
    g.strokeStyle = 'rgba(140,160,190,0.55)';
    g.lineWidth = Math.max(2, size / range * 4);
    for (const z of VN.CITY.H_ROADS) {
      const a = this.worldToMap(-320, z, size, range, cx, cz), b = this.worldToMap(320, z, size, range, cx, cz);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    for (const x of VN.CITY.V_ROADS) {
      const a = this.worldToMap(x, -280, size, range, cx, cz), b = this.worldToMap(x, 235, size, range, cx, cz);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  }

  drawMinimap() {
    const G = this.G;
    const g = this.mm, size = 168, range = 95;
    const cx = G.focusX(), cz = G.focusZ();
    g.clearRect(0, 0, size, size);
    g.fillStyle = 'rgba(10,14,22,0.82)';
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.clip();
    this.drawRoads(g, size, range, cx, cz);
    const dot = (x, z, color, r) => {
      const p = this.worldToMap(x, z, size, range, cx, cz);
      if (p[0] < -4 || p[1] < -4 || p[0] > size + 4 || p[1] > size + 4) return;
      g.fillStyle = color;
      g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
    };
    for (const c of G.cars) if (c.driver === 'ai') dot(c.x, c.z, '#8a93a5', 2);
    if (G.law) for (const c of G.law.cruisers) dot(c.x, c.z, '#ff3b30', 3.2);
    const pt = G.story ? G.story.objectivePoint() : null;
    if (pt) dot(pt.x, pt.z, '#ffd60a', 4);
    dot(G.city.odileBooth.x, G.city.odileBooth.z, '#ff5fd2', 3);
    // Player arrow.
    g.translate(size / 2, size / 2);
    g.rotate(-(G.mode === 'car' && G.playerCar ? G.playerCar.heading : G.player.heading));
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,95,210,0.7)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.stroke();
  }

  drawBigMap() {
    const G = this.G;
    const g = this.bm, size = 560;
    g.clearRect(0, 0, size, size);
    g.fillStyle = 'rgba(8,11,18,0.95)';
    g.fillRect(0, 0, size, size);
    this.drawRoads(g, size, 340, 0, -20);
    const dot = (x, z, color, r, label) => {
      const p = this.worldToMap(x, z, size, 340, 0, -20);
      g.fillStyle = color;
      g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
      if (label) { g.fillStyle = '#dfe6f2'; g.font = '11px Arial'; g.fillText(label, p[0] + 7, p[1] + 3); }
    };
    dot(G.city.odileBooth.x, G.city.odileBooth.z, '#ff5fd2', 4, 'Odile - Neon Mile');
    dot(G.city.hospital.x, G.city.hospital.z, '#ff5a5a', 4, 'St. Mirella');
    dot(G.city.marketPickup.x, G.city.marketPickup.z, '#ffd60a', 4, 'Old Market');
    dot(G.city.dockNine.x, G.city.dockNine.z, '#7ab8ff', 4, 'Dock Nine');
    dot(150, 205, '#9fd8ff', 4, 'Harbor Vault');
    dot(150, -120, '#c09fff', 4, 'The Heights');
    if (G.law) for (const c of G.law.cruisers) dot(c.x, c.z, '#ff3b30', 3);
    const pt = G.story ? G.story.objectivePoint() : null;
    if (pt) dot(pt.x, pt.z, '#ffd60a', 6, 'Objective');
    dot(G.focusX(), G.focusZ(), '#ffffff', 5, 'You');
    g.fillStyle = '#8a93a5';
    g.font = '12px Arial';
    g.fillText('VELMARA - P closes the map', 14, size - 12);
  }
};
