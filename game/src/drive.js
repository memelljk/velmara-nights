// drive.js - cars for Velmara Nights. Each car body is ONE vertex-coloured
// merged mesh plus ONE merged lamp mesh (the merged-shell recipe), with
// separate wheels, headlight cones and damage smoke whose emitter points
// start BELOW ground so nothing piles up at the origin. Pure arcade driving.
window.VN = window.VN || {};

const CAR_DIMS = {
  coupe: { len: 4.3, wid: 1.9, hgt: 0.62, cab: 0.5, top: 2.0 },
  sedan: { len: 4.6, wid: 1.95, hgt: 0.68, cab: 0.55, top: 2.3 },
  hatch: { len: 3.9, wid: 1.85, hgt: 0.72, cab: 0.6, top: 1.9 },
  pickup: { len: 5.0, wid: 2.05, hgt: 0.8, cab: 0.62, top: 1.7 },
  gt: { len: 4.5, wid: 2.0, hgt: 0.55, cab: 0.45, top: 1.9 },
  cruiser: { len: 4.8, wid: 2.0, hgt: 0.7, cab: 0.58, top: 2.3 },
};

VN.makeCarMesh = function (model, color, opts) {
  opts = opts || {};
  const dim = CAR_DIMS[model] || CAR_DIMS.sedan;
  const body = new VN.GeoBatch();
  const dark = new THREE.Color(color).multiplyScalar(0.6).getHex();
  body.box(dim.wid, dim.hgt, dim.len, 0, 0.42 + dim.hgt / 2, 0, color);
  body.box(dim.wid * 0.86, dim.cab, dim.top, 0, 0.42 + dim.hgt + dim.cab / 2, -0.15, 0x141a24);
  body.box(dim.wid + 0.08, 0.22, dim.len * 0.96, 0, 0.42, 0, dark);
  if (model === 'pickup') body.box(dim.wid * 0.92, 0.34, 1.7, 0, 1.05, 1.35, dark);
  if (model === 'gt') body.box(dim.wid * 0.8, 0.12, 0.5, 0, 1.02, 1.95, dark);
  if (opts.police) {
    body.box(dim.wid + 0.04, dim.hgt * 0.7, dim.len * 0.5, 0, 0.45 + dim.hgt / 2, 0.1, 0xe8ecf2);
    body.box(1.1, 0.18, 0.5, 0, 1.62, -0.15, 0x1c2027);
  }
  // Wheels baked into the same shell: four dark cylinders, axis across.
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(corner => {
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    const wm = new THREE.Matrix4().compose(
      new THREE.Vector3(corner[0] * (dim.wid / 2 - 0.05), 0.36, corner[1] * (dim.len / 2 - 0.75)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
      new THREE.Vector3(1, 1, 1)
    );
    body.addGeo(wg, wm, 0x0c0e12);
    wg.dispose();
  });
  const bodyMesh = body.build(VN.MAT.flat);

  const lamps = new VN.GeoBatch();
  lamps.box(0.34, 0.16, 0.08, -dim.wid / 2 + 0.3, 0.78, -dim.len / 2 - 0.02, 0xfff2b0);
  lamps.box(0.34, 0.16, 0.08, dim.wid / 2 - 0.3, 0.78, -dim.len / 2 - 0.02, 0xfff2b0);
  lamps.box(0.34, 0.14, 0.08, -dim.wid / 2 + 0.3, 0.8, dim.len / 2 + 0.02, 0xff2a3c);
  lamps.box(0.34, 0.14, 0.08, dim.wid / 2 - 0.3, 0.8, dim.len / 2 + 0.02, 0xff2a3c);
  if (opts.police) {
    lamps.box(0.45, 0.14, 0.4, -0.3, 1.78, -0.15, 0xff2a4a);
    lamps.box(0.45, 0.14, 0.4, 0.3, 1.78, -0.15, 0x2a6aff);
  }
  const lampMesh = lamps.build(VN.MAT.basic);

  const group = new THREE.Group();
  group.add(bodyMesh, lampMesh);

  // Wheels are merged into the body shell (one more saving of four draw
  // calls per car); at night, in the rain, nobody reads wheel spin.
  const wheels = [];

  // Headlight cones: additive, opacity 0.04, fog OFF, FrontSide only -
  // as a plain material these render as opaque grey blobs.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b0, transparent: true, opacity: 0.04, fog: false,
    side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cones = [];
  [-1, 1].forEach(side => {
    const coneGeo = new THREE.ConeGeometry(1.05, 7.5, 10, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(side * (dim.wid / 2 - 0.3), 0.72, -dim.len / 2 - 3.6);
    cone.visible = false;
    group.add(cone);
    cones.push(cone);
  });

  return { group, wheels, cones, lampMesh, dim };
};

VN.Car = class Car {
  constructor(spawn, opts) {
    opts = opts || {};
    this.model = spawn.model || 'sedan';
    this.color = spawn.color;
    const made = VN.makeCarMesh(this.model, this.color, opts);
    this.group = made.group;
    this.wheels = made.wheels;
    this.cones = made.cones;
    this.dim = made.dim;
    this.x = spawn.x; this.z = spawn.z;
    this.heading = spawn.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.parked = !!spawn.parked;
    this.isPolice = !!opts.police;
    this.isGT = !!opts.isGT;
    this.driver = null;
    this.ai = null;
    this.smokeTimer = 0;
    this.syncMesh();
    this.buildSmoke();
  }

  buildSmoke() {
    const n = 26;
    const posArr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { posArr[i * 3] = 0; posArr[i * 3 + 1] = -60 - i; posArr[i * 3 + 2] = 0; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.smokeGeo = geo;
    this.smokeData = [];
    for (let i = 0; i < n; i++) this.smokeData.push({ life: -1, x: 0, y: -60, z: 0 });
    const mat = new THREE.PointsMaterial({ color: 0x8a8f98, size: 1.5, transparent: true, opacity: 0.5, depthWrite: false });
    this.smoke = new THREE.Points(geo, mat);
    this.smoke.frustumCulled = false;
    this.smoke.visible = false;
  }

  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  setHeadlights(on) { this.cones.forEach(c => { c.visible = !!on; }); }
  damage(amount) { this.health = Math.max(0, this.health - amount); }

  driveStep(dt, input, city) {
    const maxSpeed = this.isPolice ? 46 : this.model === 'gt' ? 50 : 40;
    const accel = this.isPolice ? 26 : 22;
    if (input.throttle > 0) this.speed += accel * input.throttle * dt * (1 - Math.max(0, this.speed) / (maxSpeed * 1.25));
    else if (input.throttle < 0) {
      if (this.speed > 0.5 && input.brake) this.speed -= 34 * dt;
      else this.speed += 13 * input.throttle * dt;
    } else {
      this.speed -= this.speed * 0.55 * dt;
      if (Math.abs(this.speed) < 0.04) this.speed = 0;
    }
    if (input.brake && input.throttle >= 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 30 * dt);
    this.speed = VN.clamp(this.speed, -13, maxSpeed);
    const steerTarget = (input.steer || 0) * 0.55;
    this.steer = VN.lerp(this.steer, steerTarget, Math.min(1, dt * 7));
    const grip = input.handbrake ? 0.45 : 1;
    if (Math.abs(this.speed) > 0.2) {
      const turn = this.steer * (1.9 / (1 + Math.abs(this.speed) * 0.045)) * grip;
      this.heading += turn * dt * Math.sign(this.speed) * (input.handbrake ? 1.5 : 1);
    }
    const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);
    let nx = this.x + fx * this.speed * dt;
    let nz = this.z + fz * this.speed * dt;
    if (input.handbrake && Math.abs(this.speed) > 8) {
      nx += Math.cos(this.heading) * this.steer * this.speed * 0.22 * dt;
      nz += -Math.sin(this.heading) * this.steer * this.speed * 0.22 * dt;
    }
    const hit = VN.collideCity(city, nx, nz, 1.5);
    if (hit) {
      if (Math.abs(this.speed) > 9) { this.damage(Math.abs(this.speed) * 0.55); if (VN.SFX) VN.SFX.crash(); }
      this.speed *= -0.25;
      nx = this.x; nz = this.z;
    }
    this.x = VN.clamp(nx, -316, 316);
    this.z = VN.clamp(nz, -276, 262);
    if (this.z > 236) this.speed *= 0.94;
    this.syncMesh();
    const spin = this.speed * dt / 0.36;
    this.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = this.steer * 0.7;
    });
    this.updateSmoke(dt);
  }

  updateSmoke(dt) {
    if (!this.smoke) return;
    const damaged = this.health < 55;
    this.smokeTimer -= dt;
    const pos = this.smokeGeo.attributes.position;
    for (let i = 0; i < this.smokeData.length; i++) {
      const p = this.smokeData[i];
      if (p.life < 0) {
        if (damaged && this.smokeTimer <= 0 && i % 3 === 0) {
          p.life = 1.4;
          p.x = this.x + Math.sin(this.heading) * 1.6;
          p.y = 1.1;
          p.z = this.z + Math.cos(this.heading) * 1.6;
          if (i === 0) this.smokeTimer = 0.16;
        } else { pos.setXYZ(i, 0, -80, 0); continue; }
      }
      p.life -= dt;
      p.y += dt * 2.2;
      pos.setXYZ(i, p.x, p.y, p.z);
      if (p.life < 0) pos.setXYZ(i, 0, -80, 0);
    }
    pos.needsUpdate = true;
    this.smoke.visible = damaged;
  }
};

VN.collideCity = function (city, x, z, r) {
  if (!city) return false;
  for (const c of city.colliders) {
    const px = c.hw + r - Math.abs(x - c.x), pz = c.hd + r - Math.abs(z - c.z);
    if (px > 0 && pz > 0) return true;
  }
  return false;
};

VN.pushOutCity = function (city, ent, r) {
  if (!city) return;
  for (const c of city.colliders) {
    const dx = ent.x - c.x, dz = ent.z - c.z;
    const px = c.hw + r - Math.abs(dx), pz = c.hd + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) ent.x = c.x + Math.sign(dx || 1) * (c.hw + r);
      else ent.z = c.z + Math.sign(dz || 1) * (c.hd + r);
    }
  }
};
