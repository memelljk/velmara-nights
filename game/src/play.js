// play.js — Velmara Nights' entry point: builds the world, owns the shared
// game state every module reads, runs the frame loop (title / play / pause /
// busted-wasted / screenshot modes), the third-person camera, input, saving,
// and the consequences: crashes, damage, BUSTED and WASTED.

import { SoundLab } from './soundlab.js';
import { buildCity, makeSeededRng, collideWithBuildings, districtAt } from './citygen.js';
import { CAR_MODELS, createCar, giveTrafficRoute, stepTrafficCar, stepPlayerCar, updateCarFleet, applyCarPhysics } from './drive.js';
import { createPlayer, stepPlayerOnFoot, nearestEnterableCar, enterExitCar } from './avatar.js';
import { spawnCrowds, stepPedestrians, createPedestrian } from './crowds.js';
import { playerShoot, playerMeleeOrRob, startReload, stepThugs, updateCombatFx, createThug, MAG_SIZE } from './combat.js';
import { CRIME_HEAT, updateWanted, stepPoliceCar, stepOfficers, updateBustMeter, clearPolice } from './law.js';
import { initStory, updateStory, storyEvent } from './story.js';
import { initInterface, updateHud, showEndScreen, hideEndScreen } from './interface.js';
import { setupShotScene, updateShotScene } from './snapshots.js';

const SAVE_KEY = 'velmara-nights-save-v1';
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7) >>> 0;
const SHOT = params.get('shot');

const G = {
  THREE: window.THREE,
  time: 0,
  clockMinutes: 21 * 60 + 12,
  mode: 'title',
  keys: {},
  keyEdges: new Set(),
  camYaw: Math.PI + 0.4,
  camPitch: 0.24,
  cash: 120,
  rep: 0,
  health: 100,
  ammo: MAG_SIZE,
  reserveAmmo: 48,
  reloading: 0,
  wanted: { heat: 0, stars: 0, lastCrimeAt: -99, spawnCd: 0 },
  bustMeter: 0,
  cars: [], peds: [], thugs: [], cops: [], officers: [],
  fx: { tracers: [], flash: null },
  panicAt: null, panicUntil: 0,
  lastShotAt: -99,
  playerAiming: false,
  dialogueActive: false,
  bigMapOpen: false,
  damageFlash: 0,
  shake: 0,
  missionCar: null,
  overTimer: 0,
  overKind: null,
  saveTimer: 0,
  rng: makeSeededRng(SEED),
};
window.__velmara = G;

// ---------- world construction ----------

