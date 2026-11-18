// law.js — Velmara PD: the wanted system (crimes add heat, heat becomes
// stars, hiding bleeds heat away), interceptor cars that hunt and ram the
// player, foot officers at high wanted levels, and the BUSTED meter that
// fills while the law has its hands on you.

import { AVENUES } from './citygen.js';
import { POLICE_MODEL, createCar, applyCarPhysics } from './drive.js';
import { makePersonMesh, animatePersonWalk } from './avatar.js';

export const CRIME_HEAT = {
  gunfire: 16,
  robbery: 22,
  theft: 13,
  carjack: 26,
  hitAndRun: 24,
  murder: 46,
  shotPolice: 30,
  policeTheft: 42,
  vaultAlarm: 65,
  missionMayhem: 20,
};

export function starsForHeat(heat) {
  if (heat <= 1) return 0;
  return Math.min(5, 1 + Math.floor(heat / 30));
}

function spawnCopCar(G) {
  const p = G.playerPos();
  const angle = G.rng() * Math.PI * 2;
  const dist = 85 + G.rng() * 40;
  let x = p.x + Math.sin(angle) * dist;
  let z = p.z + Math.cos(angle) * dist;
  // snap to the nearest avenue crossing so they arrive on a road
  const snap = (v) => AVENUES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), AVENUES[0]);
  if (G.rng() < 0.5) x = snap(x); else z = snap(z);
  x = Math.max(-228, Math.min(228, x));
  z = Math.max(-228, Math.min(228, z));
  const car = createCar(G.THREE, G.scene, POLICE_MODEL, 0xffffff, x, z, G.rng() * Math.PI * 2, 'police');
  car.active = true;
  G.cars.push(car);
  G.cops.push(car);
  return car;
}

function spawnOfficer(G) {
  const p = G.playerPos();
  const angle = G.rng() * Math.PI * 2;
  const mesh = makePersonMesh(G.THREE, { shirt: 0x1c3fae, pants: 0x141c33, skin: 0xd9a878, cap: 0x101c3a });
  mesh.position.set(
    Math.max(-235, Math.min(235, p.x + Math.sin(angle) * 26)),
    0,
    Math.max(-235, Math.min(235, p.z + Math.cos(angle) * 26)),
  );
  G.scene.add(mesh);
  const officer = { mesh, heading: 0, walkPhase: 0, shootCd: 2 + G.rng() * 2 };
  G.officers.push(officer);
  return officer;
}

export function clearPolice(G) {
  for (const cop of [...G.cops]) G.removeCar(cop);
  G.cops.length = 0;
  for (const o of G.officers) G.scene.remove(o.mesh);
  G.officers.length = 0;
  G.bustMeter = 0;
}

/** Heat decay, star changes, and keeping the response scaled to the stars. */
export function updateWanted(G, dt) {
  const w = G.wanted;
  const playerPos = G.playerPos();
  const anyCopNear = G.cops.some((c) => c.active && c.mesh.position.distanceTo(playerPos) < 36) ||
    G.officers.some((o) => o.mesh.position.distanceTo(playerPos) < 30);
  const sinceCrime = G.time - w.lastCrimeAt;
  if (sinceCrime > 5) {
    w.heat = Math.max(0, w.heat - dt * (anyCopNear ? 0.5 : 2.6));
  }
  const stars = starsForHeat(w.heat);
  if (stars !== w.stars) {
    w.stars = stars;
    if (stars > 0) G.sound.sirenWhoop();
  }

  const targetCars = stars === 0 ? 0 : Math.min(6, 1 + stars);
  const activeCops = G.cops.filter((c) => c.active);
  if (activeCops.length < targetCars) {
    w.spawnCd -= dt;
    if (w.spawnCd <= 0) {
      w.spawnCd = 2.5;
      spawnCopCar(G);
    }
  }
  // when the heat dies, units stand down; wrecked, stood-down (and distant)
  // or hopelessly distant units are cleared away by dispatch
  if (stars === 0) for (const cop of G.cops) cop.active = false;
  for (const cop of [...G.cops]) {
    const dist = cop.mesh.position.distanceTo(playerPos);
    if ((!cop.active && dist > 45) || dist > 260) {
      G.removeCar(cop);
      G.cops.splice(G.cops.indexOf(cop), 1);
    }
  }
  const targetOfficers = stars >= 4 ? 2 : 0;
  if (G.officers.length < targetOfficers) {
    w.spawnCd -= dt;
    if (w.spawnCd <= 0) { w.spawnCd = 3; spawnOfficer(G); }
  } else if (G.officers.length > targetOfficers) {
    const o = G.officers.pop();
    G.scene.remove(o.mesh);
  }
}

