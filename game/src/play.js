// play.js — boot, states, main loop (dt clamped both ways), input, save/Continue, respawn
window.VN = window.VN || {};
(function () {
  var params = new URLSearchParams(location.search);
  var seed = parseInt(params.get('seed') || '7', 10) || 7;
  var shot = params.get('shot');
  var scene, camera, renderer, clock;
  var keys = {};
  var game = {
    state: 'title', cash: 120, rep: 0, rank: 'ROOKIE', clockMin: 22 * 60 + 10,
    hero: null, car: null, inCar: false, traffic: [], parked: [], peds: [], allCars: [],
    camYaw: 0, camPitch: 0.32, gunfireT: 0, aiming: false, markerOverride: null, elapsed: 0,
    get pos() { return this.inCar && this.car ? { x: this.car.x, z: this.car.z } : { x: this.hero.x, z: this.hero.z }; },
    get heading() { return this.inCar && this.car ? this.car.heading : this.hero.heading; },
    get marker() {
      if (this.markerOverride) return this.markerOverride;
      var side = VN.sideJobs.marker(); if (side) return side;
      if (VN.story.active) { var s = VN.story.stepDef(); if (s && (s.kind === 'goto' || s.kind === 'steal' || s.kind === 'hold' || s.kind === 'clear')) return { x: s.x, z: s.z }; return null; }
      if (!VN.story.done) return { x: 10, z: 96 };
      return null;
    },
    addCash: function (n, why) { this.cash += n; VN.ui.showBanner('+$' + n + (why ? ' — ' + why : '')); VN.sound.cash(); },
    addRep: function (n) {
      this.rep += n;
      this.rank = this.rep >= 120 ? 'VELMARA LEGEND' : this.rep >= 80 ? 'WHEELMAN' : this.rep >= 45 ? 'RUNNER' : this.rep >= 20 ? 'COURIER' : 'ROOKIE';
    },
    save: function () {
      try { localStorage.setItem('velmara-save', JSON.stringify({ cash: this.cash, rep: this.rep, mission: VN.story.idx, clockMin: this.clockMin })); } catch (e) {}
    },
    loadSave: function () {
      try { var s = JSON.parse(localStorage.getItem('velmara-save') || 'null'); if (!s) return false; this.cash = s.cash; this.rep = s.rep; VN.story.idx = s.mission || 0; this.clockMin = s.clockMin || this.clockMin; this.addRep(0); return true; } catch (e) { return false; }
    },
    enterCar: function (car, silent) {
      this.car = car; this.inCar = true; car.driver = 'player'; car.parked = false; car.traffic = false;
      this.hero.mesh.visible = false;
      if (!silent) { VN.sound.init(); }
    },
    exitCar: function () {
      if (!this.car) return;
      this.hero.x = this.car.x + Math.cos(this.car.heading) * 2.4; this.hero.z = this.car.z - Math.sin(this.car.heading) * 2.4;
      this.hero.mesh.visible = true; this.car.driver = null; this.car.parked = true; this.car = null; this.inCar = false;
    },
    nearestCar: function (maxD) {
      var best = null, bd = maxD || 4.5, self = this;
      this.allCars.concat(this.traffic).forEach(function (c) {
        var d = Math.hypot(c.x - self.hero.x, c.z - self.hero.z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    },
    respawn: function (kind) {
      VN.law.reset(scene);
      this.exitCarSilent();
      this.hero.health = 100; this.hero.x = VN.city.hospital.x; this.hero.z = VN.city.hospital.z;
      this.hero.mesh.visible = true;
      var fee = Math.min(this.cash, kind === 'busted' ? 150 : 100);
      this.cash -= fee;
      VN.ui.showBanner((kind === 'busted' ? 'BUSTED' : 'WASTED') + ' — St. Mirella fee $' + fee);
      this.state = 'play'; document.getElementById('dead').style.display = 'none';
    },
    exitCarSilent: function () { if (this.car) { this.car.driver = null; this.car = null; } this.inCar = false; },
    startGame: function (fresh) {
      document.getElementById('title').style.display = 'none';
      document.getElementById('hud').style.display = 'block';
      if (!fresh) VN.sound.init();
      this.state = 'play';
      if (!VN.story.active && !VN.story.done) VN.ui.setObjective('Meet Odile at her Neon Mile booth (pink marker)');
    },
    updateHUDAndMap: function () {
      VN.ui.updateHUD(this); VN.ui.drawMinimap(this);
      if (VN.ui.mapOpen) VN.ui.drawFullMap(this);
    }
  };
  VN.game = game;
  Object.defineProperty(VN, 'camYaw', { get: function () { return game.camYaw; }, set: function (v) { game.camYaw = v; } });

  function boot() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1c);
    scene.fog = new THREE.FogExp2(0x0d1120, 0.0038);
    camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    document.getElementById('app').appendChild(renderer.domElement);
    // brightened lighting pass (proven fix)
    scene.add(new THREE.AmbientLight(0x8899bb, 0.85));
    var hemi = new THREE.HemisphereLight(0xbfd4ff, 0x2a2438, 1.05); scene.add(hemi);
    var moon = new THREE.DirectionalLight(0xaac4ff, 0.75); moon.position.set(80, 160, -60); scene.add(moon);
    var neonGlow = new THREE.PointLight(0xff4fd8, 1.1, 130); neonGlow.position.set(30, 16, 140); scene.add(neonGlow);
    var harborGlow = new THREE.PointLight(0x37f2ff, 0.9, 150); harborGlow.position.set(180, 18, 280); scene.add(harborGlow);
    game.scene = scene;
    VN.buildCity(scene, seed);
    var rnd = VN.mulberry(seed * 31 + 5);
    game.hero = VN.makeHero(); scene.add(game.hero.mesh);
    game.traffic = VN.spawnTraffic(scene, rnd, 19);
    game.parked = VN.spawnParked(scene, rnd, 12);
    game.allCars = game.parked.slice();
    // the indigo Orphee GT for mission 3 sits in parked spots (26,-14)
    game.peds = VN.spawnPeds(scene, rnd, 26);
    // Odile herself at her booth
    var odile = VN.makePerson(10, 99.5, 0xff4fd8, 0x3a1030, 0xd9a077);
    scene.add(odile.mesh); game.odile = odile;
    // objective marker beam
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 26, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe14f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    beam.name = 'beam'; scene.add(beam); game.beam = beam;
    VN.ui.init();
    clock = new THREE.Clock();
    bindInput();
    document.getElementById('btn-new').addEventListener('click', function () { try { localStorage.removeItem('velmara-save'); } catch (e) {} VN.story.idx = 0; game.cash = 120; game.rep = 0; game.startGame(false); });
    document.getElementById('btn-continue').addEventListener('click', function () { game.loadSave(); game.startGame(false); });
    if (shot) { VN.applyShot(shot); }
    requestAnimationFrame(loop);
    VN.__ready = true;
  }

  function bindInput() {
    addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase(); keys[k] = true;
      if (k === ' ') e.preventDefault();
      VN.sound.init();
      if (game.state === 'dialogue' && (k === 'e' || k === 'enter' || k === ' ')) { VN.ui.nextDialogue(); return; }
      if (k === 'm') { var muted = VN.sound.toggleMute(); void muted; }
      if (k === 'p' && game.state === 'play') { VN.ui.mapOpen = !VN.ui.mapOpen; document.getElementById('fullmap').style.display = VN.ui.mapOpen ? 'block' : 'none'; }
      if (k === 'escape' && game.state === 'play') { game.state = 'pause'; document.getElementById('pause').style.display = 'flex'; }
      else if (k === 'escape' && game.state === 'pause') { game.state = 'play'; document.getElementById('pause').style.display = 'none'; }
      if (game.state !== 'play') return;
      if (k === 'e') interact();
      if (k === 'r') VN.combat.startReload();
      if (k === 'f') VN.combat.melee(game.hero, VN.combat.thugs.concat(game.peds));
      if (k === 'g' && !game.inCar) { // rob nearest ped at gunpoint
        var near = game.peds.find(function (p) { return Math.hypot(p.x - game.hero.x, p.z - game.hero.z) < 8 && p.health > 0; });
        if (near && !near.robbed) { near.robbed = true; game.addCash(35, 'Robbery'); VN.law.reportCrime(22, scene, game.pos); }
      }
      if (k === '1') VN.sideJobs.startRace();
      if (k === '2') VN.sideJobs.startCourier(VN.mulberry((Math.random() * 1e6) | 0));
    });
    addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    addEventListener('mousemove', function (e) {
      if (game.state !== 'play') return;
      game.camYaw -= e.movementX * 0.0032;
      game.camPitch = Math.max(0.08, Math.min(0.9, game.camPitch + e.movementY * 0.002));
      game.aiming = true;
    });
    addEventListener('mousedown', function (e) {
      if (game.state !== 'play' || game.inCar || e.button !== 0) return;
      VN.sound.init();
      var dir = { x: Math.sin(game.hero.heading), z: Math.cos(game.hero.heading) };
      var targets = VN.combat.thugs.concat(game.peds);
      if (VN.combat.shoot(scene, game.hero, dir, targets, function () { game.gunfireT = 2.5; VN.law.reportCrime(20, scene, game.pos); })) game.gunfireT = 2.5;
    });
    addEventListener('resize', function () { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
    document.getElementById('btn-resume').addEventListener('click', function () { game.state = 'play'; document.getElementById('pause').style.display = 'none'; });
    document.getElementById('btn-save').addEventListener('click', function () { game.save(); VN.ui.showBanner('SAVED'); });
  }

  function interact() {
    if (game.inCar) { game.exitCar(); return; }
    // Odile dialogue
    if (Math.hypot(game.hero.x - 10, game.hero.z - 99.5) < 5) {
      var m = VN.story.current();
      if (m && !VN.story.active) { VN.ui.dialogue(m.intro, function () { VN.story.start(); }); }
      else if (VN.story.done) VN.ui.dialogue([['Odile', 'Velmara runs on your wheels now, Jax. Races on 1, courier runs on 2.']], null);
      else VN.ui.dialogue([['Odile', 'Finish the run first, Jax. The marker never lies.']], null);
      return;
    }
    var car = game.nearestCar(4.5);
    if (car) {
      var wasTraffic = car.traffic;
      game.enterCar(car);
      VN.ui.showBanner('DRIVING — ' + car.model.name);
      if (wasTraffic || car.parked) VN.law.reportCrime(wasTraffic ? 30 : 14, scene, game.pos);
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, Math.max(0.001, clock.getDelta())); // clamp both ways
    var t = clock.elapsedTime;
    if (VN.city && VN.city.rain) {
      VN.city.rain.position.set(game.pos.x, 0, game.pos.z);
      var arr = VN.city.rain.geometry.attributes.position.array;
      for (var i = 0; i < arr.length; i += 3) { arr[i + 1] -= dt * 34; if (arr[i + 1] < 0) arr[i + 1] = 55; }
      VN.city.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (game.state === 'play' || game.state === 'dialogue') {
      game.elapsed += dt; game.clockMin += dt * 1.4;
      if (game.gunfireT > 0) game.gunfireT -= dt;
      var heroPos = game.pos;
      if (game.state === 'play') {
        if (game.inCar && game.car) {
          game.car.updateDrive(dt, keys);
          VN.sound.engine(Math.abs(game.car.speed) / game.car.model.top);
          if (game.car.health <= 0) { VN.ui.showBanner('VEHICLE WRECKED'); game.exitCar(); }
        } else {
          game.hero.update(dt, keys);
        }
      }
      VN.updateTraffic(game.traffic, dt, heroPos, game.gunfireT > 0);
      VN.updatePeds(game.peds, dt, heroPos, game.gunfireT > 0, game.aiming);
      VN.combat.update(dt, scene, game.inCar && game.car ? game.car : game.hero, function (dmg) {
        if (!game.inCar) { game.hero.health -= dmg; if (game.hero.health <= 0) dead('wasted'); }
      });
      VN.story.update(dt, heroPos, game.inCar);
      VN.sideJobs.update(dt, heroPos);
      var hidden = VN.law.cars.every(function (c) { return Math.hypot(c.x - heroPos.x, c.z - heroPos.z) > 70; }) && VN.law.wanted > 0;
      VN.law.update(dt, scene, { x: heroPos.x, z: heroPos.z, speed: game.inCar && game.car ? game.car.speed : game.hero.speed }, hidden, function () { dead('busted'); });
      VN.sound.bassline(dt);
      // marker beam
      var mk = game.marker;
      if (mk) { game.beam.visible = true; game.beam.position.set(mk.x, 13, mk.z); game.beam.material.opacity = 0.22 + Math.sin(t * 3) * 0.1; }
      else game.beam.visible = false;
      game.updateHUDAndMap();
    }
    // camera: orbit behind target
    var target = game.inCar && game.car ? game.car : game.hero;
    if (target) {
      var dist = game.inCar ? 11.5 : 8.5, height = game.inCar ? 4.2 : 3.1;
      var cx = target.x + Math.sin(game.camYaw) * Math.cos(game.camPitch) * dist;
      var cz = target.z + Math.cos(game.camYaw) * Math.cos(game.camPitch) * dist;
      var cy = height + Math.sin(game.camPitch) * dist * 0.6;
      if (!VN.collides(cx, cz, 0.3)) { camera.position.set(cx, cy, cz); }
      camera.lookAt(target.x, 1.6, target.z);
    }
    renderer.render(scene, camera);
  }
  function dead(kind) {
    game.state = 'dead';
    var el = document.getElementById('dead');
    el.style.display = 'flex';
    document.getElementById('dead-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    setTimeout(function () { game.respawn(kind); }, shot ? 99999 : 1600);
  }
  game._dead = dead;
  VN.gameRef = game;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // test / probe surface
  VN.__VN = {
    game: game, keys: keys,
    counts: function () {
      var objs = 0; scene.traverse(function () { objs++; });
      return { buildings: VN.city.buildings.length, streetlights: VN.city.lights.length, cars: game.traffic.length + game.parked.length, peds: game.peds.length, drawObjects: objs, rendererCalls: renderer.info.render.calls };
    }
  };
})();
