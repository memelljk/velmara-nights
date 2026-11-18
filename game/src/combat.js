// combat.js — pistol (aim, tracers, reload), melee, thugs who shoot back
window.VN = window.VN || {};
VN.combat = {
  ammo: 12, reserve: 48, reloading: 0, tracers: [], thugs: [],
  spawnThugs: function (scene, spots) {
    var self = this;
    spots.forEach(function (s) {
      var t = VN.makePerson(s[0], s[1], 0x5a1f1f, 0x201a16, 0x8a5f43);
      t.thug = true; t.health = 40; scene.add(t.mesh); self.thugs.push(t);
    });
  },
  shoot: function (scene, from, dir, targets, onCrime) {
    if (this.reloading > 0) return false;
    if (this.ammo <= 0) { this.startReload(); return false; }
    this.ammo--; VN.sound.shot(); onCrime && onCrime();
    var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, 1.45, from.z), new THREE.Vector3(from.x + dir.x * 60, 1.35, from.z + dir.z * 60)]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe28a }));
    scene.add(line); this.tracers.push({ line: line, t: 0.07 });
    var best = null, bestScore = 0.96;
    targets.forEach(function (t) {
      if (t.health <= 0) return;
      var dx = t.x - from.x, dz = t.z - from.z, dist = Math.hypot(dx, dz);
      if (dist > 62) return;
      var dot = (dx * dir.x + dz * dir.z) / (dist || 1);
      if (dot > bestScore) { bestScore = dot; best = t; }
    });
    if (best) { best.health -= 34; if (best.health <= 0 && best.thug) VN.game.addCash(140, 'Dock crew bounty'); }
    if (this.ammo === 0) this.startReload();
    return true;
  },
  startReload: function () { if (this.reserve > 0 && this.reloading <= 0) this.reloading = 1.1; },
  melee: function (from, targets) {
    targets.forEach(function (t) { if (Math.hypot(t.x - from.x, t.z - from.z) < 2.4) t.health -= 30; });
  },
  update: function (dt, scene, hero, onHeroHit) {
    if (this.reloading > 0) { this.reloading -= dt; if (this.reloading <= 0) { var take = Math.min(12 - this.ammo, this.reserve); this.ammo += take; this.reserve -= take; } }
    this.tracers = this.tracers.filter(function (tr) { tr.t -= dt; if (tr.t <= 0) { scene.remove(tr.line); return false; } return true; });
    this.thugs.forEach(function (t) {
      if (t.health <= 0) { t.mesh.rotation.x = Math.PI / 2; t.mesh.position.y = 0.2; return; }
      var dx = hero.x - t.x, dz = hero.z - t.z, dist = Math.hypot(dx, dz);
      t.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist < 30 && dist > 7) { t.x += (dx / dist) * 2.6 * dt; t.z += (dz / dist) * 2.6 * dt; t.mesh.position.set(t.x, 0, t.z); }
      if (dist < 30 && Math.random() < dt * 0.55) { VN.sound.shot(); if (Math.random() < 0.4) onHeroHit(6); }
    });
  }
};
