// interface.js — HUD, live circular minimap, full city map (P), dialogue, banners
window.VN = window.VN || {};
VN.ui = {
  el: {}, dlgQueue: null, dlgCb: null, mapOpen: false, bannerT: 0,
  init: function () {
    var ids = ['cash', 'rep', 'clock', 'healthfill', 'stars', 'speed', 'ammo', 'objective', 'banner', 'dialogue', 'dlg-name', 'dlg-text', 'dist', 'bustedwrap', 'bustedfill', 'minimap', 'fullmap', 'district', 'muted'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
  },
  showBanner: function (text) { if (this.el.banner) { this.el.banner.textContent = text; this.el.banner.style.opacity = '1'; this.bannerT = 3.4; } },
  setObjective: function (text) { if (this.el.objective) this.el.objective.textContent = text; },
  dialogue: function (lines, cb) { this.dlgQueue = lines.slice(); this.dlgCb = cb || null; this.nextDialogue(); if (VN.game) VN.game.state = 'dialogue'; },
  nextDialogue: function () {
    if (!this.dlgQueue || !this.dlgQueue.length) {
      this.el.dialogue.style.display = 'none';
      if (VN.game && VN.game.state === 'dialogue') VN.game.state = 'play';
      var cb = this.dlgCb; this.dlgCb = null; cb && cb();
      return;
    }
    var line = this.dlgQueue.shift();
    this.el['dlg-name'].textContent = line[0];
    this.el['dlg-text'].textContent = line[1];
    this.el.dialogue.style.display = 'block';
  },
  updateHUD: function (g) {
    this.el.cash.textContent = '$' + g.cash.toLocaleString('en-US');
    this.el.rep.textContent = g.rank + ' · REP ' + g.rep;
    var mins = Math.floor(g.clockMin % 1440), hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    this.el.clock.textContent = hh + ':' + mm;
    this.el.healthfill.style.width = Math.max(0, g.hero.health) + '%';
    var stars = ''; for (var i = 0; i < 5; i++) stars += i < VN.law.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = VN.law.wanted ? '#ffd24f' : '#667';
    this.el.speed.textContent = g.inCar ? Math.round(Math.abs(g.car.speed) * 3.6) + ' km/h · ' + g.car.model.name : (g.hero.speed ? Math.round(g.hero.speed * 3.6) + ' km/h on foot' : '');
    this.el.ammo.textContent = g.inCar ? '' : 'PISTOL ' + VN.combat.ammo + ' / ' + VN.combat.reserve + (VN.combat.reloading > 0 ? ' · RELOADING' : '');
    this.el.muted.textContent = VN.sound.muted ? 'MUTED (M)' : '';
    if (this.bannerT > 0) { this.bannerT -= 1 / 60; if (this.bannerT <= 0) this.el.banner.style.opacity = '0'; }
    this.el.bustedwrap.style.display = VN.law.bust > 2 ? 'block' : 'none';
    this.el.bustedfill.style.width = VN.law.bust + '%';
    // district label
    var d = 'VELMARA'; var bd = 1e9;
    VN.DISTRICTS.forEach(function (dd) { var dist = Math.hypot(g.pos.x - dd.x, g.pos.z - dd.z); if (dist < bd) { bd = dist; d = dd.name; } });
    this.el.district.textContent = d;
    // objective distance
    var mk = g.marker;
    if (mk) this.el.dist.textContent = Math.round(Math.hypot(g.pos.x - mk.x, g.pos.z - mk.z)) + ' m';
    else this.el.dist.textContent = '';
    var timer = VN.story.timer;
    if (VN.story.active && timer != null) this.el.dist.textContent += (this.el.dist.textContent ? ' · ' : '') + Math.max(0, Math.ceil(timer)) + 's';
  },
  drawMinimap: function (g) {
    var cv = this.el.minimap; if (!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width, C = W / 2, R = C - 4, scale = R / 130;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, R, 0, 6.29); ctx.clip();
    ctx.fillStyle = '#10151c'; ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#3d4a58'; ctx.lineWidth = 5;
    VN.ROADS.forEach(function (r) {
      var off = (r - g.pos[VN.minimapAxis || 'x']) * 0; void off;
      var vx = C + (r - g.pos.x) * scale, hz = C + (r - g.pos.z) * scale;
      ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(W, hz); ctx.stroke();
    });
    ctx.fillStyle = '#2c3644';
    VN.city.buildings.forEach(function (b) {
      var x = C + (b.x - g.pos.x) * scale, y = C + (b.z - g.pos.z) * scale;
      if (x < -6 || y < -6 || x > W + 6 || y > W + 6) return;
      ctx.fillRect(x - 3, y - 3, 6, 6);
    });
    function blip(x, z, color, size) {
      var px = C + (x - g.pos.x) * scale, py = C + (z - g.pos.z) * scale;
      var dx = px - C, dy = py - C, dd = Math.hypot(dx, dy);
      if (dd > R - 6) { px = C + dx / dd * (R - 6); py = C + dy / dd * (R - 6); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, size || 3.4, 0, 6.29); ctx.fill();
    }
    g.traffic.forEach(function (c) { blip(c.x, c.z, '#9fb4c8', 2.2); });
    VN.law.cars.forEach(function (c) { blip(c.x, c.z, (Date.now() % 600 < 300) ? '#ff3355' : '#3377ff', 4); });
    VN.law.officers.forEach(function (o) { blip(o.x, o.z, '#ff3355', 3); });
    blip(10, 96, '#ff4fd8', 4); // Odile
    if (g.marker) blip(g.marker.x, g.marker.z, '#ffe14f', 5);
    // player arrow
    ctx.translate(C, C); ctx.rotate(-(g.heading || 0));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(C, C, R, 0, 6.29); ctx.stroke();
  },
  drawFullMap: function (g) {
    var cv = this.el.fullmap; var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, W, H);
    function mx(x) { return (x + 340) / 680 * W; } function mz(z) { return (z + 340) / 690 * H; }
    ctx.strokeStyle = '#445468'; ctx.lineWidth = 7;
    VN.ROADS.forEach(function (r) { ctx.beginPath(); ctx.moveTo(mx(r), 0); ctx.lineTo(mx(r), H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, mz(r)); ctx.lineTo(W, mz(r)); ctx.stroke(); });
    ctx.fillStyle = '#31405a';
    VN.city.buildings.forEach(function (b) { ctx.fillRect(mx(b.x) - 3, mz(b.z) - 3, 6, 6); });
    ctx.fillStyle = '#3fd8c8'; ctx.fillRect(mx(0), mz(330), W - mx(0), 8);
    ctx.font = 'bold 17px Arial'; ctx.fillStyle = '#e8f2ff';
    VN.DISTRICTS.forEach(function (d) { ctx.fillText(d.name, mx(d.x) - 34, mz(d.z)); });
    ctx.fillStyle = '#ff4fd8'; ctx.beginPath(); ctx.arc(mx(10), mz(96), 6, 0, 6.29); ctx.fill(); ctx.fillText('ODILE', mx(10) + 9, mz(96) + 4);
    if (g.marker) { ctx.fillStyle = '#ffe14f'; ctx.beginPath(); ctx.arc(mx(g.marker.x), mz(g.marker.z), 7, 0, 6.29); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx(g.pos.x), mz(g.pos.z), 6, 0, 6.29); ctx.fill();
    ctx.font = 'bold 22px Arial'; ctx.fillText('VELMARA — CITY MAP (P to close)', 18, 30);
  }
};