const renderer = new G.THREE.WebGLRenderer({ canvas: document.getElementById('view3d'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
G.renderer = renderer;

const scene = new G.THREE.Scene();
scene.background = new G.THREE.Color(0x07040f);
scene.fog = new G.THREE.FogExp2(0x0a0618, 0.0046);
G.scene = scene;

const camera = new G.THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 26, -60);
G.camera = camera;

scene.add(new G.THREE.HemisphereLight(0x3d4a7d, 0x0b0916, 1.02));
const moon = new G.THREE.DirectionalLight(0x8fb4ff, 0.68);
moon.position.set(80, 160, -60);
scene.add(moon);
const mileGlow = new G.THREE.PointLight(0xff3d8a, 0.9, 120);
mileGlow.position.set(0, 16, -10);
scene.add(mileGlow);
const harborGlow = new G.THREE.PointLight(0x2ee6ff, 0.7, 110);
harborGlow.position.set(30, 14, 205);
scene.add(harborGlow);
const marketGlow = new G.THREE.PointLight(0xffc857, 0.65, 90);
marketGlow.position.set(104, 12, 26);
scene.add(marketGlow);

G.city = buildCity(G.THREE, scene, G.rng);
G.cityCollide = (pos, radius) => collideWithBuildings(G.city, pos, radius);
G.sound = new SoundLab();

G.player = createPlayer(G.THREE, scene);
G.playerPos = () => (G.player.car ? G.player.car.mesh.position : G.player.mesh.position);

G.fx.flash = new G.THREE.PointLight(0xffd9a0, 0, 20);
scene.add(G.fx.flash);
const torch = new G.THREE.SpotLight(0xffe6b8, 1.15, 42, 0.52, 0.55, 0.6);
scene.add(torch);
scene.add(torch.target);
G.torch = torch;

// ---------- shared consequences ----------

G.reportCrime = (kind, pos) => {
  const heat = CRIME_HEAT[kind] || 10;
  G.wanted.heat = Math.min(170, G.wanted.heat + heat);
  G.wanted.lastCrimeAt = G.time;
  if (kind === 'murder' || kind === 'carjack' || kind === 'hitAndRun') {
    G.panicAt = (pos && pos.clone) ? pos.clone() : G.playerPos().clone();
    G.panicUntil = G.time + 3;
  }
};

G.earnCash = (n) => { G.cash += n; };

G.damagePlayer = (amount, fromPos) => {
  if (G.mode !== 'play' && G.mode !== 'shot') return;
  void fromPos;
  if (G.player.car) {
    G.player.car.health = Math.max(0, G.player.car.health - amount * 0.8);
    amount *= 0.35;
  }
  G.health -= amount;
  G.damageFlash = Math.min(1, G.damageFlash + 0.55);
  G.shake = Math.min(0.5, G.shake + 0.18);
  if (G.health <= 0 && G.mode === 'play') {
    G.health = 0;
    endRun('wasted');
  }
};

G.onCarCrash = (car, intensity) => {
  G.sound.crash(Math.min(2, intensity / 8));
  if (car === G.player.car) {
    G.shake = Math.min(0.7, intensity * 0.035);
    if (intensity > 13) G.damagePlayer((intensity - 12) * 0.5, car.mesh.position);
  }
};

G.ejectDriver = (car) => {
  const ped = createPedestrian(G.THREE, G.scene, G.rng,
    car.mesh.position.x + 2, car.mesh.position.z + 1);
  ped.state = 'flee';
  ped.calmTimer = 4;
  G.peds.push(ped);
  car.kind = 'parked';
  car.ai = null;
  G.toast('You dragged the driver out — the whole street saw that.');
};

G.removeCar = (car) => {
  G.scene.remove(car.mesh);
  const ci = G.cars.indexOf(car);
  if (ci >= 0) G.cars.splice(ci, 1);
  const pi = G.cops.indexOf(car);
  if (pi >= 0) G.cops.splice(pi, 1);
  if (G.player.car === car) {
    G.player.car = null;
    G.player.mesh.visible = true;
  }
  if (G.missionCar === car) G.missionCar = null;
};

G.storyEvent = (evt) => storyEvent(G, evt);

G.consumeKey = (code) => {
  if (G.keyEdges.has(code)) {
    G.keyEdges.delete(code);
    return true;
  }
  return false;
};

// ---------- saving ----------

G.hasSave = () => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
};
G.saveGame = () => {
  if (G.mode === 'shot') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, rep: G.rep, storyIdx: G.story ? G.story.idx : 0,
      finished: G.story ? G.story.finished : false,
      ammo: G.ammo, reserveAmmo: G.reserveAmmo,
      x: G.player.mesh.position.x, z: G.player.mesh.position.z,
    }));
  } catch { /* private mode: play without saving */ }
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- population ----------

