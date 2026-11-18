// drive.js — everything with wheels: the low-poly car factory, arcade physics
// with handbrake drift and damage, and the traffic AI that follows Velmara's
// road grid, brakes for trouble and flees gunfire.

import { AVENUES, WATER_Z, collideWithBuildings } from './citygen.js';

export const CAR_MODELS = [
  { name: 'Kestrel Coupe', topSpeed: 34, accel: 17, grip: 9, colors: [0xd84040, 0x3050c8, 0xe8e4da, 0x22242c, 0x28a068] },
  { name: 'Bantam Hatch', topSpeed: 26, accel: 13, grip: 10, colors: [0xe0a428, 0x68b8d8, 0xb8bcc4, 0x78489e] },
  { name: 'Solace Sedan', topSpeed: 29, accel: 14, grip: 10, colors: [0x3a3f4a, 0x702838, 0x284858, 0xd8d4c8] },
  { name: 'Mirella Wagon', topSpeed: 27, accel: 13, grip: 11, colors: [0x587858, 0x885830, 0x484848, 0xa8b0b8] },
  { name: 'Orphee GT', topSpeed: 40, accel: 21, grip: 8, colors: [0xff3d8a, 0x2ee6ff, 0xffc857, 0x101014] },
  { name: 'Dockmaster Pickup', topSpeed: 28, accel: 15, grip: 9, colors: [0x986838, 0x506878, 0x686058, 0x7a2828] },
];
export const POLICE_MODEL = { name: 'VPD Interceptor', topSpeed: 37, accel: 19, grip: 9.5 };

let smokeTexture = null;
function getSmokeTexture(THREE) {
  if (smokeTexture) return smokeTexture;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(160,160,170,0.75)');
  grad.addColorStop(1, 'rgba(120,120,130,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  smokeTexture = new THREE.CanvasTexture(cv);
  return smokeTexture;
}

export function makeCarMesh(THREE, colorHex, isPolice = false) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xe8ecf2 : colorHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14151c });
  const glass = new THREE.MeshLambertMaterial({ color: 0x0e2233, emissive: 0x0a2e44 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), paint);
  body.position.y = 0.55;
  car.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.9), paint);
  nose.position.set(0, 0.48, 2.3);
  car.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.08, -0.25);
  car.add(cabin);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.16, 4.34), dark);
  trim.position.y = 0.3;
  car.add(trim);

  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.2, 4.0),
      new THREE.MeshLambertMaterial({ color: 0x1c3fae }));
    stripe.position.y = 0.62;
    car.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.4), dark);
    barBase.position.set(0, 1.42, -0.25);
    car.add(barBase);
    const flashL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    flashL.position.set(-0.34, 1.52, -0.25);
    car.add(flashL);
    const flashR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.34),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    flashR.position.set(0.34, 1.52, -0.25);
    car.add(flashR);
    car.userData.flashers = [flashL, flashR];
  }

  // headlights + fake light cones for the wet street
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), lightMat);
    lamp.position.set(sx, 0.58, 2.72);
    car.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tail.position.set(sx, 0.6, -2.16);
    car.add(tail);
  }
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffedb5, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 8.5, 10, 1, true), coneMat);
  cone.rotation.x = Math.PI / 2 + 0.1;
  cone.position.set(0, 0.5, 6.6);
  car.add(cone);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    car.add(wheel);
    wheels.push(wheel);
  }
  car.userData.wheels = wheels;

  const smoke = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getSmokeTexture(THREE), transparent: true, opacity: 0, depthWrite: false,
  }));
  smoke.position.set(0, 1.5, 1.6);
  smoke.scale.set(1.6, 1.6, 1);
  car.add(smoke);
  car.userData.smoke = smoke;
  return car;
}

