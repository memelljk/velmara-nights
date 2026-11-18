// play.js — Velmara Nights boot and main loop: renderer, third-person orbit
// camera, keyboard + mouse input, on-foot / driving states, car theft,
// hospital respawns, pause, title screen, and the deterministic ?shot= mode
// the screenshots are posed in. Frame dt is clamped BOTH ways so a hitching
// tab can neither teleport the world nor freeze it.
window.VN = window.VN || {};

VN.play = (function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var seed = parseInt(params.get('seed') || '7', 10) || 7;
  var shotName = params.get('shot');

  var keys = {};
  var state = null;
  var renderer, camera;
  var camYaw = 0, camPitch = 0.32, pointerLocked = false;
  var smokePuffs = [];

  function createState() {
    var rng = VN.city.RNG(seed * 31 + 5);
    var city = VN.city.build(seed);
    var s = {
      seed: seed, rng: rng, city: city, scene: city.scene,
      mode: 'title', prevMode: 'foot', time: 0, timeOfDay: 0,
      player: {
        x: city.booth.x + 6, z: city.booth.z + 8, ry: 0, phase: 0,
        health: 100, cash: 120, rep: 0, car: null, aiming: false,
        fig: VN.avatar.makeJax()
      },
      peds: [], traffic: [], parked: [], thugs: [],
      stats: { missionsDone: 0, sideDone: 0, robberies: 0, pedsDown: 0, carsStolen: 0 },
      panic: null, showMap: false, interactCd: 0
    };
    s.player.fig.group.position.set(s.player.x, 0, s.player.z);
    city.scene.add(s.player.fig.group);
    var crowds = VN.crowds.init(rng, city);
    s.peds = crowds.peds; s.traffic = crowds.traffic; s.parked = crowds.parked;
    s.law = VN.law.init(city, rng);
    s.combat = VN.combat.init(city.scene);
    s.story = VN.story.init(city);
    return s;
  }

  // --- theft / entering cars ----------------------------------------------
  function nearestCar(s, maxD) {
    var best = null, bd = maxD * maxD;
    var all = s.parked.concat(s.traffic, s.law.cruisers);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.dead) continue;
      var dx = c.x - s.player.x, dz = c.z - s.player.z;
      var d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function enterCar(s, car) {
    // drag-out: a traffic driver is thrown to the kerb
    var wasParked = !!car.parked;
    if (!wasParked && s.traffic.indexOf(car) !== -1) {
      s.traffic.splice(s.traffic.indexOf(car), 1);
      var ped = VN.crowds.spawnPed(s.rng, s.city, car);
      ped.x = car.x + 2; ped.z = car.z + 1; ped.state = 'flee';
      s.peds.push(ped);
      s.panic = { x: car.x, z: car.z, t: 2 };
    }
    if (s.parked.indexOf(car) !== -1) s.parked.splice(s.parked.indexOf(car), 1);
    if (s.law.cruisers.indexOf(car) !== -1) s.law.cruisers.splice(s.law.cruisers.indexOf(car), 1);
    car.parked = false; car.ai = null;
    s.player.car = car;
    s.player.fig.group.visible = false;
    s.mode = 'drive';
    s.stats.carsStolen++;
    if (!wasParked || car.special) VN.law.report(s.law, 1, s); // witnessed theft
    if (VN.sound) VN.sound.door();
  }
  function exitCar(s) {
    var car = s.player.car;
    if (!car) return;
    car.speed = 0;
    s.parked.push(car);
    car.parked = true;
    s.player.x = car.x + Math.cos(car.ry) * 2.2;
    s.player.z = car.z - Math.sin(car.ry) * 2.2;
    var res = VN.city.collide(s.city.colliders, s.player.x, s.player.z, 0.45);
    s.player.x = res.x; s.player.z = res.z;
    s.player.car = null;
    s.player.fig.group.visible = true;
    s.mode = 'foot';
    if (VN.sound) VN.sound.door();
  }

  function respawnAtHospital(s, fee, msg) {
    var h = s.city.hospital;
    s.player.x = h.x + 4; s.player.z = h.z + 12;
    s.player.health = 100;
    s.player.cash = Math.max(0, s.player.cash - fee);
    if (s.player.car) { s.parked.push(s.player.car); s.player.car.parked = true; s.player.car = null; }
    s.player.fig.group.visible = true;
    VN.law.clearUnits(s.law, s);
    s.law.wanted = 0; s.law.heat = 0; s.law.bustedMeter = 0;
    VN.story.clearSave();
    s.mode = 'foot';
    VN.ui.hideWasted(); VN.ui.hideBusted();
    VN.ui.toast(s, msg + ' Fee $' + fee + '.');
    VN.story.saveGame(s);
  }

  // --- interaction prompt ----------------------------------------------------
  function currentPrompt(s) {
    if (s.mode === 'foot') {
      var obj = VN.story.currentObjective(s);
      if (obj.stage && obj.stage.kind === 'talk') {
        var b = s.city.booth;
        var dx = s.player.x - b.x, dz = s.player.z - b.z;
        if (dx * dx + dz * dz < 30) return 'E — Talk to Odile Vane';
      }
      var car = nearestCar(s, 3.4);
      if (car) return 'E — Steal the ' + car.def.name;
      for (var i = 0; i < s.peds.length; i++) {
        if (s.peds[i].state === 'handsup' && !s.peds[i].robbed) return 'E — Rob them';
      }
    }
    if (s.mode === 'drive') return 'E — Exit vehicle · SPACE handbrake';
    return '';
  }
  function doInteract(s) {
    if (s.mode === 'drive') { exitCar(s); return; }
    if (s.mode !== 'foot') return;
    var obj = VN.story.currentObjective(s);
    if (obj.stage && obj.stage.kind === 'talk') {
      var b = s.city.booth;
      var dx = s.player.x - b.x, dz = s.player.z - b.z;
      if (dx * dx + dz * dz < 30) {
        var idx = s.story.missionIndex;
        if (idx < VN.story.MISSIONS.length) {
          VN.ui.dialogue(s, VN.story.MISSIONS[idx].intro, function () {
            VN.story.startMission(s, idx);
          });
          return;
        }
      }
    }
    if (VN.combat.tryRob(s)) return;
    var car = nearestCar(s, 3.4);
    if (car) enterCar(s, car);
  }

  // --- per-frame updates -------------------------------------------------------
  function stepFoot(s, dt) {
    var p = s.player;
    var fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    var str = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    var run = keys.ShiftLeft || keys.ShiftRight;
    var speed = p.aiming ? 2.2 : run ? 6.4 : 3.6;
    if (fwd || str) {
      var moveRy = Math.atan2(str, fwd) + camYaw + Math.PI;
      // camera looks along -sin/-cos of camYaw; movement is camera-relative
      var mx = Math.sin(camYaw) * -fwd + Math.cos(camYaw) * -str;
      var mz = Math.cos(camYaw) * -fwd - Math.sin(camYaw) * -str;
      var ml = Math.sqrt(mx * mx + mz * mz) || 1;
      var nx = p.x + (mx / ml) * speed * dt;
      var nz = p.z + (mz / ml) * speed * dt;
      var res = VN.city.collide(s.city.colliders, nx, nz, 0.45);
      p.x = res.x; p.z = res.z;
      p.ry = p.aiming ? camYaw + Math.PI : Math.atan2(mx / ml, mz / ml);
      p.phase += dt * speed * 2.2;
    }
    p.fig.group.position.set(p.x, 0, p.z);
    p.fig.group.rotation.y = p.ry;
    VN.avatar.pose(p.fig, p.phase, (fwd || str) ? 1 : 0, p.aiming);
    p.fig.gun.visible = p.aiming;
    p.health = Math.min(100, p.health + dt * 0.7); // slow recovery
  }
  function stepDrive(s, dt) {
    var car = s.player.car;
    VN.drive.stepPlayer(car, {
      f: !!keys.KeyW, b: !!keys.KeyS, l: !!keys.KeyA, r: !!keys.KeyD,
      hand: !!keys.Space
    }, dt, s.city.colliders);
    s.player.x = car.x; s.player.z = car.z;
    if (car.smoke > 0 && Math.random() < 0.3) spawnSmoke(s, car);
    if (car.health <= 0 && !car.dead) { car.dead = true; car.speed = 0; VN.ui.toast(s, 'The car is wrecked — get out and find another.'); }
  }
  function spawnSmoke(s, car) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x555a66, transparent: true, opacity: 0.55 }));
    m.position.set(car.x, 1.6, car.z);
    s.scene.add(m);
    smokePuffs.push({ mesh: m, life: 1.1 });
  }
  function stepSmoke(dt) {
    for (var i = smokePuffs.length - 1; i >= 0; i--) {
      var p = smokePuffs[i];
      p.life -= dt;
      p.mesh.position.y += dt * 1.6;
      p.mesh.scale.multiplyScalar(1 + dt * 0.8);
      if (p.life <= 0) { state.scene.remove(p.mesh); smokePuffs.splice(i, 1); }
    }
  }

  function updateCamera(s, dt) {
    var target, dist, height;
    if (s.mode === 'drive' && s.player.car) {
      var car = s.player.car;
      var desiredYaw = car.ry + Math.PI;
      var dy = wrapAngle(desiredYaw - camYaw);
      camYaw += dy * Math.min(1, dt * (Math.abs(car.speed) > 3 ? 2.6 : 0.8));
      dist = 10.5; height = 4.2;
      target = { x: car.x, y: 1.2, z: car.z };
    } else {
      dist = 7.5; height = 2.6;
      target = { x: s.player.x, y: 1.4, z: s.player.z };
    }
    var cx = target.x + Math.sin(camYaw) * Math.cos(camPitch) * dist;
    var cz = target.z + Math.cos(camYaw) * Math.cos(camPitch) * dist;
    var cy = target.y + Math.sin(camPitch) * dist + (s.mode === 'drive' ? 1.2 : 0.4);
    camera.position.set(cx, Math.max(1.1, cy), cz);
    camera.lookAt(target.x, target.y, target.z);
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function step(s, dt) {
    s.time += dt;
    s.timeOfDay = (s.timeOfDay + dt * 6) % 3600; // a game hour per 10 real minutes
    if (s.panic) { s.panic.t -= dt; if (s.panic.t <= 0) s.panic = null; }
    if (s.interactCd > 0) s.interactCd -= dt;
    // rain follows the camera
    s.city.rain.position.set(camera.position.x, 0, camera.position.z);
    var rp = s.city.rain.geometry.getAttribute('position');
    for (var i = 0; i < rp.count; i++) {
      var y = rp.getY(i) - dt * 34;
      if (y < 0) y = 55;
      rp.setY(i, y);
    }
    rp.needsUpdate = true;

    if (s.mode === 'foot') stepFoot(s, dt);
    else if (s.mode === 'drive') stepDrive(s, dt);

    VN.crowds.stepPeds(s, dt, s.panic);
    VN.crowds.stepTraffic(s, dt, s.panic);
    VN.law.step(s, dt);
    VN.story.step(s, dt);
    VN.story.stepSide(s, dt);
    VN.combat.step(s, dt);
    stepSmoke(dt);
    updateCamera(s, dt);
    VN.ui.setPrompt(s.interactCd <= 0 ? currentPrompt(s) : '');
    VN.ui.update(s, dt);
    if (VN.sound) VN.sound.step(s, dt);
  }

  // --- boot ---------------------------------------------------------------------
  function boot() {
    state = createState();
    var s = state;
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    VN.ui.init(s);
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (shotName) {
      // Posed screenshot mode: no title, no loop — set the scene, one HUD
      // update, one render. Deterministic for a given seed.
      document.getElementById('title').classList.remove('show');
      document.getElementById('hud').classList.add('show');
      var cam = VN.snapshots.setup(s, shotName);
      s.player.fig.group.position.set(s.player.x, 0, s.player.z);
      if (!s.player.car) s.player.fig.group.visible = true;
      else s.player.fig.group.visible = false;
      camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
      camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
      VN.ui.update(s, 0);
      renderer.render(s.scene, camera);
      document.title = 'VELMARA NIGHTS — ' + shotName;
      window.__vnShotReady = true;
      return;
    }

    // Title screen wiring
    var save = VN.story.loadSave();
    var continueBtn = document.getElementById('continueBtn');
    if (save) continueBtn.style.display = 'block';
    document.getElementById('newBtn').addEventListener('click', function () { startGame(s, null); });
    continueBtn.addEventListener('click', function () { startGame(s, save); });
    document.getElementById('resumeBtn').addEventListener('click', function () { togglePause(s); });
    document.getElementById('restartBtn').addEventListener('click', function () { location.reload(); });
    document.getElementById('wastedBtn').addEventListener('click', function () { respawnAtHospital(s, 150, 'St. Mirella patched you up.'); });
    document.getElementById('bustedBtn').addEventListener('click', function () { respawnAtHospital(s, 220, 'Bailed out of Velmara Central.'); });

    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      var raw = (now - last) / 1000;
      last = now;
      // clamp BOTH ways: never negative, never a physics-leap, and a floor so
      // a stalled compositor still creeps forward instead of freezing solid.
      var dt = Math.min(Math.max(raw, 0.004), 0.05);
      if (state.mode !== 'title' && state.mode !== 'pause') step(state, dt);
      else VN.ui.update(state, 0);
      renderer.render(state.scene, camera);
    }
    requestAnimationFrame(frame);
  }

  function startGame(s, save) {
    if (VN.sound) VN.sound.ensure();
    document.getElementById('title').classList.remove('show');
    document.getElementById('hud').classList.add('show');
    if (save) {
      s.player.cash = save.cash; s.player.rep = save.rep;
      s.story.missionIndex = save.missionIndex || 0;
      s.story.completed = save.completed || [];
      if (typeof save.x === 'number') { s.player.x = save.x; s.player.z = save.z; }
      VN.ui.toast(s, 'Welcome back to Velmara, Jax.');
    } else {
      VN.story.clearSave();
      VN.ui.toast(s, 'Find Odile Vane at her booth on the Neon Mile.');
    }
    s.mode = 'foot';
    camYaw = s.player.ry;
  }
  function togglePause(s) {
    if (s.mode === 'pause') {
      document.getElementById('pause').classList.remove('show');
      s.mode = s.prevMode || 'foot';
    } else if (s.mode === 'foot' || s.mode === 'drive') {
      s.prevMode = s.mode;
      s.mode = 'pause';
      document.getElementById('pause').classList.add('show');
      VN.story.saveGame(s);
    }
  }

  // --- input -----------------------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (!state) return;
    var s = state;
    if (VN.sound && (s.mode === 'foot' || s.mode === 'drive')) VN.sound.ensure();
    if (e.code === 'Space') e.preventDefault();
    if (s.mode === 'dialogue' && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) { VN.ui.nextLine(s); return; }
    if (e.code === 'Escape' || e.code === 'KeyP' && false) { /* handled below */ }
    if (e.code === 'Escape') { togglePause(s); return; }
    if (s.mode === 'title' || s.mode === 'pause' || s.mode === 'wasted' || s.mode === 'busted') return;
    if (e.code === 'KeyP') { s.showMap = !s.showMap; document.getElementById('bigmap').style.display = s.showMap ? 'block' : 'none'; return; }
    if (e.code === 'KeyM') { var m = VN.sound.toggleMute(); VN.ui.toast(s, m ? 'Sound muted.' : 'Sound on.'); return; }
    if (e.code === 'KeyE' && s.interactCd <= 0) { s.interactCd = 0.35; doInteract(s); return; }
    if (e.code === 'KeyR' && s.mode === 'foot') VN.story.startRace(s);
    if (e.code === 'KeyC' && s.mode === 'foot') VN.story.startCourier(s);
    if (e.code === 'KeyF') VN.combat.melee(s);
    if (e.code === 'KeyR' && s.mode === 'drive') { /* R is race on foot only */ }
    if (e.code === 'KeyQ') VN.combat.reload(s);
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('mousemove', function (e) {
    if (!state || !pointerLocked) return;
    camYaw -= e.movementX * 0.0026;
    camPitch += e.movementY * 0.0022;
    camPitch = Math.max(-0.12, Math.min(1.0, camPitch));
    if (state.mode === 'foot') state.player.aiming = true;
  });
  window.addEventListener('mousedown', function (e) {
    if (!state) return;
    var s = state;
    if (s.mode !== 'foot' && s.mode !== 'drive') return;
    var canvas = document.getElementById('game');
    if (!pointerLocked && e.target === canvas) { canvas.requestPointerLock(); return; }
    if (s.mode === 'foot' && pointerLocked) {
      s.player.aiming = true;
      if (e.button === 0) VN.combat.playerShoot(s);
    }
  });
  document.addEventListener('pointerlockchange', function () {
    pointerLocked = document.pointerLockElement === document.getElementById('game');
    if (!pointerLocked && state) state.player.aiming = false;
  });
  window.addEventListener('blur', function () { keys = {}; });

  // Lightweight probe hooks for automated checks (not used by gameplay).
  window.__vn = {
    get state() { return state; },
    startGame: function () { if (state) startGame(state, null); },
    interact: function () { if (state) doInteract(state); },
    keys: keys
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { createState: createState };
})();
