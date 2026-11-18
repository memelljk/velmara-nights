// combat.js - pistol work in Velmara: mouse-aimed shots with tracers,
// reloads, a shove melee, thugs and officers who return fire, and the noise
// that brings the law and scatters the crowds.
window.VN = window.VN || {};

VN.Combat = class Combat {
  constructor(G) {
    this.G = G;
    this.ammo = 12;
    this.reserve = 48;
    this.reloading = 0;
    this.cooldown = 0;
    this.tracers = [];
    this.muzzle = 0;
  }

  get magSize() { return 12; }

  reload() {
    if (this.reloading > 0 || this.ammo >= this.magSize || this.reserve <= 0) return;
    this.reloading = 1.15;
    if (VN.SFX) VN.SFX.reload();
  }

  // Fire from the hero toward the camera aim point (a world position).
  shoot(aimX, aimY, aimZ) {
    const G = this.G;
    if (this.cooldown > 0 || this.reloading > 0) return;
    if (this.ammo <= 0) { this.reload(); return; }
    this.ammo--;
    this.cooldown = 0.22;
    this.muzzle = 0.05;
    if (VN.SFX) VN.SFX.shot();
    const ox = G.player.x, oy = 1.55, oz = G.player.z;
    let dx = aimX - ox, dy = aimY - oy, dz = aimZ - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    // Find the closest ped / officer / car along the ray within 70 m.
    let bestT = 70, bestEnt = null, bestKind = null;
    const testSphere = (ex, ey, ez, r, ent, kind) => {
      const rx = ex - ox, ry = ey - oy, rz = ez - oz;
      const t = rx * dx + ry * dy + rz * dz;
      if (t < 0 || t > bestT) return;
      const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
      if (Math.hypot(ex - px, ey - py, ez - pz) < r) { bestT = t; bestEnt = ent; bestKind = kind; }
    };
    for (const p of G.peds) { if (!p.dead) testSphere(p.x, 1.1, p.z, 0.85, p, 'ped'); }
    for (const c of G.cars) { if (c !== G.playerCar) testSphere(c.x, 0.9, c.z, 1.9, c, 'car'); }
    const ex = ox + dx * bestT, ey = oy + dy * bestT, ez = oz + dz * bestT;
    this.spawnTracer(ox, oy, oz, ex, ey, ez, 0xffd9a0);
    if (bestEnt) {
      if (bestKind === 'ped') {
        bestEnt.hurt(34, G);
        G.law.reportCrime(bestEnt.isOfficer ? 'assault' : 'assault', G.player.x, G.player.z, bestEnt.isOfficer ? 1.6 : 1);
      } else if (bestKind === 'car') {
        bestEnt.damage(9);
        G.law.reportCrime('shot', G.player.x, G.player.z, 0.7);
      }
    } else {
      G.law.reportCrime('shot', G.player.x, G.player.z, 0.55);
    }
    // Noise scatters everyone nearby.
    for (const p of G.peds) if (!p.dead && !p.isThug && !p.isOfficer) p.scare(ox, oz, G.time);
    G.panicAt = G.time; G.panicX = ox; G.panicZ = oz;
    if (this.ammo === 0) this.reload();
  }

  melee() {
    const G = this.G;
    if (this.cooldown > 0) return;
    this.cooldown = 0.45;
    if (VN.SFX) VN.SFX.swing();
    for (const p of G.peds) {
      if (p.dead) continue;
      if (VN.dist2d(p.x, p.z, G.player.x, G.player.z) < 2.1) {
        p.hurt(18, G);
        G.law.reportCrime('assault', G.player.x, G.player.z, 0.6);
      }
    }
  }

  enemyShoot(shooter, dist) {
    const G = this.G;
    if (VN.SFX) VN.SFX.shot(true);
    const tx = G.mode === 'car' && G.playerCar ? G.playerCar.x : G.player.x;
    const tz = G.mode === 'car' && G.playerCar ? G.playerCar.z : G.player.z;
    this.spawnTracer(shooter.x, 1.5, shooter.z, tx, 1.1, tz, 0xff8a7a);
    const hitChance = VN.clamp(0.55 - dist * 0.011, 0.12, 0.5);
    if (Math.random() < hitChance) {
      if (G.mode === 'car' && G.playerCar) { G.playerCar.damage(4); G.hurtPlayer(3); }
      else G.hurtPlayer(9);
    }
  }

  spawnTracer(x1, y1, z1, x2, y2, z2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.G.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const take = Math.min(this.magSize - this.ammo, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.G.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
};
