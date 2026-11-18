// play.js — boot and the main loop of Velmara Nights. Owns the renderer,
// the night sky and rain, the orbit camera, all keyboard/mouse input, the
// title → play → pause → end state machine, entering and stealing cars,
// crime and damage callbacks for the other systems, the hospital respawn,
// and the localStorage save. The frame dt is clamped both ways so a
// hitched tab can never teleport the world.
window.V = window.V || {};
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var SEED = parseInt(params.get('seed') || '7', 10);
  if (isNaN(SEED)) SEED = 7;
  var SHOT = params.get('shot');

  var SAVE_KEY = 'velmara-nights-save-v1';
  var scene, camera, renderer, city, rain, rainPos;
  var state = SHOT ? 'shot' : 'title';   // title | play | pause | end | shot
  var keys = {};
  var mouseL = false, mouseR = false, pointerLocked = false;
  var camYaw = 2.6, camPitch = 0.34, lastMouseMove = -9;
  var clockMinutes = 21 * 60;
  var cash = 250;
  var playerCar = null;
  var endTimer = 0, raceCooldown = 0;
  var elapsed = 0;
  var mapOpen = false;
  var heroRef = null;

  // ---------------------------------------------------------------- boot
  function boot() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a14);
    scene.fog = new THREE.Fog(0x0d1322, 60, 470);
    V.sceneRef = scene;
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    document.getElementById('stage').appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x54648c, 0x141824, 1.5));
    var moon = new THREE.DirectionalLight(0x8fb4ff, 0.75);
    moon.position.set(90, 160, -70);
    scene.add(moon);
    scene.add(new THREE.AmbientLight(0x39466a, 0.85));
    // a low moon disc and its halo, pure decoration
    var moonDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 24),
      new THREE.MeshBasicMaterial({ color: 0xdfe9ff, fog: false }));
    moonDisc.position.set(190, 150, -330);
    moonDisc.lookAt(0, 40, 0);
    scene.add(moonDisc);

    city = V.generateCity(SEED);
    V.cityRef = city;
    scene.add(city.group);

    heroRef = V.createHero(scene, city.playerStart);
    V.initCars(scene, city);
    V.initCrowds(scene, city);
    V.initLaw(scene);
    V.initCombat(scene);
    V.initStory(scene, city);
    makeRain();
    wireCallbacks();
    wireInput();
    wireButtons();

    if (SHOT) {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      cash = 1240;
      V.story.rep = 46;
      V.poseShot(SHOT, api());
    } else {
      refreshContinueButton();
    }
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    requestAnimationFrame(loop);
  }

  function api() {
    return {
      scene: scene, camera: camera, city: city, hero: heroRef,
      setCamera: function (x, y, z, lx, ly, lz) {
        camera.position.set(x, y, z);
        camera.lookAt(lx, ly, lz);
      },
      getState: function () { return state; }
    };
  }

  function makeRain() {
    var N = 1500;
    rainPos = new Float32Array(N * 3);
    var rng = V.makeRng(99);
    for (var i = 0; i < N; i++) {
      rainPos[i * 3] = (rng() - 0.5) * 110;
      rainPos[i * 3 + 1] = rng() * 42;
      rainPos[i * 3 + 2] = (rng() - 0.5) * 110;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9db8d8, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false
    }));
    rain.frustumCulled = false;
    scene.add(rain);
  }

  function updateRain(dt) {
    var cx = camera.position.x, cz = camera.position.z;
    for (var i = 0; i < rainPos.length; i += 3) {
      rainPos[i + 1] -= 30 * dt;
      rainPos[i] -= 3.5 * dt;
      if (rainPos[i + 1] < 0) {
        rainPos[i + 1] = 40;
        rainPos[i] = cx + (Math.random() - 0.5) * 110;
        rainPos[i + 2] = cz + (Math.random() - 0.5) * 110;
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;
    rain.position.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- saves
  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: cash, rep: V.story.rep, nextMission: V.story.nextMission,
        storyDone: V.story.storyDone, raceBest: V.story.raceBest || 0,
        ammo: V.gun.ammo, reserve: V.gun.reserve
      }));
    } catch (e) { /* private mode: saving is best-effort */ }
  }
  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function refreshContinueButton() {
    document.getElementById('btn-continue').disabled = !loadSave();
  }

  function startNewGame() {
    cash = 250;
    V.story.rep = 0;
    V.story.nextMission = 0;
    V.story.storyDone = false;
    V.story.raceBest = 0;
    V.gun.ammo = 12; V.gun.reserve = 96;
    beginPlay();
    V.toast('Velmara Nights — go see Odile Vane at her booth on the Neon Mile.');
  }
  function continueGame() {
    var s = loadSave();
    if (!s) { startNewGame(); return; }
    cash = s.cash; V.story.rep = s.rep; V.story.nextMission = s.nextMission;
    V.story.storyDone = s.storyDone; V.story.raceBest = s.raceBest || 0;
    V.gun.ammo = s.ammo; V.gun.reserve = s.reserve;
    beginPlay();
    V.toast('Welcome back to Velmara, Jax.');
  }
  function beginPlay() {
    state = 'play';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (V.sound) V.sound.start();
  }

  // ---------------------------------------------------------------- wiring
  function wireButtons() {
    var ui = V.ui.el;
    ui.btnNew.addEventListener('click', startNewGame);
    ui.btnContinue.addEventListener('click', continueGame);
    ui.btnResume.addEventListener('click', function () {
      document.getElementById('pause-screen').classList.add('hidden');
      state = 'play';
    });
    ui.btnSave.addEventListener('click', function () {
      saveGame();
      V.toast('Saved. Velmara will wait for you, Jax.');
    });
    ui.btnRestart.addEventListener('click', function () {
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {}
      window.location.reload();
    });
  }

  function wireCallbacks() {
    V.onCarCrash = function (other, speed) {
      if (V.sound) V.sound.crash();
      if (speed > 11) V.reportCrime(6, other.x, other.z, false);
    };
    V.onRobbery = function (loot) {
      cash += loot;
      if (V.sound) V.sound.cash();
      V.toast('Robbed $' + loot + ' at gunpoint.');
    };
    V.onOfficerShoot = function (officer, dist) {
      var hero = heroRef;
      var tx = playerCar ? playerCar.x : hero.x;
      var tz = playerCar ? playerCar.z : hero.z;
      V.drawTracer(officer.x, 1.45, officer.z,
        tx + (Math.random() - 0.5) * 2.2, 1.2, tz + (Math.random() - 0.5) * 2.2, 0x7fb8ff);
      if (V.sound) V.sound.gunshot(true);
      var chance = 0.4 - dist * 0.006;
      if (Math.random() < chance) hurtPlayer(3 + Math.random() * 5);
    };
    V.onPoliceRam = function () { if (V.sound) V.sound.crash(); };
    V.onMissionComplete = function (def) {
      cash += def.cash;
      if (V.sound) V.sound.cash();
      V.toast(def.title + ' complete — +$' + def.cash + ', + ' + def.rep + ' REP');
      saveGame();
    };
    V.onRaceComplete = function (t, pay) {
      cash += pay;
      if (V.sound) V.sound.cash();
      V.toast('TIME TRIAL finished in ' + t.toFixed(1) + 's — +$' + pay +
        (V.story.raceBest ? ' · best ' + V.story.raceBest.toFixed(1) + 's' : ''));
      saveGame();
    };
    V.onThugDown = function () { cash += 25; };
    V.onBusted = function () { endRun('busted'); };
    V.hurtPlayer = hurtPlayer;
  }

  function hurtPlayer(dmg) {
    if (state !== 'play') return;
    if (playerCar) {
      // shots and rams chew the car first
      V.damageCar(playerCar, dmg * 0.7, playerCar.x, playerCar.z);
      dmg *= 0.35;
    }
    heroRef.health -= dmg;
    V.ui.flashDamage();
    if (heroRef.health <= 0) endRun('wasted');
  }

  function endRun(kind) {
    if (state !== 'play') return;
    state = 'end';
    endTimer = 2.8;
    if (V.story.active) V.failMission(kind === 'busted' ? 'you were busted' : 'you were wasted');
    var fee = kind === 'busted' ? 150 : 200;
    cash = Math.max(0, cash - fee);
    V.ui.showEnd(kind, kind === 'busted'
      ? 'The law impounds your pride and $' + fee + '. Released outside St. Mirella at dawn.'
      : 'St. Mirella patched you up — $' + fee + ' on the tab Odile pretends not to keep.');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function respawn() {
    V.ui.hideEnd();
    V.clearHeat();
    if (playerCar) {
      playerCar.driver = 'parked';
      playerCar = null;
    }
    heroRef.inCar = null;
    heroRef.group.visible = true;
    heroRef.x = city.hospital.spawnX;
    heroRef.z = city.hospital.spawnZ;
    heroRef.health = 100;
    heroRef.group.position.set(heroRef.x, 0, heroRef.z);
    state = 'play';
    saveGame();
  }

  // ---------------------------------------------------------------- input
  function wireInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (state === 'play') {
        if (e.code === 'KeyE') interact();
        if (e.code === 'KeyR') V.startReload();
        if (e.code === 'KeyF' && !playerCar) V.melee({});
        if (e.code === 'KeyP') {
          mapOpen = !mapOpen;
          document.getElementById('bigmap').classList.toggle('hidden', !mapOpen);
        }
        if (e.code === 'KeyM' && V.sound) {
          V.toast(V.sound.toggleMute() ? 'Sound off.' : 'Sound on.');
        }
        if (e.code === 'Escape') pauseGame();
      } else if (state === 'pause' && e.code === 'Escape') {
        document.getElementById('pause-screen').classList.add('hidden');
        state = 'play';
      }
      if (['ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    var canvas = renderer.domElement;
    canvas.addEventListener('mousedown', function (e) {
      if (state !== 'play') return;
      if (e.button === 0) {
        mouseL = true;
        if (!playerCar && !V.story.dialogue) V.shoot(camera, {});
      }
      if (e.button === 2) mouseR = true;
      if (!pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) mouseL = false;
      if (e.button === 2) mouseR = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('pointerlockchange', function () {
      pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', function (e) {
      if (state !== 'play') return;
      if (pointerLocked) {
        camYaw -= e.movementX * 0.0028;
        camPitch = V.clamp(camPitch + e.movementY * 0.0022, -0.08, 1.0);
        lastMouseMove = elapsed;
      }
    });
  }

  function pauseGame() {
    if (state !== 'play') return;
    state = 'pause';
    var ui = V.ui.el;
    ui.pauseStats.textContent = 'Cash $' + cash + ' · REP ' + V.story.rep +
      ' (' + V.rankFor(V.story.rep) + ') · Missions done: ' + V.story.nextMission + '/6';
    document.getElementById('pause-screen').classList.remove('hidden');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  // ---------------------------------------------------------------- interact
  function interact() {
    if (V.story.dialogue) { V.advanceDialogue(); return; }
    var hero = heroRef;
    if (playerCar) {
      // climb out
      var side = 1.9;
      hero.x = playerCar.x + Math.cos(playerCar.ry) * side;
      hero.z = playerCar.z - Math.sin(playerCar.ry) * side;
      var fixed = V.collideCircle(city, hero.x, hero.z, 0.55);
      hero.x = fixed.x; hero.z = fixed.z;
      hero.ry = playerCar.ry;
      hero.group.position.set(hero.x, 0, hero.z);
      hero.group.visible = true;
      hero.inCar = null;
      playerCar.driver = 'parked';
      playerCar.speed = 0;
      playerCar = null;
      if (V.sound) V.sound.door();
      return;
    }
    // talk to Odile?
    if (V.odile && V.dist2d(hero.x, hero.z, V.odile.x, V.odile.z) < 4.2) {
      V.talkToOdile(city);
      return;
    }
    // steal / enter a car
    var car = V.nearestCar(hero.x, hero.z, 3.6);
    if (car && !car.dead) {
      var wasDriver = car.driver;
      if (wasDriver === 'traffic') {
        V.reportCrime(9, car.x, car.z, true);
        V.crowdPanic(car.x, car.z, 9);
        V.toast('Dragged the driver out — the car is yours.');
      } else if (wasDriver === 'police') {
        V.reportCrime(14, car.x, car.z, false);
      } else if (car.isOrphee) {
        V.reportCrime(11, car.x, car.z, true);
      } else {
        V.reportCrime(4, car.x, car.z, true);
      }
      car.driver = 'player';
      car.ai = null;
      playerCar = car;
      hero.inCar = car;
      hero.group.visible = false;
      if (V.sound) { V.sound.door(); V.sound.start(); }
    }
  }

  function interactHint() {
    var hero = heroRef;
    if (V.story.dialogue) return '<b>E</b> ▸ continue';
    if (playerCar) return '<b>E</b> ▸ get out';
    if (V.odile && V.dist2d(hero.x, hero.z, V.odile.x, V.odile.z) < 4.2) {
      return V.story.active ? 'Odile is watching the clock…' : '<b>E</b> ▸ talk to Odile Vane';
    }
    var car = V.nearestCar(hero.x, hero.z, 3.6);
    if (car && !car.dead) {
      return car.driver === 'traffic' ? '<b>E</b> ▸ steal the car' : '<b>E</b> ▸ drive';
    }
    if (!V.story.active && !V.story.race &&
        V.dist2d(hero.x, hero.z, city.raceStart.x, city.raceStart.z) < 10) {
      return 'Drive here to start the Neon Mile time trial';
    }
    return '';
  }

  // ---------------------------------------------------------------- camera
  function updateCamera(dt) {
    var hero = heroRef;
    if (state === 'title') {
      var t = elapsed * 0.045;
      camera.position.set(Math.sin(t) * 120, 40, Math.cos(t) * 120);
      camera.lookAt(0, 6, 0);
      return;
    }
    var tx, tz, ty, dist;
    if (playerCar) {
      tx = playerCar.x; tz = playerCar.z; ty = 1.4; dist = 10.6;
      // ease the camera behind the car when the mouse is idle
      if (elapsed - lastMouseMove > 1.6) {
        var behind = playerCar.ry + Math.PI;
        camYaw += V.angleDelta(camYaw, behind) * Math.min(1, dt * 2.6);
        camPitch += (0.30 - camPitch) * Math.min(1, dt * 2);
      }
    } else {
      tx = hero.x; tz = hero.z; ty = 1.65; dist = 6.4;
    }
    var cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    var cx = tx + Math.sin(camYaw) * cp * dist;
    var cz = tz + Math.cos(camYaw) * cp * dist;
    var cy = ty + sp * dist;
    if (cy < 0.7) cy = 0.7;
    camera.position.set(cx, cy, cz);
    camera.lookAt(tx, ty + 0.4, tz);
  }

  // ---------------------------------------------------------------- loop
  var lastNow = 0;
  function loop(nowMs) {
    requestAnimationFrame(loop);
    var now = nowMs / 1000;
    var rawDt = lastNow ? (now - lastNow) : 0.016;
    lastNow = now;
    // clamp the frame step BOTH ways: never negative, never a teleport
    var dt = V.clamp(rawDt, 0, 0.05);
    elapsed += dt;
    var hero = heroRef;

    if (state === 'shot') {
      if (V.shotTick) V.shotTick(dt, api());
      updateRain(dt);
      renderer.render(scene, camera);
      return;
    }

    if (state === 'title') {
      V.updateCars(dt, city, null);
      V.updateCrowds(dt, city);
      updateCamera(dt);
      updateRain(dt);
      renderer.render(scene, camera);
      return;
    }

    if (state === 'end') {
      endTimer -= dt;
      V.updateCars(dt, city, null);
      updateRain(dt);
      renderer.render(scene, camera);
      if (endTimer <= 0) respawn();
      return;
    }
    if (state === 'pause') {
      renderer.render(scene, camera);
      return;
    }

    // ---- state === 'play' ----
    clockMinutes += dt * 1.1;
    var dialogueOpen = !!V.story.dialogue;
    hero.aiming = mouseR && !playerCar;
    if (hero.rig) hero.rig.pistol.visible = hero.aiming || mouseL;

    var px, pz, pSpeed;
    if (playerCar) {
      var input = {
        throttle: (keys.KeyW || keys.ArrowUp) ? 1 : ((keys.KeyS || keys.ArrowDown) ? -1 : 0),
        steer: (keys.KeyA || keys.ArrowLeft) ? 1 : ((keys.KeyD || keys.ArrowRight) ? -1 : 0),
        brake: !!keys.Space,
        handbrake: !!keys.Space
      };
      if (!dialogueOpen) V.stepPlayerCar(playerCar, dt, input, city);
      px = playerCar.x; pz = playerCar.z;
      pSpeed = Math.abs(playerCar.speed);
      hero.x = px; hero.z = pz;
      // time trial auto-start when idling at the start line with no mission
      if (raceCooldown > 0) raceCooldown -= dt;
      if (!V.story.active && !V.story.race && raceCooldown <= 0) {
        if (V.startRace(city, px, pz)) raceCooldown = 5;
      }
    } else {
      var mv = {
        x: (keys.KeyD || keys.ArrowRight) ? 1 : ((keys.KeyA || keys.ArrowLeft) ? -1 : 0),
        z: (keys.KeyW || keys.ArrowUp) ? 1 : ((keys.KeyS || keys.ArrowDown) ? -1 : 0)
      };
      if (!dialogueOpen) {
        V.updateHero(dt, mv, camYaw, !!(keys.ShiftLeft || keys.ShiftRight), city);
      }
      px = hero.x; pz = hero.z;
      pSpeed = hero.speedNow || 0;
    }

    var ctx = {
      city: city, px: px, pz: pz, pSpeed: pSpeed,
      inCar: !!playerCar, playerCar: playerCar,
      aiming: hero.aiming, camera: camera
    };
    V.updateCars(dt, city, playerCar);
    V.updateCrowds(dt, city);
    if (!dialogueOpen) {
      V.updateLaw(dt, ctx);
      V.updateCombat(dt, ctx);
      V.updateStory(dt, ctx);
    }
    if (city.water) city.water.material.opacity = 0.4 + Math.sin(elapsed * 0.8) * 0.07;

    // sound follows the action
    var nearestCop = 999;
    for (var i = 0; i < V.cruisers.length; i++) {
      nearestCop = Math.min(nearestCop, V.dist2d(V.cruisers[i].x, V.cruisers[i].z, px, pz));
    }
    if (V.sound) V.sound.update(dt, {
      driving: !!playerCar,
      speed: playerCar ? playerCar.speed : 0,
      throttle: playerCar && (keys.KeyW || keys.ArrowUp) ? 1 : 0,
      nearestCopDist: nearestCop, stars: V.law.stars, playing: true
    });

    updateCamera(dt);
    updateRain(dt);

    // HUD
    var hint = interactHint();
    var interactEl = V.ui.el.interact;
    if (hint) {
      interactEl.innerHTML = hint;
      interactEl.classList.remove('hidden');
    } else interactEl.classList.add('hidden');
    V.ui.update({
      cash: cash, rep: V.story.rep, rank: V.rankFor(V.story.rep),
      clockMinutes: clockMinutes, health: heroRef.health,
      busted: V.law.bustedMeter, stars: V.law.stars,
      inCar: !!playerCar,
      carSpeed: playerCar ? playerCar.speed : 0,
      carName: playerCar ? playerCar.kind.toUpperCase() + (playerCar.isOrphee ? ' GT' : '') : '',
      carHealth: playerCar ? playerCar.health : 100,
      ammo: V.gun.ammo, reserve: V.gun.reserve, reloading: V.gun.reloading > 0,
      px: px, pz: pz, ry: playerCar ? playerCar.ry : hero.ry,
      city: city, playing: true, mapOpen: mapOpen, dt: dt
    }, nowMs);

    renderer.render(scene, camera);
  }

  // A small, honest debug surface the automated input probe uses.
  V.debug = {
    state: function () { return state; },
    startNewGame: startNewGame,
    teleport: function (x, z) {
      heroRef.x = x; heroRef.z = z;
      heroRef.group.position.set(x, 0, z);
    },
    playerCar: function () { return playerCar; },
    cash: function () { return cash; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