/** Interceptor driving: aim at where the player will be, and do not lift off. */
export function stepPoliceCar(G, car, dt) {
  if (!car.active) {
    applyCarPhysics(G, car, 0, 0, true, dt);
    return;
  }
  if (car.health <= 5) {
    car.active = false;
    car.health = 0;
    G.toast('Interceptor wrecked!');
    return;
  }
  const pos = car.mesh.position;
  const target = G.playerPos().clone();
  if (G.player.car) {
    target.x += G.player.car.vel.x * 0.45;
    target.z += G.player.car.vel.z * 0.45;
  }
  const desired = Math.atan2(target.x - pos.x, target.z - pos.z);
  let dh = desired - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dh * 2.4));
  const dist = pos.distanceTo(target);
  let throttle = 1;
  if (dist < 5 && !G.player.car) throttle = 0.1;       // on foot: pull up alongside
  if (Math.abs(dh) > 2.4) throttle = -0.6;             // overshot: reverse out
  applyCarPhysics(G, car, throttle, steer, Math.abs(dh) > 1.1 && car.speed > 12, dt);
}

/** Foot officers close in; at five stars they also fire warning shots that can hit. */
export function stepOfficers(G, dt) {
  const playerPos = G.playerPos();
  for (const o of G.officers) {
    const pos = o.mesh.position;
    const dist = pos.distanceTo(playerPos);
    const heading = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
    o.heading = heading;
    o.mesh.rotation.y = heading;
    if (dist > 2.3 && !G.player.car) {
      pos.x += Math.sin(heading) * 5.4 * dt;
      pos.z += Math.cos(heading) * 5.4 * dt;
      G.cityCollide(pos, 0.5);
      o.walkPhase += dt * 10;
      animatePersonWalk(o.mesh, o.walkPhase, 1);
    }
    if (G.wanted.stars >= 5 && dist < 30 && dist > 6) {
      o.shootCd -= dt;
      if (o.shootCd <= 0) {
        o.shootCd = 1.8 + G.rng() * 1.6;
        G.sound.gunshot(true);
        if (G.rng() < 0.16) G.damagePlayer(3 + G.rng() * 4, pos);
      }
    }
  }
}

/**
 * The bust meter: police holding you at close range fills it; breaking away
 * drains it. Filling it ends the run — see play.js onBusted.
 */
export function updateBustMeter(G, dt) {
  const playerPos = G.playerPos();
  let held = false;
  if (!G.player.car) {
    for (const o of G.officers) if (o.mesh.position.distanceTo(playerPos) < 2.8) held = true;
    for (const c of G.cops) {
      if (c.active && Math.abs(c.speed) < 3 && c.mesh.position.distanceTo(playerPos) < 6.5) held = true;
    }
  } else if (Math.abs(G.player.car.speed) < 2.2) {
    for (const c of G.cops) {
      if (c.active && c.mesh.position.distanceTo(playerPos) < 8) held = true;
    }
  }
  if (G.wanted.stars === 0) held = false;
  G.bustMeter = Math.max(0, Math.min(3, G.bustMeter + (held ? dt : -dt * 0.8)));
  if (G.bustMeter >= 3) G.onBusted();
}
