// snapshots.js — the four screenshot scenes (?shot=cover|chase|onfoot|mission,
// always with the caller's seed). Each scene is POSED, not simulated: every
// car, cruiser, pedestrian, star and HUD value is placed directly, a few
// frames are rendered so lights flash and wheels settle, and then
// window.__shotReady tells the camera script to take its one picture.

import { CAR_MODELS, createCar, POLICE_MODEL } from './drive.js';
import { createPedestrian } from './crowds.js';
import { makePersonMesh } from './avatar.js';

function heroCar(G, modelName, color, x, z, heading, speed) {
  const model = CAR_MODELS.find((m) => m.name === modelName);
  const car = createCar(G.THREE, G.scene, model, color, x, z, heading, 'parked');
  car.stolen = true;
  car.vel.x = Math.sin(heading) * speed;
  car.vel.z = Math.cos(heading) * speed;
  car.speed = speed;
  G.cars.push(car);
  return car;
}

function copCar(G, x, z, heading, speed) {
  const car = createCar(G.THREE, G.scene, POLICE_MODEL, 0xffffff, x, z, heading, 'police');
  car.active = true; // light bar flashing
  car.vel.x = Math.sin(heading) * speed;
  car.vel.z = Math.cos(heading) * speed;
  car.speed = speed;
  G.cars.push(car);
  G.cops.push(car);
  return car;
}

function posedOfficer(G, x, z, heading) {
  const mesh = makePersonMesh(G.THREE, { shirt: 0x1c3fae, pants: 0x141c33, skin: 0xd9a878, cap: 0x101c3a });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  G.officers.push({ mesh, heading, walkPhase: 0, shootCd: 3 });
}

function putPlayerInCar(G, car) {
  G.player.car = car;
  car.occupied = true;
  G.player.mesh.visible = false;
}

const SCENES = {
  // Driving the Neon Mile in the rain, traffic around, job banner up.
  cover(G) {
    const hero = heroCar(G, 'Orphee GT', 0xff3d8a, -3.6, -46, 0, 17);
    putPlayerInCar(G, hero);
    heroCar(G, 'Solace Sedan', 0x284858, 3.6, -18, Math.PI, 10);
    heroCar(G, 'Bantam Hatch', 0xe0a428, -3.6, 8, 0, 12);
    heroCar(G, 'Mirella Wagon', 0x587858, 3.6, -84, Math.PI, 9);
    G.camYaw = Math.PI + 0.35;
    G.camPitch = 0.24;
    G.story.phase = 'meet';
  },
  // Four stars, interceptors on the bumper, an officer cutting across.
  chase(G) {
    const hero = heroCar(G, 'Kestrel Coupe', 0xd84040, -20, 52.6, Math.PI / 2, 24);
    putPlayerInCar(G, hero);
    copCar(G, -38, 49, Math.PI / 2, 25);
    copCar(G, -44, 57, Math.PI / 2, 23);
    copCar(G, -30, 62, Math.PI / 2, 22);
    copCar(G, -52, 52, Math.PI / 2, 24);
    posedOfficer(G, -31, 43, Math.PI / 2);
    G.cash = 486;
    G.rep = 64;
    G.clockMinutes = 22 * 60 + 47;
    G.wanted.heat = 100;
    G.wanted.stars = 4;
    G.wanted.lastCrimeAt = 0;
    // front three-quarter camera: the hero comes at us, cruisers behind it
    G.camYaw = Math.PI / 2 + 0.35;
    G.camPitch = 0.22;
    G.story.phase = 'free';
  },
  // On foot in the Old Market: crowd, stalls, Odile mid-sentence.
  onfoot(G) {
    // stand in the avenue south of the stalls, facing them; camera behind
    G.player.mesh.position.set(104, 0, 38);
    G.player.heading = Math.PI;
    G.cash = 215;
    G.clockMinutes = 20 * 60 + 38;
    for (let i = 0; i < 7; i++) {
      const ped = createPedestrian(G.THREE, G.scene, G.rng, 95 + i * 3.1, 16 + (i % 3) * 6.5);
      G.peds.push(ped);
    }
    heroCar(G, 'Bantam Hatch', 0x68b8d8, 90, 46.5, Math.PI / 2, 0);
    G.camYaw = 0.15;
    G.camPitch = 0.16;
    G.story.phase = 'meet';
    G.showDialogue([
      ['Odile Vane', 'The market crew pays in cash and questions, Jax. Take the parcel, smile at no one, and keep the jacket dry.'],
      ['Jax Rook', 'Smile at no one. Got it.'],
    ], () => {});
  },
  // Harbor delivery mid-mission: countdown burning, vault in view.
  mission(G) {
    // mid-avenue on the harbor run: open road, cranes and water ahead
    const hero = heroCar(G, 'Dockmaster Pickup', 0x986838, -3.6, 168, 0, 16);
    putPlayerInCar(G, hero);
    heroCar(G, 'Solace Sedan', 0x3a3f4a, 3.6, 216, Math.PI, 10);
    G.cash = 640;
    G.rep = 88;
    G.clockMinutes = 23 * 60 + 5;
    const st = G.story;
    st.idx = 1;
    st.phase = 'active';
    st.step = 1;
    st.stepTimer = 96;
    st.stepSpawned = true;
    G.camYaw = Math.PI + 0.15;
    G.camPitch = 0.24;
  },
};

export function setupShotScene(G, name) {
  const scene = SCENES[name] || SCENES.cover;
  G.shotName = name;
  G.shotFrame = 0;
  scene(G);
}

/** Runs after the world update each shot-mode frame; stages the late beats. */
export function updateShotScene(G) {
  G.shotFrame++;
  if (G.shotName === 'cover' && G.shotFrame === 2) {
    G.showBanner('FIRST PARCEL', 'New job from Odile Vane — the Neon Mile');
    G.ui.bannerUntil = G.time + 30; // hold the banner for the camera
  }
  if (G.shotName === 'chase') {
    G.setObjective('Lose the police — break sight and lie low!', null);
    G.wanted.heat = Math.max(G.wanted.heat, 95);
    G.wanted.stars = 4;
  }
  if (G.shotName === 'onfoot') {
    G.setObjective('First Parcel — Pick up the parcel at the Old Market stalls', G.city.marketPos);
  }
  if (G.shotFrame === 8) window.__shotReady = true;
}
