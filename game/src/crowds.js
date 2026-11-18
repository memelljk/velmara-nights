// crowds.js — Velmara's pedestrians: citizens who stroll the sidewalks,
// cross at corners, scatter when shots ring out or a car mounts the pavement,
// and — if you point a pistol at them (F) — hand over their cash.

import { AVENUES } from './citygen.js';
import { makePersonMesh, animatePersonWalk } from './avatar.js';

const SKIN_TONES = [0xf0c8a0, 0xc98d64, 0x8a5a3b, 0x6e4530, 0xffd9b3];
const SHIRTS = [0xd84a6e, 0x4a7ad8, 0x58b368, 0xe0a428, 0x9a6ee8, 0xe4e0d8, 0x3fb8af, 0xd8703a, 0x707888];
const PANTS = [0x23232e, 0x3a3f52, 0x5a4632, 0x2e4a3a, 0x484048];

export function createPedestrian(THREE, scene, rng, x, z) {
  const outfit = {
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
  };
  if (rng() < 0.3) outfit.cap = SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const mesh = makePersonMesh(THREE, outfit);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const ped = {
    mesh,
    heading: rng() * Math.PI * 2,
    walkPhase: rng() * 6,
    state: 'walk',          // walk | flee | down
    speed: 1.6 + rng() * 1.1,
    lineAxis: rng() < 0.5 ? 'x' : 'z',
    lineCoord: 0,
    targetAlong: 0,
    cash: 8 + Math.floor(rng() * 60),
    robbed: false,
    calmTimer: 0,
    dead: false,
  };
  snapPedToSidewalk(ped, rng);
  return ped;
}

/** Sidewalks run at avenue ± 9.6. Put the ped on one and pick a stroll target. */
export function snapPedToSidewalk(ped, rng) {
  const pos = ped.mesh.position;
  const nearest = (v) => AVENUES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), AVENUES[0]);
  if (ped.lineAxis === 'z') {
    ped.lineCoord = nearest(pos.x) + (rng() < 0.5 ? -9.6 : 9.6);
    pos.x = ped.lineCoord;
    ped.targetAlong = Math.max(-230, Math.min(230, pos.z + (rng() - 0.5) * 160));
  } else {
    ped.lineCoord = nearest(pos.z) + (rng() < 0.5 ? -9.6 : 9.6);
    pos.z = ped.lineCoord;
    ped.targetAlong = Math.max(-230, Math.min(230, pos.x + (rng() - 0.5) * 160));
  }
}

export function spawnCrowds(G, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const avenue = AVENUES[Math.floor(G.rng() * AVENUES.length)];
    const along = -225 + G.rng() * 450;
    const x = G.rng() < 0.5 ? avenue : along;
    const z = G.rng() < 0.5 ? along : avenue;
    peds.push(createPedestrian(G.THREE, G.scene, G.rng, x, z));
  }
  return peds;
}

export function stepPedestrians(G, dt) {
  const playerPos = G.playerPos();
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const pos = ped.mesh.position;

    // run over by a moving car?
    let hitByCar = null;
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 7) continue;
      if (car.mesh.position.distanceTo(pos) < 1.9) { hitByCar = car; break; }
    }
    if (hitByCar) {
      knockDownPed(G, ped, true);
      if (hitByCar === G.player.car) G.reportCrime('hitAndRun', pos);
      continue;
    }

    const distPlayer = pos.distanceTo(playerPos);
    const scared = (G.panicAt && pos.distanceTo(G.panicAt) < 20) ||
      (G.playerAiming && distPlayer < 9) ||
      (G.player.car && distPlayer < 7 && Math.abs(G.player.car.speed) > 9);

    if (scared && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.calmTimer = 2.2 + G.rng() * 2;
    }

    if (ped.state === 'flee') {
      ped.calmTimer -= dt;
      const threat = G.panicAt && pos.distanceTo(G.panicAt) < 22 ? G.panicAt : playerPos;
      const away = Math.atan2(pos.x - threat.x, pos.z - threat.z);
      movePed(G, ped, away, 6.4, dt);
      if (ped.calmTimer <= 0 && !scared) {
        ped.state = 'walk';
        snapPedToSidewalk(ped, G.rng);
      }
      continue;
    }

    // stroll along the sidewalk line; at the end, turn or cross the street
    const along = ped.lineAxis === 'z' ? pos.z : pos.x;
    const remaining = ped.targetAlong - along;
    if (Math.abs(remaining) < 1.2) {
      if (G.rng() < 0.45) ped.lineAxis = ped.lineAxis === 'z' ? 'x' : 'z';
      snapPedToSidewalk(ped, G.rng);
      continue;
    }
    const dirSign = Math.sign(remaining);
    const heading = ped.lineAxis === 'z'
      ? (dirSign > 0 ? 0 : Math.PI)
      : (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2);
    movePed(G, ped, heading, ped.speed, dt);
  }
}

function movePed(G, ped, targetHeading, speed, dt) {
  let dh = targetHeading - ped.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  ped.heading += dh * Math.min(1, dt * 8);
  const pos = ped.mesh.position;
  pos.x += Math.sin(ped.heading) * speed * dt;
  pos.z += Math.cos(ped.heading) * speed * dt;
  G.cityCollide(pos, 0.5);
  pos.x = Math.max(-242, Math.min(242, pos.x));
  pos.z = Math.max(-242, Math.min(244, pos.z));
  ped.walkPhase += dt * speed * 1.9;
  animatePersonWalk(ped.mesh, ped.walkPhase, 1);
  ped.mesh.rotation.y = ped.heading;
}

/** A pedestrian goes down — run over, shot or beaten. Stays down, then despawns via play.js housekeeping. */
export function knockDownPed(G, ped, lethal) {
  if (ped.dead) return;
  ped.dead = true;
  ped.state = 'down';
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.25;
  ped.removeAt = G.time + 14;
  if (lethal) {
    G.panicAt = ped.mesh.position.clone();
    G.panicUntil = G.time + 3;
  }
}
