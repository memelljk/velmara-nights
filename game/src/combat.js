// combat.js — fists and the pistol: mouse-aimed shooting with tracers and
// muzzle flash, reloading, melee, robbing pedestrians at gunpoint, and the
// armed dock crew who shoot back when Velmara pushes its luck.

import { makePersonMesh, animatePersonWalk } from './avatar.js';
import { knockDownPed } from './crowds.js';

export const MAG_SIZE = 12;

export function createThug(THREE, scene, x, z, turf) {
  const mesh = makePersonMesh(THREE, { shirt: 0x1c1c22, pants: 0x14141a, skin: 0xa87652 });
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x0a0a0c }));
  gun.position.set(0.42, 1.15, 0.3);
  mesh.add(gun);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, turf,
    health: 100,
    dead: false,
    aggro: false,
    heading: Math.random() * Math.PI * 2,
    walkPhase: 0,
    shootCd: 1 + Math.random() * 1.5,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    removeAt: 0,
  };
}

function muzzleOf(G) {
  const p = G.playerPos();
  const f = { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
  if (G.player.car) return new G.THREE.Vector3(p.x + f.x * 2.4, 1.1, p.z + f.z * 2.4);
  return new G.THREE.Vector3(p.x + f.x * 0.5, 1.32, p.z + f.z * 0.5);
}

function spawnTracer(G, from, to, color = 0xffe9a8) {
  const geo = new G.THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new G.THREE.Line(geo, new G.THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.95,
  }));
  G.scene.add(line);
  G.fx.tracers.push({ line, life: 0.07 });
}

function spawnFlash(G, at) {
  G.fx.flash.position.copy(at);
  G.fx.flash.intensity = 2.6;
}

/** One trigger pull. Called by play.js on mouse down while playing on foot. */
export function playerShoot(G) {
  if (G.player.car || G.reloading > 0) return;
  if (G.ammo <= 0) {
    G.sound.dryFire();
    startReload(G);
    return;
  }
  G.ammo--;
  G.sound.gunshot(false);
  G.lastShotAt = G.time;
  const origin = G.camera.position.clone();
  const dir = new G.THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const muzzle = muzzleOf(G);
  spawnFlash(G, muzzle);
  G.panicAt = G.playerPos().clone();
  G.panicUntil = G.time + 2.5;
  G.reportCrime('gunfire', G.playerPos());

  // what did the crosshair hit? test people first, then cars, then the city
  const from = G.playerPos();
  let bestT = 95, bestHit = null, bestKind = null;
  const testPoint = (center, radius, kind, ref) => {
    const toC = center.clone().sub(origin);
    const t = toC.dot(dir);
    if (t < 1 || t > bestT) return;
    const closest = origin.clone().add(dir.clone().multiplyScalar(t));
    if (closest.distanceTo(center) < radius) { bestT = t; bestHit = closest; bestKind = kind; void ref; }
  };
  for (const thug of G.thugs) {
    if (thug.dead) continue;
    const c = thug.mesh.position.clone(); c.y = 1.1;
    const before = bestT;
    testPoint(c, 0.75, 'thug', thug);
    if (bestT !== before) bestKind = { kind: 'thug', ref: thug };
  }
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const c = ped.mesh.position.clone(); c.y = 1.1;
    const before = bestT;
    testPoint(c, 0.7, 'ped', ped);
    if (bestT !== before) bestKind = { kind: 'ped', ref: ped };
  }
  for (const car of G.cars) {
    const c = car.mesh.position.clone(); c.y = 0.8;
    const before = bestT;
    testPoint(c, 2.3, 'car', car);
    if (bestT !== before) bestKind = { kind: 'car', ref: car };
  }
  void from;
  const end = bestHit || origin.clone().add(dir.multiplyScalar(95));
  spawnTracer(G, muzzle, end);

  if (!bestKind) return;
  if (bestKind.kind === 'thug') {
    const thug = bestKind.ref;
    thug.health -= 40;
    thug.aggro = true;
    thug.mesh.position.x += dir.x * 0.3;
    thug.mesh.position.z += dir.z * 0.3;
    if (thug.health <= 0) killThug(G, thug);
  } else if (bestKind.kind === 'ped') {
    knockDownPed(G, bestKind.ref, true);
    G.reportCrime('murder', bestKind.ref.mesh.position);
  } else if (bestKind.kind === 'car') {
    const car = bestKind.ref;
    car.health = Math.max(0, car.health - 7);
    if (car.kind === 'traffic' && car.ai) car.ai.panic = 3;
    if (car.kind === 'police') G.reportCrime('shotPolice', car.mesh.position);
  }
}

export function startReload(G) {
  if (G.reloading > 0 || G.ammo === MAG_SIZE || G.reserveAmmo <= 0) return;
  G.reloading = 1.15;
  G.sound.reload();
}

function killThug(G, thug) {
  thug.dead = true;
  thug.mesh.rotation.x = Math.PI / 2;
  thug.mesh.position.y = 0.25;
  thug.removeAt = G.time + 16;
  const loot = 25 + Math.floor(G.rng() * 70);
  G.earnCash(loot);
  G.reserveAmmo += 4;
  G.toast(`Crew member down · +$${loot}`);
  G.storyEvent('thugDown');
}