function spawnParkedCars() {
  const spots = [...G.city.parkedSpots];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(G.rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const n = Math.min(17, spots.length);
  for (let i = 0; i < n; i++) {
    const model = CAR_MODELS[Math.floor(G.rng() * CAR_MODELS.length)];
    const color = model.colors[Math.floor(G.rng() * model.colors.length)];
    const s = spots[i];
    G.cars.push(createCar(G.THREE, scene, model, color, s.x, s.z, s.heading, 'parked'));
  }
}

function spawnTrafficCar() {
  const model = CAR_MODELS[Math.floor(G.rng() * CAR_MODELS.length)];
  const color = model.colors[Math.floor(G.rng() * model.colors.length)];
  const car = createCar(G.THREE, scene, model, color, 0, 0, 0, 'traffic');
  giveTrafficRoute(G, car);
  // slide it along its avenue to a spot a good distance from the player
  const p = G.playerPos();
  for (let tries = 0; tries < 8; tries++) {
    const along = -225 + G.rng() * 450;
    if (car.ai.axis === 'z') car.mesh.position.z = along; else car.mesh.position.x = along;
    if (car.mesh.position.distanceTo(p) > 55) break;
  }
  G.cars.push(car);
  return car;
}

function resetPopulation() {
  for (const car of [...G.cars]) G.removeCar(car);
  for (const ped of G.peds) scene.remove(ped.mesh);
  for (const thug of G.thugs) scene.remove(thug.mesh);
  G.peds = [];
  G.thugs = [];
  clearPolice(G);
  spawnParkedCars();
  for (let i = 0; i < 13; i++) spawnTrafficCar();
  G.peds = spawnCrowds(G, 42);
  // ambient dock crew lookouts (the mission brings its own five)
  const c = G.city.dockCrewPos;
  G.thugs.push(createThug(G.THREE, scene, c.x - 16, c.z + 12, 'ambient'));
  G.thugs.push(createThug(G.THREE, scene, c.x + 14, c.z - 10, 'ambient'));
}

/** Keep traffic and crowds flowing around the player; retire the far and dead. */
function housekeeping(dt) {
  const p = G.playerPos();
  let trafficCount = 0;
  for (const car of [...G.cars]) {
    const d = car.mesh.position.distanceTo(p);
    if (car.kind === 'traffic') {
      trafficCount++;
      if (d > 250 || (car.health <= 0 && d > 30)) { G.removeCar(car); trafficCount--; }
    }
    if (car.kind === 'parked' && car.health <= 0 && d > 60) G.removeCar(car);
  }
  G.trafficTimer = (G.trafficTimer || 0) - dt;
  if (trafficCount < 13 && G.trafficTimer <= 0) {
    G.trafficTimer = 1.5;
    spawnTrafficCar();
  }
  for (const ped of [...G.peds]) {
    if (ped.dead && ped.removeAt && G.time > ped.removeAt) {
      scene.remove(ped.mesh);
      G.peds.splice(G.peds.indexOf(ped), 1);
      const avenue = [-208, -156, -104, -52, 0, 52, 104, 156, 208][Math.floor(G.rng() * 9)];
      const fresh = createPedestrian(G.THREE, scene, G.rng,
        p.x + (G.rng() - 0.5) * 60 + (G.rng() < 0.5 ? avenue * 0.2 : 0),
        p.z + (G.rng() - 0.5) * 60);
      G.peds.push(fresh);
    } else if (!ped.dead && ped.mesh.position.distanceTo(p) > 170) {
      ped.mesh.position.set(
        p.x + (G.rng() - 0.5) * 120,
        0,
        p.z + (G.rng() - 0.5) * 120,
      );
      G.cityCollide(ped.mesh.position, 0.5);
    }
  }
  for (const thug of [...G.thugs]) {
    if (thug.dead && thug.removeAt && G.time > thug.removeAt) {
      scene.remove(thug.mesh);
      G.thugs.splice(G.thugs.indexOf(thug), 1);
    }
  }
}

// ---------- run state ----------

function endRun(kind) {
  G.mode = 'over';
  G.overKind = kind;
  G.overTimer = 3;
  if (kind === 'busted') {
    const fine = Math.min(G.cash, 150 + G.wanted.stars * 45);
    G.cash -= fine;
    showEndScreen(G, 'BUSTED', `Velmara PD impounds your ride and fines you $${fine}.`, true);
  } else {
    const fee = Math.min(G.cash, 200);
    G.cash -= fee;
    showEndScreen(G, 'WASTED', `St. Mirella Hospital patches you up for $${fee}.`, false);
  }
  G.sound.setEngine(0, false);
}

G.onBusted = () => { if (G.mode === 'play') endRun('busted'); };

function respawnAtHospital() {
  hideEndScreen(G);
  clearPolice(G);
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.bustMeter = 0;
  G.health = 100;
  if (G.player.car) {
    G.player.car.occupied = false;
    G.player.car = null;
  }
  G.player.mesh.visible = true;
  G.player.mesh.position.copy(G.city.hospitalPos);
  G.player.heading = Math.PI / 2;
  G.mode = 'play';
  G.toast('Discharged. The rain kept your seat warm.');
  G.saveGame();
}

G.startGame = (fromSave) => {
  const save = fromSave ? loadSave() : null;
  G.cash = save ? save.cash : 120;
  G.rep = save ? save.rep : 0;
  G.ammo = save ? save.ammo : MAG_SIZE;
  G.reserveAmmo = save ? save.reserveAmmo : 48;
  G.health = 100;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.bustMeter = 0;
  resetPopulation();
  initStory(G);
  if (save) {
    G.story.idx = Math.min(save.storyIdx || 0, 6);
    if (save.finished || G.story.idx >= 6) { G.story.phase = 'free'; G.story.finished = true; }
    G.player.mesh.position.set(save.x || 10, 0, save.z || 44);
  } else {
    G.player.mesh.position.set(10, 0, 44);
  }
  G.player.mesh.visible = true;
  G.player.car = null;
  G.ui.title.classList.add('hidden');
  G.ui.pause.classList.add('hidden');
  hideEndScreen(G);
  G.mode = 'play';
  G.toast(save ? 'Welcome back to Velmara.' : 'Find Odile Vane at the glowing booth on the Neon Mile.');
};

G.toTitle = () => {
  G.mode = 'title';
  G.ui.pause.classList.add('hidden');
  G.ui.title.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
};

G.togglePause = (force) => {
  if (G.mode === 'play' && force !== false) {
    G.mode = 'pause';
    G.ui.pauseStats.innerHTML =
      `Cash $${G.cash.toLocaleString('en-US')} · REP ${G.rep} · ${districtAt(G.playerPos().x, G.playerPos().z)}<br>` +
      `Story job ${Math.min(6, (G.story ? G.story.idx : 0) + 1)} of 6 · Wanted ${'★'.repeat(G.wanted.stars)}${'☆'.repeat(5 - G.wanted.stars)}`;
    G.ui.pause.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (G.mode === 'pause' && force !== true) {
    G.mode = 'play';
    G.ui.pause.classList.add('hidden');
  }
};

// ---------- input ----------

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat) G.keyEdges.add(e.code);
  G.keys[e.code] = true;
  G.sound.start();
  if (e.code === 'KeyM') {
    G.sound.setMuted(!G.sound.muted);
    G.toast(G.sound.muted ? 'Sound off.' : 'Sound on.');
  }
  if (G.mode === 'play') {
    if (e.code === 'KeyP') {
      G.bigMapOpen = !G.bigMapOpen;
      G.ui.bigMap.classList.toggle('hidden', !G.bigMapOpen);
    }
    if (e.code === 'Escape') {
      if (G.bigMapOpen) {
        G.bigMapOpen = false;
        G.ui.bigMap.classList.add('hidden');
      } else G.togglePause(true);
    }
    if ((e.code === 'KeyE' || e.code === 'Enter') && G.dialogueActive) G.advanceDialogue();
  } else if (G.mode === 'pause' && e.code === 'Escape') {
    G.togglePause(false);
  }
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
window.addEventListener('blur', () => { G.keys = {}; });

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', (e) => {
  G.sound.start();
  if (G.mode !== 'play') return;
  if (G.dialogueActive) { G.advanceDialogue(); return; }
  if (e.button === 0) {
    if (document.pointerLockElement !== canvas) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* drag-orbit still works */ });
      } catch { /* pointer lock unavailable: drag-orbit still works */ }
    } else {
      playerShoot(G);
    }
  }
});
window.addEventListener('mousemove', (e) => {
  if (G.mode !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  const dragging = (e.buttons & 1) === 1 && G.time - G.lastShotAt > 0.25;
  if (!locked && !dragging) return;
  G.camYaw -= e.movementX * 0.0032;
  G.camPitch = Math.max(-0.12, Math.min(0.85, G.camPitch + e.movementY * 0.0028));
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.mode === 'play' && !G.dialogueActive && !SHOT) {
    // pointer lock loss is the browser's Esc: treat as pause only if we had it
    if (G.hadLock) G.togglePause(true);
    G.hadLock = false;
  }
  if (document.pointerLockElement === canvas) G.hadLock = true;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- camera ----------

function updateCamera(dt) {
  const target = G.playerPos().clone();
  target.y += G.player.car ? 1.7 : 1.55;
  if (G.mode === 'title') {
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 74, 30, Math.cos(t) * 74);
    camera.lookAt(0, 6, 20);
    return;
  }
  const dist = G.player.car ? 9.2 : 6.4;
  const cosP = Math.cos(G.camPitch);
  const back = new G.THREE.Vector3(
    Math.sin(G.camYaw) * cosP,
    Math.sin(G.camPitch),
    Math.cos(G.camYaw) * cosP,
  );
  const desired = target.clone().add(back.multiplyScalar(dist));
  desired.y = Math.max(1.1, desired.y);
  const lerp = G.mode === 'shot' ? 1 : 1 - Math.pow(0.0001, dt);
  camera.position.lerp(desired, lerp);
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.6;
    G.shake *= Math.pow(0.02, dt);
  }
  const look = target.clone();
  look.y += 0.4;
  camera.lookAt(look);
  // headlight / torch follows the player
  const fwd = new G.THREE.Vector3(-Math.sin(G.camYaw), 0, -Math.cos(G.camYaw));
  if (G.player.car) {
    const h = G.player.car.heading;
    fwd.set(Math.sin(h), 0, Math.cos(h));
  } else {
    fwd.set(Math.sin(G.player.heading), 0, Math.cos(G.player.heading));
  }
  torch.position.set(target.x + fwd.x * 1.5, 3.1, target.z + fwd.z * 1.5);
  torch.target.position.set(target.x + fwd.x * 16, 0.4, target.z + fwd.z * 16);
}

