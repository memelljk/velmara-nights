// snapshots.js — the four deterministic screenshot scenes (?shot=cover|chase|
// onfoot|mission, always with the caller's seed). Each scene stages the real
// game — real traffic, real police, real HUD — at a photogenic moment, runs a
// short scripted beat, then flags window.__shotReady for the camera script.

import { CAR_MODELS, createCar } from './drive.js';
import { POLICE_MODEL } from './drive.js';
import { createPedestrian } from './crowds.js';

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
  car.active = true;
  car.vel.x = Math.sin(heading) * speed;
  car.vel.z = Math.cos(heading) * speed;
  car.speed = speed;
  G.cars.push(car);
  G.cops.push(car);
  return car;
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
    heroCar(G, 'Bantam Hatch', 0xe0a428, -3.6, 6, 0, 12);
    heroCar(G, 'Mirella Wagon', 0x587858, 3.6, -84, Math.PI, 9);
    G.camYaw = Math.PI + 0.35;
    G.camPitch = 0.24;
    G.story.phase = 'meet';
  },
  // Four stars, interceptors on the bumper, blips crowding the minimap.
  chase(G) {
    const hero = heroCar(G, 'Kestrel Coupe', 0xd84040, -20, 52.6, Math.PI / 2, 24);
    putPlayerInCar(G, hero);
    copCar(G, -38, 49, Math.PI / 2, 25);
    copCar(G, -44, 57, Math.PI / 2, 23);
    copCar(G, -30, 62, Math.PI / 2, 22);
    copCar(G, -52, 52, Math.PI / 2, 24);
    G.wanted.heat = 100;
    G.wanted.stars = 4;
    G.wanted.lastCrimeAt = 0;
    G.camYaw = -Math.PI / 2 + 0.4;
    G.camPitch = 0.22;
    G.story.phase = 'free';
  },
  // On foot in the Old Market: crowd, stalls, Odile mid-sentence.
  onfoot(G) {
    G.player.mesh.position.set(99, 0, 33);
    G.player.heading = -0.7;
    for (let i = 0; i < 7; i++) {
      const ped = createPedestrian(G.THREE, G.scene, G.rng, 92 + i * 3.4, 18 + (i % 3) * 7);
      G.peds.push(ped);
    }
    G.camYaw = 2.5;
    G.camPitch = 0.18;
    G.story.phase = 'meet';
    G.showDialogue([
      ['Odile Vane', 'The market crew pays in cash and questions, Jax. Take the parcel, smile at no one, and keep the jacket dry.'],
      ['Jax Rook', 'Smile at no one. Got it.'],
    ], () => {});
  },
  // Harbor delivery mid-mission: countdown burning, vault in view.
  mission(G) {
    const hero = heroCar(G, 'Dockmaster Pickup', 0x986838, 8, 176, 0, 15);
    putPlayerInCar(G, hero);
    heroCar(G, 'Solace Sedan', 0x3a3f4a, -3.6, 140, 0, 10);
    const st = G.story;
    st.idx = 1;
    st.phase = 'active';
    st.step = 1;
    st.stepTimer = 96;
    st.stepSpawned = true;
    G.camYaw = Math.PI + 0.3;
    G.camPitch = 0.26;
  },
};

export function setupShotScene(G, name) {
  const scene = SCENES[name] || SCENES.cover;
  G.shotName = name;
  G.shotFrame = 0;
  scene(G);
}

/** Runs after the world update each shot-mode frame; stages late beats. */
export function updateShotScene(G) {
  G.shotFrame++;
  if (G.shotName === 'cover' && G.shotFrame === 40) {
    G.showBanner('FIRST PARCEL', 'New job from Odile Vane — the Neon Mile');
  }
  if (G.shotName === 'chase') {
    G.setObjective('Lose the police — break sight and lie low!', null);
    G.wanted.heat = Math.max(G.wanted.heat, 95);
    G.wanted.stars = 4;
  }
  if (G.shotName === 'onfoot') {
    G.setObjective('First Parcel — Pick up the parcel at the Old Market stalls', G.city.marketPos);
  }
  if (G.shotFrame === 55) window.__shotReady = true;
}