export function createCar(THREE, scene, model, colorHex, x, z, heading, kind) {
  const isPolice = kind === 'police';
  const mesh = makeCarMesh(THREE, colorHex, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh, kind, model,
    name: model.name,
    heading,
    vel: { x: 0, z: 0 },
    speed: 0,
    health: 100,
    ai: null,
    occupied: false,
    locked: false,
    flashPhase: Math.random() * 6,
    smokePhase: Math.random() * 6,
    honkAt: 0,
  };
  return car;
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

/**
 * Shared arcade physics. throttle -1..1, steer -1..1 (left positive),
 * handbrake loosens the rear so the car slides. Mutates car + calls
 * G.onCarCrash(car, intensity) on hard impacts.
 */
export function applyCarPhysics(G, car, throttle, steer, handbrake, dt) {
  const fwd = carForward(car);
  const right = { x: fwd.z, z: -fwd.x };
  let vf = car.vel.x * fwd.x + car.vel.z * fwd.z;
  let vr = car.vel.x * right.x + car.vel.z * right.z;

  const engine = car.model.accel * (car.health < 25 ? 0.55 : 1);
  if (throttle > 0) {
    vf += engine * throttle * dt;
  } else if (throttle < 0) {
    if (vf > 0.5) vf += 26 * throttle * dt;        // braking hard
    else vf += engine * 0.55 * throttle * dt;      // reversing
  }
  vf -= vf * 0.55 * dt;                       // rolling drag
  const grip = handbrake ? 1.6 : car.model.grip;
  vr -= vr * Math.min(1, grip * dt) * (handbrake ? 0.4 : 1);
  if (handbrake) vf -= vf * 1.1 * dt;

  const top = car.model.topSpeed;
  if (vf > top) vf = top;
  if (vf < -9) vf = -9;

  const steerAuthority = Math.min(1, Math.abs(vf) / 6) * (vf < 0 ? -1 : 1);
  car.heading += steer * 1.85 * steerAuthority * dt * (handbrake ? 1.35 : 1);

  const nf = carForward(car);
  const nr = { x: nf.z, z: -nf.x };
  car.vel.x = nf.x * vf + nr.x * vr;
  car.vel.z = nf.z * vf + nr.z * vr;
  car.speed = vf;

  const pos = car.mesh.position;
  pos.x += car.vel.x * dt;
  pos.z += car.vel.z * dt;

  // world limits: ring road + harbor edge
  const LIM = 240;
  pos.x = Math.max(-LIM, Math.min(LIM, pos.x));
  pos.z = Math.max(-LIM, Math.min(WATER_Z + 2, pos.z));

  // building collision at nose and tail
  let crashed = 0;
  for (const off of [1.7, -1.7]) {
    const probe = { x: pos.x + nf.x * off, z: pos.z + nf.z * off };
    const before = { x: probe.x, z: probe.z };
    if (collideWithBuildings(G.city, probe, 1.15)) {
      const pushX = probe.x - before.x, pushZ = probe.z - before.z;
      pos.x += pushX; pos.z += pushZ;
      const impact = Math.abs(vf);
      if (impact > 6) crashed = Math.max(crashed, impact);
      vf *= -0.25;
      vr *= 0.4;
      car.vel.x = nf.x * vf + nr.x * vr;
      car.vel.z = nf.z * vf + nr.z * vr;
      car.speed = vf;
    }
  }
  if (crashed > 0) {
    car.health = Math.max(0, car.health - crashed * 1.1);
    if (G.onCarCrash) G.onCarCrash(car, crashed);
  }

  car.mesh.position.y = 0;
  car.mesh.rotation.y = car.heading;
  // body roll & pitch for feel
  car.mesh.rotation.z = -steer * Math.min(0.06, Math.abs(vf) * 0.0022) * (handbrake ? 1.6 : 1);
  car.mesh.rotation.x = Math.max(-0.05, Math.min(0.05, -throttle * 0.02));
  const spin = vf * dt / 0.42;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return crashed;
}

/** Player wrapper: reads G.input, handles engine audio + theft state. */
export function stepPlayerCar(G, car, dt) {
  const up = G.keys.KeyW || G.keys.ArrowUp;
  const down = G.keys.KeyS || G.keys.ArrowDown;
  const left = G.keys.KeyA || G.keys.ArrowLeft;
  const right = G.keys.KeyD || G.keys.ArrowRight;
  let throttle = 0;
  if (up) throttle = 1;
  if (down) throttle = vfSign(car) > 0.4 ? -0.9 : -1; // brake first, then reverse
  const steer = (left ? 1 : 0) + (right ? -1 : 0);
  const handbrake = !!G.keys.Space;
  applyCarPhysics(G, car, throttle, steer, handbrake, dt);
  G.sound.setEngine(Math.min(1, Math.abs(car.speed) / car.model.topSpeed + (up ? 0.25 : 0)), true);
}

function vfSign(car) {
  const f = carForward(car);
  return car.vel.x * f.x + car.vel.z * f.z;
}

/** Traffic route state: follow one avenue, maybe turn at each junction. */
export function giveTrafficRoute(G, car) {
  const alongZ = G.rng() < 0.5;
  const avenue = AVENUES[Math.floor(G.rng() * AVENUES.length)];
  const dir = G.rng() < 0.5 ? 1 : -1;
  car.ai = {
    axis: alongZ ? 'z' : 'x',
    dir,
    avenue,
    cruise: 10 + G.rng() * 5,
    decidedAt: null,
    panic: 0,
  };
  placeTrafficCar(car);
}

export function placeTrafficCar(car) {
  const ai = car.ai;
  if (ai.axis === 'z') {
    // right-hand traffic: northbound rides the west lane, southbound the east
    car.mesh.position.x = ai.avenue + (ai.dir > 0 ? -3.6 : 3.6);
    car.heading = ai.dir > 0 ? 0 : Math.PI;
  } else {
    car.mesh.position.z = ai.avenue + (ai.dir > 0 ? 3.6 : -3.6);
    car.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.vel.x = 0; car.vel.z = 0;
}

function nextJunction(car) {
  const ai = car.ai;
  const along = ai.axis === 'z' ? car.mesh.position.z : car.mesh.position.x;
  let best = null;
  for (const a of AVENUES) {
    const d = (a - along) * ai.dir;
    if (d > 2 && (best === null || d < best.d)) best = { at: a, d };
  }
  return best;
}

export function stepTrafficCar(G, car, dt) {
  const ai = car.ai;
  if (!ai) return;
  const pos = car.mesh.position;
  ai.panic = Math.max(0, ai.panic - dt);
  if (G.panicAt && pos.distanceTo(G.panicAt) < 26) ai.panic = 2.5;

  // junction turning
  const j = nextJunction(car);
  const along = ai.axis === 'z' ? pos.z : pos.x;
  if (j && j.d < 3.2 && ai.decidedAt !== j.at) {
    ai.decidedAt = j.at;
    if (G.rng() < (ai.panic > 0 ? 0.65 : 0.38)) {
      // turn onto the crossing avenue
      const newDir = G.rng() < 0.5 ? 1 : -1;
      if (ai.axis === 'z') {
        ai.axis = 'x'; ai.dir = newDir; ai.avenue = j.at;
        pos.z = j.at + (newDir > 0 ? 3.6 : -3.6);
      } else {
        ai.axis = 'z'; ai.dir = newDir; ai.avenue = j.at;
        pos.x = j.at + (newDir > 0 ? -3.6 : 3.6);
      }
    }
  }
  if (Math.abs(along) > 236) { // reached the ring: turn around via the cross street
    ai.dir *= -1;
    ai.decidedAt = null;
  }

  // desired heading along the route
  let targetHeading;
  if (ai.axis === 'z') targetHeading = ai.dir > 0 ? 0 : Math.PI;
  else targetHeading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  let dh = targetHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dh * 2.2));

  // keep to the lane centre on the cross axis
  const laneCoord = ai.axis === 'z' ? ai.avenue + (ai.dir > 0 ? -3.6 : 3.6) : ai.avenue + (ai.dir > 0 ? 3.6 : -3.6);
  const cross = ai.axis === 'z' ? pos.x : pos.z;
  const laneError = laneCoord - cross;
  const steerWithLane = Math.max(-1, Math.min(1, steer + (ai.axis === 'z' ? laneError * 0.14 * (ai.dir > 0 ? 1 : -1) : -laneError * 0.14 * (ai.dir > 0 ? 1 : -1))));

  // obstacle scan ahead
  let desired = ai.panic > 0 ? car.model.topSpeed * 0.8 : ai.cruise;
  const fwd = carForward(car);
  const ahead = { x: pos.x + fwd.x * 8, z: pos.z + fwd.z * 8 };
  for (const other of G.cars) {
    if (other === car) continue;
    const op = other.mesh.position;
    const dx = op.x - pos.x, dz = op.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 9 && dx * fwd.x + dz * fwd.z > 0) { desired = 0; break; }
  }
  if (G.mode === 'play') {
    const pp = G.playerPos();
    const dx = pp.x - pos.x, dz = pp.z - pos.z;
    if (Math.hypot(dx, dz) < 8 && dx * fwd.x + dz * fwd.z > 0 && !G.player.car) desired = 0;
    void ahead;
  }
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const pp = ped.mesh.position;
    const dx = pp.x - pos.x, dz = pp.z - pos.z;
    if (Math.hypot(dx, dz) < 6.5 && dx * fwd.x + dz * fwd.z > 0) { desired = Math.min(desired, 2); break; }
  }

  const currentF = vfSign(car);
  let throttle = 0;
  if (currentF < desired - 0.4) throttle = 1;
  else if (currentF > desired + 0.4) throttle = -0.7;
  applyCarPhysics(G, car, throttle, steerWithLane, false, dt);
}

