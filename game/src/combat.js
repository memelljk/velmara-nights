// combat.js — Jax's pistol: mouse aim, hitscan shots with tracers, reload,
// melee, gunpoint robberies, and the dock-crew thugs who shoot back. Hits
// are resolved against people, cars and the building boxes, so cover works.
window.V = window.V || {};
(function () {
  'use strict';

  var rng = V.makeRng(31337);
  var gun = { ammo: 12, mag: 12, reserve: 96, reloading: 0, cooldown: 0 };
  var thugs = [];
  var tracers = [];
  var sceneRef = null;
  var aimPed = null, aimTime = 0;

  function initCombat(scene) {
    sceneRef = scene;
    for (var i = 0; i < 14; i++) {
      var mat = new THREE.LineBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0 });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      tracers.push({ line: line, life: 0 });
    }
  }

  function drawTracer(x1, y1, z1, x2, y2, z2, colour) {
    for (var i = 0; i < tracers.length; i++) {
      var t = tracers[i];
      if (t.life <= 0) {
        var a = t.line.geometry.attributes.position.array;
        a[0] = x1; a[1] = y1; a[2] = z1; a[3] = x2; a[4] = y2; a[5] = z2;
        t.line.geometry.attributes.position.needsUpdate = true;
        t.line.material.color.setHex(colour || 0xffe9a3);
        t.line.material.opacity = 0.9;
        t.line.visible = true;
        t.life = 0.06;
        return;
      }
    }
  }

  // Ray vs the world: people (cylinders), cars (spheres), buildings (AABB).
  function rayHit(ox, oy, oz, dx, dy, dz, maxDist) {
    var best = { t: maxDist, kind: null, ref: null };
    var i, px, pz;
    function testPoint(x, y, z, radius, kind, ref) {
      var lx = x - ox, ly = y - oy, lz = z - oz;
      var t = lx * dx + ly * dy + lz * dz;
      if (t < 0.5 || t > best.t) return;
      var cx = ox + dx * t, cy = oy + dy * t, cz = oz + dz * t;
      var ddx = cx - x, ddy = cy - y, ddz = cz - z;
      if (ddx * ddx + ddy * ddy + ddz * ddz < radius * radius) {
        best = { t: t, kind: kind, ref: ref };
      }
    }
    for (i = 0; i < V.peds.length; i++) {
      var p = V.peds[i];
      if (p.state !== 'down') testPoint(p.x, 1.1, p.z, 0.75, 'ped', p);
    }
    for (i = 0; i < thugs.length; i++) {
      var th = thugs[i];
      if (!th.dead) testPoint(th.x, 1.1, th.z, 0.8, 'thug', th);
    }
    for (i = 0; i < V.officers.length; i++) {
      var of = V.officers[i];
      testPoint(of.x, 1.1, of.z, 0.75, 'officer', of);
    }
    var hero = V.hero();
    if (hero && !hero.inCar) testPoint(hero.x, 1.2, hero.z, 0.8, 'hero', hero);
    for (i = 0; i < V.cars.length; i++) {
      var c = V.cars[i];
      testPoint(c.x, 0.8, c.z, 2.3, 'car', c);
    }
    // building boxes block shots
    var list = V.cityRef ? V.cityRef.colliders : [];
    for (i = 0; i < list.length; i++) {
      var b = list[i];
      var tmin = 0, tmax = best.t;
      var axes = [[ox, dx, b.minX, b.maxX], [oz, dz, b.minZ, b.maxZ]];
      var ok = true;
      for (var a = 0; a < 2; a++) {
        var o = axes[a][0], d = axes[a][1], mn = axes[a][2], mx = axes[a][3];
        if (Math.abs(d) < 1e-6) { if (o < mn || o > mx) { ok = false; break; } }
        else {
          var t1 = (mn - o) / d, t2 = (mx - o) / d;
          if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin > 0.5 && tmin < best.t) best = { t: tmin, kind: 'wall', ref: null };
    }
    return best;
  }

  function shoot(camera, ctx) {
    if (gun.reloading > 0) return;
    if (gun.cooldown > 0) return;
    if (gun.ammo <= 0) {
      if (V.sound) V.sound.click();
      startReload();
      return;
    }
    gun.ammo--;
    gun.cooldown = 0.16;
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    var o = camera.position;
    var hit = rayHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, 90);
    var hero = V.hero();
    var mx = hero.x + Math.sin(hero.ry) * 0.4, mz = hero.z + Math.cos(hero.ry) * 0.4;
    drawTracer(mx, 1.45, mz, o.x + dir.x * hit.t, o.y + dir.y * hit.t, o.z + dir.z * hit.t);
    if (V.sound) V.sound.gunshot(false);
    V.crowdPanic(hero.x, hero.z, 20);
    V.reportCrime(7, hero.x, hero.z, false);
    if (hit.kind === 'ped') {
      var died = V.hurtPed(hit.ref, 55);
      if (died) V.reportCrime(16, hero.x, hero.z, false);
    } else if (hit.kind === 'thug') {
      hurtThug(hit.ref, 40);
    } else if (hit.kind === 'officer') {
      hit.ref.health -= 40;
      V.reportCrime(20, hero.x, hero.z, false);
    } else if (hit.kind === 'car') {
      V.damageCar(hit.ref, 7, hit.ref.x, hit.ref.z);
      if (hit.ref.driver === 'traffic' && hit.ref.ai) hit.ref.ai.panic = 4;
      if (hit.ref.driver === 'police') V.reportCrime(10, hero.x, hero.z, false);
    }
    if (gun.ammo === 0) startReload();
    if (V.onShot) V.onShot();
  }

  function startReload() {
    if (gun.reloading > 0 || gun.ammo === gun.mag || gun.reserve <= 0) return;
    gun.reloading = 1.15;
    if (V.sound) V.sound.reload();
  }

  function melee(ctx) {
    var hero = V.hero();
    var fx = hero.x + Math.sin(hero.ry) * 1.4, fz = hero.z + Math.cos(hero.ry) * 1.4;
    var i;
    for (i = 0; i < thugs.length; i++) {
      if (!thugs[i].dead && V.dist2d(thugs[i].x, thugs[i].z, fx, fz) < 1.6) {
        hurtThug(thugs[i], 55);
        if (V.sound) V.sound.thud();
        return;
      }
    }
    for (i = 0; i < V.peds.length; i++) {
      var p = V.peds[i];
      if (p.state !== 'down' && V.dist2d(p.x, p.z, fx, fz) < 1.6) {
        V.hurtPed(p, 45);
        V.reportCrime(9, hero.x, hero.z, true);
        if (V.sound) V.sound.thud();
        return;
      }
    }
  }

  // --- thugs ------------------------------------------------------------------
  function spawnThug(scene, x, z, opts) {
    opts = opts || {};
    var rig = V.buildHumanoid({ shirt: opts.colour || 0x6e2430, pants: 0x23242e, skin: 0xa87a52 });
    rig.pistol.visible = true;
    rig.group.position.set(x, 0, z);
    scene.add(rig.group);
    var thug = {
      rig: rig, group: rig.group, x: x, z: z, ry: 0, phase: 0,
      health: opts.health || 100, dead: false, shootT: 1.2 + rng() * 1.2,
      guard: !!opts.guard, homeX: x, homeZ: z, onDeath: opts.onDeath || null
    };
    thugs.push(thug);
    return thug;
  }

  function hurtThug(thug, dmg) {
    if (thug.dead) return;
    thug.health -= dmg;
    if (thug.health <= 0) {
      thug.dead = true;
      thug.group.rotation.x = -Math.PI / 2;
      thug.group.position.y = 0.25;
      if (V.onThugDown) V.onThugDown(thug);
      if (thug.onDeath) thug.onDeath(thug);
    }
  }

  function updateCombat(dt, ctx) {
    if (gun.cooldown > 0) gun.cooldown -= dt;
    if (gun.reloading > 0) {
      gun.reloading -= dt;
      if (gun.reloading <= 0) {
        var take = Math.min(gun.mag - gun.ammo, gun.reserve);
        gun.ammo += take; gun.reserve -= take;
      }
    }
    for (var i = 0; i < tracers.length; i++) {
      var t = tracers[i];
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
      }
    }
    // thug behaviour: close to range, strafe a little, shoot back
    var hero = V.hero();
    for (i = 0; i < thugs.length; i++) {
      var th = thugs[i];
      if (th.dead) continue;
      var d = V.dist2d(th.x, th.z, ctx.px, ctx.pz);
      var want = Math.atan2(ctx.px - th.x, ctx.pz - th.z);
      th.ry += V.angleDelta(th.ry, want) * Math.min(1, dt * 7);
      var moving = 0;
      if (d < 46 && d > 13) {
        th.x += Math.sin(th.ry) * 3.4 * dt;
        th.z += Math.cos(th.ry) * 3.4 * dt;
        var f = V.collideCircle(ctx.city, th.x, th.z, 0.5);
        th.x = f.x; th.z = f.z;
        th.phase += dt * 7;
        moving = 1;
      } else if (d <= 13) {
        th.phase += dt * 1.2;
      }
      th.group.position.set(th.x, 0, th.z);
      th.group.rotation.y = th.ry;
      th.rig.aiming = d < 46;
      if (th.rig.aiming) th.rig.armR.rotation.x = -1.35;
      V.animateHumanoid(th.rig, th.phase, moving ? 0.8 : 0.1);
      if (d < 42) {
        th.shootT -= dt;
        if (th.shootT <= 0) {
          th.shootT = 1.0 + rng() * 1.1;
          drawTracer(th.x, 1.45, th.z, ctx.px + (rng() - 0.5) * 2.4, 1.2, ctx.pz + (rng() - 0.5) * 2.4, 0xff9a6e);
          if (V.sound) V.sound.gunshot(true);
          var hitChance = V.clamp(0.55 - d * 0.008 - (ctx.pSpeed > 6 ? 0.18 : 0), 0.12, 0.55);
          if (rng() < hitChance && V.hurtPlayer) V.hurtPlayer(4 + rng() * 6);
        }
      }
    }
    // gunpoint robbery: hold aim on a pedestrian up close
    if (ctx.aiming && hero && !hero.inCar) {
      var dir2 = new THREE.Vector3();
      ctx.camera.getWorldDirection(dir2);
      var o2 = ctx.camera.position;
      var hit2 = rayHit(o2.x, o2.y, o2.z, dir2.x, dir2.y, dir2.z, 9);
      if (hit2.kind === 'ped') {
        if (aimPed !== hit2.ref) {
          if (aimPed && aimPed.state === 'aimed') aimPed.state = 'stroll';
          aimPed = hit2.ref;
          aimPed.state = 'aimed';
          aimTime = 0;
        }
        aimTime += dt;
        if (aimTime > 0.8 && !aimPed.robbed) {
          aimPed.robbed = true;
          aimPed.state = 'handsup';
          aimPed.timer = 1.4;
          aimPed.robberX = hero.x; aimPed.robberZ = hero.z;
          var loot = 18 + ((rng() * 65) | 0);
          if (V.onRobbery) V.onRobbery(loot, aimPed);
          V.reportCrime(13, hero.x, hero.z, false);
          aimPed = null; aimTime = 0;
        }
      } else {
        if (aimPed && aimPed.state === 'aimed') aimPed.state = 'stroll';
        aimPed = null; aimTime = 0;
      }
    } else if (aimPed) {
      if (aimPed.state === 'aimed') aimPed.state = 'stroll';
      aimPed = null; aimTime = 0;
    }
  }

  V.gun = gun;
  V.initCombat = initCombat;
  V.shoot = shoot;
  V.startReload = startReload;
  V.melee = melee;
  V.spawnThug = spawnThug;
  V.hurtThug = hurtThug;
  V.updateCombat = updateCombat;
  V.thugs = thugs;
  V.drawTracer = drawTracer;
})();
