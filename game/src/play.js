// play.js - boot, game loop and state machine for Velmara Nights.
// States: title -> playing <-> paused / dialogue / map overlay -> ended
// (wasted/busted card) -> playing again at St. Mirella Hospital.
// The frame dt is clamped BOTH ways so a hitching tab can neither freeze
// the world nor teleport it.
window.VN = window.VN || {};

VN.G = null;

(function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || 7) || 7;
  const shotName = params.get('shot');

  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0b1020);

  const city = VN.CITY.generate(seed);
  const scene = city.scene;
  scene.fog = new THREE.FogExp2(0x0b1020, 0.0036);
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

  // Bright night lighting: strong hemisphere + ambient lift + a moon key
  // light, so streets read clearly instead of sinking into black.
  scene.add(new THREE.HemisphereLight(0x93b8ff, 0x33283d, 1.05));
  scene.add(new THREE.AmbientLight(0x5a6c96, 0.65));
  const moon = new THREE.DirectionalLight(0xaac4ff, 0.6);
  moon.position.set(90, 160, -70);
  scene.add(moon);
  const neonGlow = new THREE.PointLight(0xff5fd2, 0.9, 70, 1.8);
  neonGlow.position.set(24, 8, 26);
  scene.add(neonGlow);

  // Harbor water: one dark, shining plane south of the quay.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(680, 130),
    new THREE.MeshPhongMaterial({ color: 0x10314a, shininess: 90, specular: 0x6a9fd8 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.25, 300);
  scene.add(water);

  // Rain: a box of points that follows the camera and wraps vertically.
  const RAIN_N = 1500;
  const rainPos = new Float32Array(RAIN_N * 3);
  const rainRng = VN.mulberry32(seed * 31 + 5);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (rainRng() - 0.5) * 130;
    rainPos[i * 3 + 1] = rainRng() * 45;
    rainPos[i * 3 + 2] = (rainRng() - 0.5) * 130;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fc4e8, size: 0.32, transparent: true, opacity: 0.65 }));
  rain.frustumCulled = false;
  scene.add(rain);

  // Objective beacon: a soft pillar + bobbing diamond at the target point.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  pillar.position.y = 13;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.85),
    new THREE.MeshBasicMaterial({ color: 0xffd60a, fog: false })
  );
  diamond.position.y = 4.4;
  beacon.add(pillar, diamond);
  beacon.visible = false;
  scene.add(beacon);

  const G = {
    seed, renderer, scene, camera, city,
    state: shotName ? 'shot' : 'title',
    shotName,
    time: 0,
    clockMinutes: 21 * 60 + 40,
    cash: 250, rep: 0, health: 100,
    mode: 'foot',
    playerCar: null,
    cars: [], peds: [],
    keys: {},
    camYaw: Math.PI, camPitch: 0.32,
    aimHeld: false, gunDrawn: false,
    panicAt: -99, panicX: 0, panicZ: 0,
    endT: 0,
    saveExists: false,
    focusX() { return this.mode === 'car' && this.playerCar ? this.playerCar.x : this.player.x; },
    focusZ() { return this.mode === 'car' && this.playerCar ? this.playerCar.z : this.player.z; },
    addCash(n) { this.cash += n; },
    addRep(n) { this.rep += n; },
    hurtPlayer(n) {
      if (this.state !== 'playing') return;
      this.health -= n;
      if (this.health <= 0) this.onWasted();
    },
  };
  VN.G = G;
  window.__VN = { G, counts: city.counts, version: 'velmara-nights-1' };

  // --- hero ---------------------------------------------------------------
  const jax = VN.makeJax();
  G.player = {
    fig: jax, group: jax.group, x: 16, z: 24, heading: Math.PI / 2, speed: 0,
  };
  G.player.group.position.set(G.player.x, 0, G.player.z);
  scene.add(G.player.group);

  const odile = VN.makeOdile();
  odile.group.position.set(city.odileBooth.x, 0, 32.2);
  odile.group.rotation.y = Math.PI;
  scene.add(odile.group);
  G.odile = odile;

  // --- cars & crowds --------------------------------------------------------
  for (const spawn of city.carSpawns) {
    const car = new VN.Car(spawn, {});
    car.setHeadlights(!spawn.parked);
    scene.add(car.group); scene.add(car.smoke);
    if (!spawn.parked) { car.driver = 'ai'; car.ai = new VN.TrafficBrain(car); }
    G.cars.push(car);
  }
  const gt = new VN.Car(city.gtSpawn, { isGT: true });
  gt.parked = true;
  scene.add(gt.group); scene.add(gt.smoke);
  G.cars.push(gt);
  G.gtCar = gt;

  city.pedSpawns.forEach((spawn, i) => {
    const ped = new VN.Ped(spawn, i);
    scene.add(ped.group);
    G.peds.push(ped);
  });

  G.law = new VN.Law(G);
  G.combat = new VN.Combat(G);
  G.story = new VN.Story(G);
  G.ui = new VN.UI(G);
  G.beacon = beacon;
  G.water = water;
  G.rain = rain;
  G.rainPos = rainPos;

  // --- save / load ----------------------------------------------------------
  const SAVE_KEY = 'velmara-nights-save-v1';
  G.saveGame = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.cash, rep: G.rep, health: G.health,
        missionIdx: G.story.missionIdx, completed: G.story.completed,
        clockMinutes: G.clockMinutes,
      }));
      G.saveExists = true;
    } catch (e) { /* storage unavailable: play on without saving */ }
  };
  G.loadSave = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      G.cash = s.cash; G.rep = s.rep; G.health = s.health;
      G.story.missionIdx = s.missionIdx; G.story.completed = s.completed;
      G.clockMinutes = s.clockMinutes || G.clockMinutes;
      return true;
    } catch (e) { return false; }
  };
  try { G.saveExists = !!localStorage.getItem(SAVE_KEY); } catch (e) { G.saveExists = false; }

  G.respawn = function (fee, title, text) {
    G.cash = Math.max(0, G.cash - Math.min(G.cash, fee));
    G.health = 100;
    G.law.clearHeat();
    G.law.despawnAll();
    if (G.playerCar) { G.playerCar = null; }
    G.mode = 'foot';
    G.player.group.visible = true;
    G.player.x = G.city.hospital.x; G.player.z = G.city.hospital.z;
    G.player.group.position.set(G.player.x, 0, G.player.z);
    G.ui.showEnd(title, text);
    G.state = 'ended';
    G.endT = 2.4;
    G.saveGame();
  };
  G.onWasted = function () { if (VN.SFX) VN.SFX.fail(); G.respawn(150, 'WASTED', 'St. Mirella patched you up. Fee: $150.'); };
  G.onBusted = function () { if (VN.SFX) VN.SFX.fail(); G.respawn(200, 'BUSTED', 'Velmara PD took a $200 fine and your evening.'); };

  // --- interaction ------------------------------------------------------------
  G.nearestCar = function (maxD) {
    let best = null, bd = maxD;
    for (const c of G.cars) {
      const d = VN.dist2d(c.x, c.z, G.player.x, G.player.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  G.interactHint = function () {
    if (G.state !== 'playing') return '';
    if (G.mode === 'car') return 'E - get out';
    if (VN.dist2d(G.player.x, G.player.z, G.city.odileBooth.x, G.city.odileBooth.z) < 4.4) return 'E - talk to Odile';
    const car = G.nearestCar(3.4);
    if (car) return car.driver === 'ai' ? 'E - drag the driver out' : 'E - steal this car';
    if (G.gunDrawn) {
      for (const p of G.peds) if (!p.dead && VN.dist2d(p.x, p.z, G.player.x, G.player.z) < 3) return 'F - rob them';
    }
    return '';
  };
  G.enterCar = function (car) {
    const wasAI = car.driver === 'ai';
    if (wasAI) {
      // Drag-out: the driver spills onto the pavement and runs.
      const driverPed = new VN.Ped({ x: car.x + 2.5, z: car.z + 1 }, 90 + G.peds.length);
      driverPed.scare(car.x, car.z, G.time);
      G.scene.add(driverPed.group);
      G.peds.push(driverPed);
      G.law.reportCrime('carjack', car.x, car.z, 1);
    } else if (car.isGT) {
      G.law.reportCrime('theft', car.x, car.z, 1.4);
    } else if (car.parked && car.owned !== true) {
      if (Math.random() < 0.4) G.law.reportCrime('theft', car.x, car.z, 0.5);
    }
    car.driver = 'player';
    car.parked = false;
    car.setHeadlights(true);
    G.playerCar = car;
    G.mode = 'car';
    G.player.group.visible = false;
    if (VN.SFX) VN.SFX.door();
  };
  G.exitCar = function () {
    const car = G.playerCar;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    G.player.x = car.x + Math.cos(car.heading) * 2.4;
    G.player.z = car.z - Math.sin(car.heading) * 2.4;
    VN.pushOutCity(G.city, G.player, 0.5);
    G.player.group.position.set(G.player.x, 0, G.player.z);
    G.player.group.visible = true;
    G.playerCar = null;
    G.mode = 'foot';
    if (VN.SFX) { VN.SFX.door(); VN.SFX.engine(false, 0); }
  };
  G.tryInteract = function () {
    if (G.mode === 'car') { G.exitCar(); return; }
    if (VN.dist2d(G.player.x, G.player.z, G.city.odileBooth.x, G.city.odileBooth.z) < 4.4) {
      G.story.talkToOdile();
      return;
    }
    const car = G.nearestCar(3.4);
    if (car) G.enterCar(car);
  };
  G.tryRob = function () {
    for (const p of G.peds) {
      if (p.dead || p.isOfficer) continue;
      if (VN.dist2d(p.x, p.z, G.player.x, G.player.z) < 3 && G.time - p.robbedAt > 20) {
        p.robbedAt = G.time;
        p.state = 'hostage';
        setTimeout(() => { if (!p.dead) { p.state = 'flee'; p.fleeT = G.time + 3; } }, 900);
        const take = 30 + Math.floor(Math.random() * 90);
        G.addCash(take);
        G.ui.toast('Robbed $' + take + '. Smooth.');
        G.law.reportCrime('theft', G.player.x, G.player.z, 0.8);
        if (VN.SFX) VN.SFX.cash();
        return;
      }
    }
    G.combat.melee();
  };

  // --- input ---------------------------------------------------------------
  const canvas = renderer.domElement;
  window.addEventListener('keydown', (e) => {
    G.keys[e.code] = true;
    VN.SFX.unlock();
    if (G.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); G.startGame(false); }
    else if (G.state === 'dialogue' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) { e.preventDefault(); G.story.advanceDialogue(); }
    else if (G.state === 'playing') {
      if (e.code === 'KeyE') G.tryInteract();
      if (e.code === 'KeyF') { if (G.mode === 'foot') G.tryRob(); }
      if (e.code === 'KeyR' && G.mode === 'foot') G.combat.reload();
      if (e.code === 'KeyQ' && G.mode === 'foot') { G.gunDrawn = !G.gunDrawn; G.player.fig.setGun(G.gunDrawn); }
      if (e.code === 'KeyP') { G.ui.mapOpen = !G.ui.mapOpen; document.getElementById('mapWrap').style.display = G.ui.mapOpen ? 'flex' : 'none'; }
      if (e.code === 'KeyM') VN.SFX.setMuted(!VN.SFX.muted);
      if (e.code === 'Digit1') { if (G.story.startRace()) G.ui.toast('Neon Circuit: hit every checkpoint.'); }
      if (e.code === 'Digit2') { if (G.story.startCourier()) G.ui.toast('Courier run started.'); }
      if (e.code === 'Escape') { G.state = 'paused'; G.ui.showPause(true); }
    } else if (G.state === 'paused' && e.code === 'Escape') {
      G.state = 'playing'; G.ui.showPause(false);
    }
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    VN.SFX.unlock();
    if (G.state !== 'playing') return;
    if (e.button === 2) { G.aimHeld = true; G.gunDrawn = true; G.player.fig.setGun(true); }
    if (e.button === 0 && G.mode === 'foot') {
      if (!G.gunDrawn) { G.gunDrawn = true; G.player.fig.setGun(true); }
      // Aim: ray through the pointer, sampled at the chest-height plane.
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      const vec = new THREE.Vector3(nx, ny, 0.5).unproject(G.camera);
      const dir = vec.sub(G.camera.position).normalize();
      const t = (1.2 - G.camera.position.y) / (dir.y || -0.001);
      const dist = t > 0 && t < 80 ? t : 55;
      const aim = G.camera.position.clone().add(dir.multiplyScalar(dist));
      G.player.heading = Math.atan2(aim.x - G.player.x, aim.z - G.player.z);
      G.combat.shoot(aim.x, 1.1, aim.z);
    }
    if (document.pointerLockElement !== canvas && G.state === 'playing') {
      try { canvas.requestPointerLock(); } catch (err) { /* headless: no lock */ }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) { G.aimHeld = false; }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas && G.state === 'playing') {
      G.camYaw -= (e.movementX || 0) * 0.0032;
      G.camPitch = VN.clamp(G.camPitch + (e.movementY || 0) * 0.002, 0.08, 1.1);
    }
  });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  G.startGame = function (cont) {
    if (cont) G.loadSave();
    G.ui.hideTitle();
    G.state = 'playing';
    G.ui.toast(cont ? 'Welcome back to Velmara.' : 'Talk to Odile at the pink booth.');
    VN.SFX.unlock();
  };
  document.getElementById('newBtn').addEventListener('click', () => G.startGame(false));
  document.getElementById('continueBtn').addEventListener('click', () => G.startGame(true));
  document.getElementById('resumeBtn').addEventListener('click', () => { G.state = 'playing'; G.ui.showPause(false); });
  document.getElementById('saveBtn').addEventListener('click', () => { G.saveGame(); G.ui.toast('Saved.'); });

  if (G.state === 'title') G.ui.showTitle(G.saveExists);

  // --- per-frame update ------------------------------------------------------
  function updateFoot(dt) {
    const p = G.player;
    let mx = 0, mz = 0;
    const fwd = G.camYaw;
    if (G.keys.KeyW || G.keys.ArrowUp) { mx += -Math.sin(fwd); mz += -Math.cos(fwd); }
    if (G.keys.KeyS || G.keys.ArrowDown) { mx += Math.sin(fwd); mz += Math.cos(fwd); }
    if (G.keys.KeyA || G.keys.ArrowLeft) { mx += -Math.cos(fwd); mz += Math.sin(fwd); }
    if (G.keys.KeyD || G.keys.ArrowRight) { mx += Math.cos(fwd); mz += -Math.sin(fwd); }
    const moving = Math.hypot(mx, mz) > 0.01;
    const sprint = G.keys.ShiftLeft || G.keys.ShiftRight;
    const speed = moving ? (sprint ? 8.4 : 4.9) : 0;
    if (moving) {
      const inv = 1 / Math.hypot(mx, mz);
      const want = Math.atan2(mx * inv, mz * inv);
      p.heading += VN.clamp(VN.angDiff(want, p.heading), -dt * 10, dt * 10);
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      VN.pushOutCity(G.city, p, 0.55);
      p.x = VN.clamp(p.x, -316, 316);
      p.z = VN.clamp(p.z, -276, 232);
    }
    p.speed = speed;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.heading;
    p.fig.animate(dt, speed);
    // Camera yaw drifts to rest behind the hero while moving.
    if (moving && !G.aimHeld) {
      const behind = p.heading + Math.PI;
      G.camYaw += VN.angDiff(behind, G.camYaw) * Math.min(1, dt * 2.2);
    }
  }

  function updateDriving(dt) {
    const car = G.playerCar;
    const input = {
      throttle: (G.keys.KeyW || G.keys.ArrowUp) ? 1 : (G.keys.KeyS || G.keys.ArrowDown) ? -1 : 0,
      steer: (G.keys.KeyA || G.keys.ArrowLeft) ? 1 : (G.keys.KeyD || G.keys.ArrowRight) ? -1 : 0,
      brake: !!(G.keys.KeyS || G.keys.ArrowDown),
      handbrake: !!G.keys.Space,
    };
    // Running people over is a crime and it hurts.
    const before = { x: car.x, z: car.z };
    car.driveStep(dt, input, G.city);
    if (Math.abs(car.speed) > 6) {
      for (const p of G.peds) {
        if (!p.dead && VN.dist2d(p.x, p.z, car.x, car.z) < 2.1) {
          p.hurt(50, G);
          car.speed *= 0.7;
        }
      }
    }
    void before;
    VN.SFX.engine(true, car.speed / 46);
    // Chase camera yaw locks behind the car.
    const behind = car.heading;
    G.camYaw += VN.angDiff(behind, G.camYaw) * Math.min(1, dt * 3.4);
  }

  function updateCamera(dt) {
    const fx = G.focusX(), fz = G.focusZ();
    const driving = G.mode === 'car';
    const dist = driving ? 11 : 8;
    const height = driving ? 4.4 : 2.6 + G.camPitch * 3;
    const cx = fx - Math.sin(G.camYaw) * -dist * Math.cos(G.camPitch);
    const cz = fz - Math.cos(G.camYaw) * -dist * Math.cos(G.camPitch);
    // Note: camYaw is the look direction; the camera sits opposite it.
    const px = fx + Math.sin(G.camYaw) * dist * Math.cos(G.camPitch);
    const pz = fz + Math.cos(G.camYaw) * dist * Math.cos(G.camPitch);
    void cx; void cz;
    camera.position.x = VN.lerp(camera.position.x, px, Math.min(1, dt * (driving ? 7 : 5)));
    camera.position.y = VN.lerp(camera.position.y, height, Math.min(1, dt * 5));
    camera.position.z = VN.lerp(camera.position.z, pz, Math.min(1, dt * (driving ? 7 : 5)));
    camera.lookAt(fx, 1.6, fz);
  }

  function updateWorld(dt) {
    G.time += dt;
    G.clockMinutes += dt * 1.5;
    if (G.mode === 'car' && G.playerCar) updateDriving(dt);
    else updateFoot(dt);
    for (const car of G.cars) {
      if (car.driver === 'ai' && car.ai) car.ai.update(dt, G);
      else if (car.driver !== 'player' && !car.isPolice) car.updateSmoke(dt);
    }
    for (const ped of G.peds) ped.update(dt, G);
    G.odile.group.rotation.y = Math.PI + Math.sin(G.time * 0.7) * 0.14;
    G.law.update(dt);
    G.combat.update(dt);
    G.story.update(dt);
    // Side-job positional checks.
    if (G.story.sideJob) {
      const sj = G.story.sideJob;
      const d = VN.dist2d(G.focusX(), G.focusZ(), sj.at.x, sj.at.z);
      if (sj.kind === 'race' && d < 9) {
        sj.step++;
        if (sj.step >= sj.pts.length) {
          G.story.sideJob = null;
          G.addCash(500); G.addRep(12);
          G.ui.clearObjective();
          G.ui.toast('Neon Circuit complete  +$500');
          if (VN.SFX) VN.SFX.cash();
          G.saveGame();
        } else {
          sj.at = sj.pts[sj.step];
          sj.label = 'Checkpoint ' + (sj.step + 1) + ' of 4';
          G.ui.setObjective('NEON CIRCUIT', sj.label);
          if (VN.SFX) VN.SFX.ding();
        }
      } else if (sj.kind === 'courier' && d < 6) {
        const pay = 120 + Math.ceil(sj.timer);
        G.story.sideJob = null;
        G.addCash(pay); G.addRep(5);
        G.ui.clearObjective();
        G.ui.toast('Courier drop done  +$' + pay);
        if (VN.SFX) VN.SFX.cash();
      }
    }
    // Beacon follows the current objective.
    const pt = G.story.objectivePoint();
    if (pt) {
      beacon.visible = true;
      beacon.position.set(pt.x, 0, pt.z);
      diamond.position.y = 4.4 + Math.sin(G.time * 2.4) * 0.5;
      diamond.rotation.y += dt * 1.8;
    } else beacon.visible = false;
    if (VN.SFX && G.mode !== 'car') VN.SFX.engine(false, 0);
  }

  function updateAmbient(dt) {
    // Rain falls and wraps around the camera.
    const pos = rainGeo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < RAIN_N; i++) {
      arr[i * 3 + 1] -= dt * 34;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] += 45;
    }
    pos.needsUpdate = true;
    rain.position.set(camera.position.x, 0, camera.position.z);
    water.position.y = -0.25 + Math.sin(G.time * 0.8) * 0.05;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = VN.clamp(dt, 0.008, 0.05); // clamp both ways, always
    if (G.state === 'playing') {
      updateWorld(dt);
      updateCamera(dt);
      G.ui.update(dt);
    } else if (G.state === 'ended') {
      G.endT -= dt;
      if (G.endT <= 0) { G.ui.hideEnd(); G.state = 'playing'; }
      updateCamera(dt);
    } else if (G.state === 'shot') {
      G.time += dt;
      updateAmbient(dt);
      // Camera is posed by snapshots.js; still refresh HUD numbers.
      G.ui.update(0);
    } else {
      // Title / dialogue / paused: gentle orbit or frozen world, still drawn.
      if (G.state === 'title') {
        G.time += dt;
        const t = G.time * 0.05;
        camera.position.set(Math.sin(t) * 55, 17, 26 + Math.cos(t) * 40);
        camera.lookAt(10, 4, 10);
        for (const car of G.cars) if (car.driver === 'ai' && car.ai) car.ai.update(dt, G);
        for (const ped of G.peds) ped.update(dt, G);
      }
      updateAmbient(dt);
    }
    if (G.state !== 'shot') updateAmbient(dt);
    renderer.render(scene, camera);
    if (!window.__VN.drawCalls) {
      window.__VN.drawCalls = renderer.info.render.calls;
      window.__VN.drawObjects = scene.children.length;
      let objs = 0;
      scene.traverse(() => { objs++; });
      window.__VN.sceneObjects = objs;
    }
  }
  requestAnimationFrame(frame);

  if (shotName && VN.SHOTS) VN.SHOTS.apply(G, shotName);
})();