/** F key: rob the nearest pedestrian at gunpoint, or swing at a nearby thug. */
export function playerMeleeOrRob(G) {
  const pos = G.playerPos();
  if (G.player.car) return;
  let nearThug = null, nearPed = null;
  for (const t of G.thugs) {
    if (!t.dead && t.mesh.position.distanceTo(pos) < 2.4) nearThug = t;
  }
  for (const p of G.peds) {
    if (!p.dead && p.mesh.position.distanceTo(pos) < 2.6) nearPed = p;
  }
  if (nearThug) {
    G.sound.punch();
    nearThug.health -= 55;
    nearThug.aggro = true;
    nearThug.mesh.position.x += Math.sin(G.player.heading) * 0.8;
    nearThug.mesh.position.z += Math.cos(G.player.heading) * 0.8;
    if (nearThug.health <= 0) killThug(G, nearThug);
    return;
  }
  if (nearPed) {
    if (nearPed.robbed) {
      G.toast('They have nothing left to give.');
      return;
    }
    nearPed.robbed = true;
    const take = nearPed.cash;
    nearPed.cash = 0;
    nearPed.state = 'flee';
    nearPed.calmTimer = 3.5;
    G.earnCash(take);
    G.sound.cash();
    G.toast(`Robbed +$${take} — they will remember the jacket.`);
    G.reportCrime('robbery', pos);
    return;
  }
  G.sound.punch();
}

/** Thug behaviour: hold a firing distance, strafe, shoot in bursts. */
export function stepThugs(G, dt) {
  const playerPos = G.playerPos();
  for (const thug of G.thugs) {
    if (thug.dead) continue;
    const pos = thug.mesh.position;
    const dist = pos.distanceTo(playerPos);

    if (!thug.aggro) {
      // turf guards turn hostile if you crowd them or open fire nearby
      if (dist < 7.5 || (G.lastShotAt && G.time - G.lastShotAt < 2 && dist < 24)) {
        thug.aggro = true;
        G.toast('The dock crew opens fire!');
      } else {
        thug.heading += Math.sin(G.time * 0.4 + thug.walkPhase) * dt * 0.4;
        thug.mesh.rotation.y = thug.heading;
        continue;
      }
    }
    if (dist > 60) { thug.aggro = false; continue; }

    // face the player, keep 9–15 units, strafe sideways
    const toPlayer = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
    thug.heading = toPlayer;
    thug.mesh.rotation.y = toPlayer;
    let moveX = 0, moveZ = 0;
    if (dist > 15) { moveX += Math.sin(toPlayer); moveZ += Math.cos(toPlayer); }
    else if (dist < 8) { moveX -= Math.sin(toPlayer); moveZ -= Math.cos(toPlayer); }
    moveX += Math.cos(toPlayer) * thug.strafeDir * 0.7;
    moveZ -= Math.sin(toPlayer) * thug.strafeDir * 0.7;
    if (G.rng() < dt * 0.25) thug.strafeDir *= -1;
    const ml = Math.hypot(moveX, moveZ) || 1;
    pos.x += (moveX / ml) * 3.1 * dt;
    pos.z += (moveZ / ml) * 3.1 * dt;
    G.cityCollide(pos, 0.5);
    thug.walkPhase += dt * 6;
    animatePersonWalk(thug.mesh, thug.walkPhase, 0.8);

    thug.shootCd -= dt;
    if (thug.shootCd <= 0 && dist < 34) {
      thug.shootCd = 1.1 + G.rng() * 1.3;
      G.sound.gunshot(true);
      const from = pos.clone(); from.y = 1.3;
      const target = playerPos.clone(); target.y = 1.1;
      target.x += (G.rng() - 0.5) * 2.4;
      target.z += (G.rng() - 0.5) * 2.4;
      spawnTracer(G, from, target, 0xff9a7a);
      spawnFlash(G, from);
      // hit chance falls with distance and if the player is moving fast
      const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : (G.player.moving ? 6 : 0);
      const hitChance = Math.max(0.06, 0.42 - dist * 0.008 - playerSpeed * 0.008);
      if (G.rng() < hitChance) G.damagePlayer(4 + G.rng() * 6, pos);
    }
  }
}

/** Reloads, tracers and the muzzle-flash light decay. */
export function updateCombatFx(G, dt) {
  if (G.reloading > 0) {
    G.reloading -= dt;
    if (G.reloading <= 0) {
      const take = Math.min(MAG_SIZE - G.ammo, G.reserveAmmo);
      G.ammo += take;
      G.reserveAmmo -= take;
    }
  }
  for (let i = G.fx.tracers.length - 1; i >= 0; i--) {
    const tr = G.fx.tracers[i];
    tr.life -= dt;
    tr.line.material.opacity = Math.max(0, tr.life / 0.07) * 0.95;
    if (tr.life <= 0) {
      G.scene.remove(tr.line);
      tr.line.geometry.dispose();
      tr.line.material.dispose();
      G.fx.tracers.splice(i, 1);
    }
  }
  if (G.fx.flash) G.fx.flash.intensity = Math.max(0, G.fx.flash.intensity - dt * 30);
}
