// avatar.js — Jax Rook on foot: the person-mesh factory every human in Velmara
// shares, the third-person on-foot controller (WASD + mouse-orbit camera,
// sprinting, walk-cycle animation) and getting in and out of cars — including
// pulling a driver out of theirs.

/** A low-poly person with swinging limbs. Returns a Group whose userData holds
 *  the limb pivots the walk cycle animates. */
export function makePersonMesh(THREE, outfit) {
  const person = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: outfit.shirt });
  const pants = new THREE.MeshLambertMaterial({ color: outfit.pants });
  const skin = new THREE.MeshLambertMaterial({ color: outfit.skin });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.82, 0.36), shirt);
  torso.position.y = 1.06;
  person.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.4), skin);
  head.position.y = 1.72;
  person.add(head);
  if (outfit.cap !== undefined) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46),
      new THREE.MeshLambertMaterial({ color: outfit.cap }));
    cap.position.y = 1.98;
    person.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.3),
      new THREE.MeshLambertMaterial({ color: outfit.cap }));
    brim.position.set(0, 1.93, 0.34);
    person.add(brim);
  }
  const limb = (mat, w, len) => {
    const pivot = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    box.position.y = -len / 2;
    pivot.add(box);
    return pivot;
  };
  const legL = limb(pants, 0.2, 0.68); legL.position.set(-0.17, 0.68, 0);
  const legR = limb(pants, 0.2, 0.68); legR.position.set(0.17, 0.68, 0);
  const armL = limb(shirt, 0.16, 0.62); armL.position.set(-0.42, 1.42, 0);
  const armR = limb(shirt, 0.16, 0.62); armR.position.set(0.42, 1.42, 0);
  person.add(legL, legR, armL, armR);
  person.userData.limbs = { legL, legR, armL, armR };
  person.userData.torso = torso;
  return person;
}

/** Swing limbs for a walker/runner; phase advances with distance travelled. */
export function animatePersonWalk(mesh, phase, strength = 1) {
  const { legL, legR, armL, armR } = mesh.userData.limbs;
  const s = Math.sin(phase) * 0.55 * strength;
  legL.rotation.x = s;
  legR.rotation.x = -s;
  armL.rotation.x = -s * 0.8;
  armR.rotation.x = s * 0.8;
}

export function createPlayer(THREE, scene) {
  const mesh = makePersonMesh(THREE, { shirt: 0x0f7d8c, pants: 0x23232e, skin: 0xc98d64, cap: 0xff3d8a });
  mesh.position.set(10, 0, 44);
  scene.add(mesh);
  return {
    mesh,
    heading: Math.PI,
    walkPhase: 0,
    car: null,
    moving: 0,
  };
}

/** WASD movement relative to the camera yaw, with building collision. */
export function stepPlayerOnFoot(G, dt) {
  const player = G.player;
  const pos = player.mesh.position;
  let ix = 0, iz = 0;
  if (G.keys.KeyW || G.keys.ArrowUp) iz -= 1;
  if (G.keys.KeyS || G.keys.ArrowDown) iz += 1;
  if (G.keys.KeyA || G.keys.ArrowLeft) ix -= 1;
  if (G.keys.KeyD || G.keys.ArrowRight) ix += 1;
  const sprint = G.keys.ShiftLeft || G.keys.ShiftRight;
  player.moving = 0;
  if (ix !== 0 || iz !== 0) {
    const len = Math.hypot(ix, iz);
    ix /= len; iz /= len;
    const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    const wx = ix * cos - iz * sin;
    const wz = ix * sin + iz * cos;
    const speed = sprint ? 11.5 : 6.8;
    pos.x += wx * speed * dt;
    pos.z += wz * speed * dt;
    const targetHeading = Math.atan2(wx, wz);
    let dh = targetHeading - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += dh * Math.min(1, dt * 14);
    player.walkPhase += dt * (sprint ? 13 : 9.5);
    player.moving = sprint ? 1.4 : 1;
  } else {
    player.walkPhase += dt * 1.2;
  }
  animatePersonWalk(player.mesh, player.walkPhase, player.moving > 0 ? 1 : 0.06);
  player.mesh.rotation.y = player.heading;
  G.cityCollide(pos, 0.55);
  pos.x = Math.max(-242, Math.min(242, pos.x));
  pos.z = Math.max(-242, Math.min(244, pos.z));
  player.mesh.position.y = 0;
}

/** The car the player could get into right now, or null. */
export function nearestEnterableCar(G, maxDist = 3.6) {
  const pos = G.player.mesh.position;
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car === G.player.car) continue;
    const d = car.mesh.position.distanceTo(pos);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/**
 * E key: climb out of the current car, or climb into the nearest one.
 * Stealing a moving traffic car means dragging its driver out (a crime);
 * a parked car is a quieter theft. Police cars are never locked to you —
 * but taking one is very loud indeed.
 */
export function enterExitCar(G) {
  const player = G.player;
  if (player.car) {
    const car = player.car;
    player.car = null;
    car.occupied = false;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    player.mesh.position.set(
      car.mesh.position.x + side.x * 2.4,
      0,
      car.mesh.position.z + side.z * 2.4,
    );
    player.mesh.visible = true;
    G.cityCollide(player.mesh.position, 0.55);
    G.sound.carDoor();
    G.sound.setEngine(0, false);
    return;
  }
  const car = nearestEnterableCar(G);
  if (!car) return;
  if (car.kind === 'traffic') {
    G.ejectDriver(car);
    G.reportCrime('carjack', car.mesh.position);
  } else if (car.kind === 'parked') {
    if (!car.stolen) {
      car.stolen = true;
      G.reportCrime('theft', car.mesh.position);
    }
  } else if (car.kind === 'police') {
    G.reportCrime('policeTheft', car.mesh.position);
  }
  if (car === G.missionCar) G.storyEvent('enteredMissionCar');
  player.car = car;
  car.occupied = true;
  player.mesh.visible = false;
  G.sound.carDoor();
}