/** Car-to-car soft collisions + smoke/flasher effects, once per frame. */
export function updateCarFleet(G, dt, t) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const pa = a.mesh.position, pb = b.mesh.position;
      const dx = pb.x - pa.x, dz = pb.z - pa.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 16.8 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (4.1 - d) / 2;
        const nx = dx / d, nz = dz / d;
        pa.x -= nx * push; pa.z -= nz * push;
        pb.x += nx * push; pb.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 7) {
          a.health = Math.max(0, a.health - rel * 0.5);
          b.health = Math.max(0, b.health - rel * 0.5);
          if (G.onCarCrash) G.onCarCrash(a, rel * 0.7);
        }
        a.vel.x *= 0.82; a.vel.z *= 0.82;
        b.vel.x *= 0.82; b.vel.z *= 0.82;
      }
    }
  }
  for (const car of cars) {
    const smoke = car.mesh.userData.smoke;
    if (smoke) {
      const dmg = 1 - car.health / 100;
      smoke.material.opacity = car.health < 55 ? 0.25 + dmg * 0.5 + Math.sin(t * 9 + car.smokePhase) * 0.08 : 0;
      const s = 1.3 + dmg * 1.6 + Math.sin(t * 7 + car.smokePhase) * 0.2;
      smoke.scale.set(s, s, 1);
    }
    const flashers = car.mesh.userData.flashers;
    if (flashers) {
      const on = car.kind === 'police' && car.active;
      const phase = Math.sin(t * 11 + car.flashPhase) > 0;
      flashers[0].material.color.setHex(on && phase ? 0xff2222 : 0x551111);
      flashers[1].material.color.setHex(on && !phase ? 0x3388ff : 0x112255);
    }
  }
}
