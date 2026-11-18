// crowds.js - Velmara's people and traffic. Pedestrians stroll the
// sidewalks, scatter from gunfire and crashes, and can be robbed at
// gunpoint. Traffic cars follow the road grid lane by lane, brake for the
// car ahead, and flee when shots ring out near them.
window.VN = window.VN || {};

VN.Ped = class Ped {
  constructor(spawn, i) {
    const palette = [0xd84f8a, 0x3f7ad8, 0xd8b13c, 0x53b04f, 0x8a5ed8, 0xd86a3c, 0xb0b6c0, 0x7ad8d0];
    this.fig = VN.makeHuman({
      skin: [0xc89878, 0x8a5a3c, 0xe8b898, 0x6a4230][i % 4],
      body: palette[i % palette.length],
      hair: [0x1c1410, 0x3a2418, 0x0e0c0a, 0x6a5138][i % 4],
      dress: i % 5 === 3,
    });
    this.group = this.fig.group;
    this.x = spawn.x; this.z = spawn.z;
    this.heading = (i * 1.7) % (Math.PI * 2);
    this.speed = 0;
    this.state = 'stroll';
    this.fleeT = 0;
    this.target = null;
    this.pickTarget();
    this.health = 30;
    this.dead = false;
    this.robbedAt = -99;
    this.isThug = false;
    this.syncMesh();
  }
  pickTarget() {
    const H = VN.CITY.H_ROADS, V = VN.CITY.V_ROADS;
    if (Math.random() < 0.5) {
      const hz = H[Math.floor(Math.random() * H.length)];
      this.target = { x: this.x + (Math.random() - 0.5) * 160, z: hz + (Math.random() < 0.5 ? -10.3 : 10.3) };
    } else {
      const vx = V[Math.floor(Math.random() * V.length)];
      this.target = { x: vx + (Math.random() < 0.5 ? -10.3 : 10.3), z: this.z + (Math.random() - 0.5) * 160 };
    }
    this.target.x = VN.clamp(this.target.x, -310, 310);
    this.target.z = VN.clamp(this.target.z, -270, 225);
  }
  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
  scare(fromX, fromZ, t) {
    if (this.dead) return;
    this.state = 'flee';
    this.fleeT = t + 2.5 + Math.random() * 2;
    this.heading = Math.atan2(this.x - fromX, this.z - fromZ);
  }
  update(dt, G) {
    if (this.dead) return;
    const now = G.time;
    let want = 0;
    if (this.state === 'flee') {
      want = 4.6;
      if (now > this.fleeT) { this.state = 'stroll'; this.pickTarget(); }
    } else if (this.state === 'hostage') {
      want = 0;
    } else if (this.target) {
      const dx = this.target.x - this.x, dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6) this.pickTarget();
      else {
        const wantHeading = Math.atan2(dx, dz);
        this.heading += VN.clamp(VN.angDiff(wantHeading, this.heading), -dt * 4, dt * 4);
        want = 1.5;
      }
    }
    this.speed = VN.lerp(this.speed, want, Math.min(1, dt * 5));
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    VN.pushOutCity(G.city, this, 0.5);
    this.x = VN.clamp(this.x, -315, 315);
    this.z = VN.clamp(this.z, -275, 230);
    this.syncMesh();
    this.fig.animate(dt, this.speed);
  }
  hurt(amount, G) {
    this.health -= amount;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.25;
      if (G && G.law) G.law.reportCrime('assault', this.x, this.z, 2);
    } else {
      this.scare(this.x + 5, this.z, G ? G.time : 0);
    }
  }
};

VN.TrafficBrain = class TrafficBrain {
  constructor(car) {
    this.car = car;
    this.laneTarget = null;
    this.pickNext();
    this.stuckT = 0;
  }
  // Drive the grid: pick a target point on a road ahead, steer to it.
  pickNext() {
    const c = this.car;
    const H = VN.CITY.H_ROADS, V = VN.CITY.V_ROADS;
    const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
    let best = null, bestScore = -1e9;
    const cand = [];
    for (const z of H) for (const x of [-300, -150, 0, 150, 300]) cand.push({ x: x + 3.6, z: z + 3.6 });
    for (const x of V) for (const z of [-260, -130, 0, 130, 200]) cand.push({ x: x + 3.6, z: z + 3.6 });
    for (const p of cand) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 25) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      const score = dot * 100 - d * 0.05 + Math.random() * 4;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    this.laneTarget = best || { x: 0, z: 20 };
  }
  update(dt, G) {
    const c = this.car;
    if (c.driver !== 'ai') return;
    const t = this.laneTarget;
    const dx = t.x - c.x, dz = t.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 7) this.pickNext();
    const wantHeading = Math.atan2(-dx, -dz);
    const diff = VN.angDiff(wantHeading, c.heading);
    let throttle = 0.75, brake = false;
    // Brake for anything close ahead (cars, the player, peds).
    const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
    let blocked = false;
    const scan = (ox, oz, r) => {
      const rx = ox - c.x, rz = oz - c.z;
      const ahead = rx * fx + rz * fz;
      const side = Math.abs(rx * fz - rz * fx);
      if (ahead > 0 && ahead < r && side < 2.4) blocked = true;
    };
    for (const other of G.cars) { if (other !== c) scan(other.x, other.z, 11); }
    if (G.mode === 'foot') scan(G.player.x, G.player.z, 8);
    for (const p of G.peds) { if (!p.dead) scan(p.x, p.z, 7); }
    if (G.panicAt && G.time - G.panicAt < 3 && VN.dist2d(c.x, c.z, G.panicX, G.panicZ) < 40) {
      throttle = 1; // flee the gunfire
    } else if (blocked) { throttle = 0; brake = true; }
    else if (Math.abs(diff) > 0.7) throttle = 0.35;
    c.driveStep(dt, { throttle, steer: VN.clamp(diff * 1.6, -1, 1), brake, handbrake: false }, G.city);
    c.setHeadlights(true);
  }
};
