// law.js - Velmara PD. A wanted level from 0 to 5 stars, heat that decays
// when the player breaks line of sight, interceptor cruisers that chase and
// ram, foot officers at four stars and up, and the BUSTED meter that fills
// while an officer is close and the player is slow or on foot.
window.VN = window.VN || {};

VN.Law = class Law {
  constructor(G) {
    this.G = G;
    this.heat = 0;          // 0..500; stars = ceil(heat/100) capped 5
    this.stars = 0;
    this.cruisers = [];
    this.officers = [];
    this.bustedMeter = 0;
    this.lastSeenAt = -99;
    this.lastSeenPos = { x: 0, z: 0 };
    this.spawnT = 0;
    this.sirenPhase = 0;
  }

  reportCrime(kind, x, z, severity) {
    const G = this.G;
    const add = { theft: 60, carjack: 110, assault: 130, shot: 45, murder: 200, vault: 260, race: 30 }[kind] || 50;
    this.heat = Math.min(500, this.heat + add * (severity || 1) * 0.6);
    this.lastSeenAt = G.time;
    this.lastSeenPos = { x, z };
    if (kind === 'shot' || kind === 'assault') { G.panicAt = G.time; G.panicX = x; G.panicZ = z; }
  }

  wantedStars() { return Math.min(5, Math.ceil(this.heat / 100)); }

  spawnCruiser() {
    const G = this.G;
    const px = G.focusX(), pz = G.focusZ();
    const ang = Math.random() * Math.PI * 2;
    const dist = 85 + Math.random() * 30;
    let sx = VN.clamp(px + Math.sin(ang) * dist, -300, 300);
    let sz = VN.clamp(pz + Math.cos(ang) * dist, -260, 215);
    // Snap the spawn onto the nearest road crossing so it can actually drive in.
    const H = VN.CITY.H_ROADS, V = VN.CITY.V_ROADS;
    const nearH = H.reduce((a, b) => Math.abs(b - sz) < Math.abs(a - sz) ? b : a);
    const nearV = V.reduce((a, b) => Math.abs(b - sx) < Math.abs(a - sx) ? b : a);
    if (Math.abs(nearH - sz) < Math.abs(nearV - sx)) sz = nearH + 3.6; else sx = nearV + 3.6;
    const car = new VN.Car({ x: sx, z: sz, heading: Math.atan2(px - sx, pz - sz) + Math.PI, model: 'cruiser', color: 0x232a38 }, { police: true });
    car.driver = 'cop';
    car.setHeadlights(true);
    G.scene.add(car.group); G.scene.add(car.smoke);
    G.cars.push(car);
    this.cruisers.push(car);
    return car;
  }

  spawnOfficer(nearCar) {
    const G = this.G;
    const fig = VN.makeHuman({ skin: 0xa87850, body: 0x24304a, pants: 0x1a2233, hair: 0x101418 });
    fig.setGun(true);
    const off = {
      fig, group: fig.group, x: nearCar.x + 3, z: nearCar.z + 2,
      heading: 0, health: 40, dead: false, shootT: 0, isOfficer: true,
      syncMesh() { this.group.position.set(this.x, 0, this.z); this.group.rotation.y = this.heading; },
      hurt(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.dead) {
          this.dead = true;
          this.group.rotation.x = -Math.PI / 2;
          this.group.position.y = 0.25;
        }
      },
    };
    off.syncMesh();
    G.scene.add(off.group);
    this.officers.push(off);
    G.peds.push(off); // officers share the ped list so combat can hit them
    return off;
  }

  update(dt) {
    const G = this.G;
    this.stars = this.wantedStars();
    const px = G.focusX(), pz = G.focusZ();
    // Officers/cruisers who can see the player refresh the heat clock.
    let seen = false;
    if (this.stars > 0) {
      for (const c of this.cruisers) if (VN.dist2d(c.x, c.z, px, pz) < 70) seen = true;
      for (const o of this.officers) if (!o.dead && VN.dist2d(o.x, o.z, px, pz) < 45) seen = true;
      if (G.mode === 'car' && G.playerCar && Math.abs(G.playerCar.speed) > 4) seen = seen || this.cruisers.length > 0;
    }
    if (seen) { this.lastSeenAt = G.time; this.lastSeenPos = { x: px, z: pz }; }
    if (G.time - this.lastSeenAt > 7 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - dt * 9);
      if (this.heat === 0) this.despawnAll();
    }

    // Maintain cruiser pressure: roughly one cruiser per star, max 5.
    this.spawnT -= dt;
    const wantCruisers = Math.min(5, this.stars + (this.stars > 0 ? 1 : 0));
    this.cruisers = this.cruisers.filter(c => c.health > 0);
    if (this.stars > 0 && this.cruisers.length < wantCruisers && this.spawnT <= 0) {
      this.spawnCruiser();
      this.spawnT = 2.5;
    }
    // Foot officers bail out of stopped cruisers at 4+ stars.
    if (this.stars >= 4) {
      for (const c of this.cruisers) {
        if (Math.abs(c.speed) < 1.5 && VN.dist2d(c.x, c.z, px, pz) < 26 && !c.officerOut && this.officers.filter(o => !o.dead).length < 3) {
          c.officerOut = true;
          this.spawnOfficer(c);
        }
      }
    }

    // Cruisers chase the player's position and try to ram.
    for (const c of this.cruisers) {
      const tx = seen ? px : this.lastSeenPos.x, tz = seen ? pz : this.lastSeenPos.z;
      const dx = tx - c.x, dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dx, -dz);
      const diff = VN.angDiff(wantHeading, c.heading);
      let throttle = 1, brake = false;
      if (d < 6) { throttle = 0.2; }
      if (d > 130) { c.health = 0; } // lost them entirely: give up & despawn below
      c.driveStep(dt, { throttle, steer: VN.clamp(diff * 1.8, -1, 1), brake, handbrake: Math.abs(diff) > 1.4 }, G.city);
      // Ram contact damages the player's car a little and slows both.
      if (G.mode === 'car' && G.playerCar && VN.dist2d(c.x, c.z, G.playerCar.x, G.playerCar.z) < 3.4) {
        G.playerCar.damage(2.2);
        G.playerCar.speed *= 0.96;
        c.speed *= 0.94;
      }
      // Light bar flash.
      this.sirenPhase += dt * 6;
    }
    // Remove wrecked / given-up cruisers.
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const c = this.cruisers[i];
      if (c.health <= 0) {
        G.scene.remove(c.group); G.scene.remove(c.smoke);
        const gi = G.cars.indexOf(c); if (gi >= 0) G.cars.splice(gi, 1);
        this.cruisers.splice(i, 1);
      }
    }

    // Officers on foot close in and shoot at high heat.
    for (const o of this.officers) {
      if (o.dead) continue;
      const dx = px - o.x, dz = pz - o.z;
      const d = Math.hypot(dx, dz);
      o.heading = Math.atan2(dx, dz);
      if (d > 13) {
        o.x += Math.sin(o.heading) * 3.4 * dt;
        o.z += Math.cos(o.heading) * 3.4 * dt;
        VN.pushOutCity(G.city, o, 0.5);
      }
      o.syncMesh();
      o.fig.animate(dt, d > 13 ? 3 : 0);
      o.shootT -= dt;
      if (d < 34 && o.shootT <= 0 && this.stars >= 3) {
        o.shootT = 1.1 + Math.random() * 0.7;
        G.combat.enemyShoot(o, d);
      }
    }

    // BUSTED meter: an officer (or stopped cruiser) close while slow/on foot.
    let pressure = 0;
    if (G.mode === 'foot') {
      for (const o of this.officers) if (!o.dead && VN.dist2d(o.x, o.z, px, pz) < 9) pressure = 1;
      for (const c of this.cruisers) if (VN.dist2d(c.x, c.z, px, pz) < 8 && Math.abs(c.speed) < 3) pressure = 1;
    } else if (G.playerCar && Math.abs(G.playerCar.speed) < 2.5) {
      for (const c of this.cruisers) if (VN.dist2d(c.x, c.z, px, pz) < 8.5) pressure = 1;
    }
    if (pressure && this.stars > 0) {
      this.bustedMeter += dt / 2.6;
      if (this.bustedMeter >= 1) { this.bustedMeter = 0; G.onBusted(); }
    } else {
      this.bustedMeter = Math.max(0, this.bustedMeter - dt * 0.7);
    }
    if (this.stars > 0 && VN.SFX) VN.SFX.siren(this.cruisers.length > 0 && VN.dist2d(this.cruisers[0].x, this.cruisers[0].z, px, pz) < 60);
  }

  clearHeat() { this.heat = 0; this.stars = 0; this.bustedMeter = 0; }
  despawnAll() {
    const G = this.G;
    for (const c of this.cruisers) {
      G.scene.remove(c.group); G.scene.remove(c.smoke);
      const gi = G.cars.indexOf(c); if (gi >= 0) G.cars.splice(gi, 1);
    }
    this.cruisers = [];
    for (const o of this.officers) {
      G.scene.remove(o.group);
      const gi = G.peds.indexOf(o); if (gi >= 0) G.peds.splice(gi, 1);
    }
    this.officers = [];
  }
};