// ---------- the frame loop ----------

let lastNow = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // clamp both ways: a first-frame timestamp skew must never run time backwards
  let dt = Math.max(0, Math.min(0.05, (now - lastNow) / 1000));
  lastNow = now;
  if (G.mode === 'pause') {
    renderer.render(scene, camera);
    return;
  }
  G.time += dt;
  G.clockMinutes += dt * 0.5;
  if (G.panicAt && G.time > G.panicUntil) G.panicAt = null;
  G.damageFlash = Math.max(0, G.damageFlash - dt * 2.2);
  G.clearPrompt();

  const focus = G.mode === 'title' ? new G.THREE.Vector3(0, 0, 10) : G.playerPos();

  if (G.mode === 'over') {
    G.overTimer -= dt;
    if (G.overTimer <= 0) respawnAtHospital();
  }

  if ((G.mode === 'play' && !G.dialogueActive) || G.mode === 'shot') {
    updateStory(G, dt);
    // E: story pads consume first (in updateStory); what is left enters cars
    if (G.consumeKey('KeyE')) enterExitCar(G);
    if (G.consumeKey('KeyF')) playerMeleeOrRob(G);
    if (G.consumeKey('KeyR')) startReload(G);

    if (G.player.car) {
      if (G.mode === 'play') {
        if (G.player.car.health <= 0) {
          G.toast('This car is wrecked — find another.');
          enterExitCar(G);
        } else stepPlayerCar(G, G.player.car, dt);
      }
    } else if (G.mode === 'play') {
      stepPlayerOnFoot(G, dt);
      const near = nearestEnterableCar(G);
      if (near && !G.ui.promptKey) {
        G.setPrompt('E', near.kind === 'parked' && !near.stolen
          ? `steal the ${near.name}` : `enter the ${near.name}`);
      }
    }
    G.playerAiming = G.mode === 'play' && !G.player.car;

    for (const car of G.cars) {
      if (car === G.player.car) continue;
      if (car.kind === 'traffic') stepTrafficCar(G, car, dt);
      else if (car.kind === 'police') stepPoliceCar(G, car, dt);
      else if (car.speed > 2 && G.mode === 'shot') {
        // staged hero cars keep rolling for the camera
        applyCarPhysics(G, car, 0.4, 0, false, dt);
      }
    }
    if (G.player.car && G.mode === 'shot') {
      applyCarPhysics(G, G.player.car, 0.42, 0, false, dt);
    }
    stepPedestrians(G, dt);
    stepThugs(G, dt);
    updateCombatFx(G, dt);
    updateWanted(G, dt);
    stepOfficers(G, dt);
    updateBustMeter(G, dt);
    updateCarFleet(G, dt, G.time);
    housekeeping(dt);

    // siren presence + bassline
    let sirenLevel = 0;
    if (G.wanted.stars > 0) {
      let nearest = 999;
      for (const cop of G.cops) {
        if (cop.active) nearest = Math.min(nearest, cop.mesh.position.distanceTo(G.playerPos()));
      }
      sirenLevel = Math.max(0.15, 1 - nearest / 90);
    }
    G.sound.setSiren(sirenLevel, G.time);
    G.sound.updateBass(dt, true);
    if (!G.player.car) G.sound.setEngine(0, false);

    G.saveTimer -= dt;
    if (G.saveTimer <= 0) { G.saveTimer = 15; G.saveGame(); }
  } else if (G.mode === 'title') {
    for (const car of G.cars) if (car.kind === 'traffic') stepTrafficCar(G, car, dt);
    stepPedestrians(G, dt);
    updateCarFleet(G, dt, G.time);
    G.sound.setSiren(0, G.time);
  }

  if (G.mode === 'shot') updateShotScene(G);
  G.city.update(dt, G.time, focus);
  updateCamera(dt);
  updateHud(G, dt);
  G.keyEdges.clear();
  renderer.render(scene, camera);
}

// ---------- boot ----------

initInterface(G);
initStory(G);
resetPopulation();
if (SHOT) {
  // screenshot render diet: one posed frame matters, not particle counts —
  // quarter the rain, pin the pixel ratio, thicken the fog a touch
  renderer.setPixelRatio(1);
  if (G.city.rain) G.city.rain.geometry.setDrawRange(0, 425);
  scene.fog.density = 0.0058;
  G.mode = 'shot';
  G.ui.title.classList.add('hidden');
  setupShotScene(G, SHOT);
} else {
  G.mode = 'title';
}
requestAnimationFrame(frame);
