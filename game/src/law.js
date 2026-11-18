// law.js — Velmara's wanted system and its police. Crimes raise heat when
// a witness is near; heat becomes 0–5 stars; stars bring interceptor
// cruisers that hunt and ram, and at high stars foot officers who pile out
// and close in. Stay out of sight and the heat bleeds away. Get cornered
// while slow and the BUSTED meter fills.
window.V = window.V || {};
(function () {
  'use strict';

  var STAR_HEAT = [0, 12, 30, 55, 85, 120];
  var law = {
    heat: 0, stars: 0, bustedMeter: 0,
    lastCrimeAt: -99, hiddenTime: 0, time: 0
  };
  var cruisers = [];
  var officers = [];
  var rng = V.makeRng(777);
  var sceneRef = null;

  function starsFor(heat) {
    var s = 0;
    for (var i = 0; i < STAR_HEAT.length; i++) if (heat >= STAR_HEAT[i]) s = i;
    return s;
  }

  function witnessNear(x, z, radius) {
    for (var i = 0; i < V.peds.length; i++) {
      if (V.peds[i].state !== 'down' && V.dist2d(V.peds[i].x, V.peds[i].z, x, z) < radius) return true;
    }
    for (var i = 0; i < V.cars.length; i++) {
      var c = V.cars[i];
      if ((c.driver === 'traffic' || c.driver === 'police') && V.dist2d(c.x, c.z, x, z) < radius) return true;
    }
    return false;
  }

  // points: how bad the crime is. quiet crimes (a theft nobody sees) may
  // pass unreported; loud ones (gunfire, a crash, a robbery) always count.
  function reportCrime(points, x, z, quiet) {
    if (quiet && !witnessNear(x, z, 30)) return false;
    law.heat += points;
    law.lastCrimeAt = law.time;
    law.stars = starsFor(law.heat);
    return true;
  }

  function clearHeat() {
    law.heat = 0; law.stars = 0; law.bustedMeter = 0;
  }

  function spawnCruiser(city, px, pz) {
    // appear on a road 95–140 m away, out of the player's face
    for (var tries = 0; tries < 12; tries++) {
      var lines = city.roadLines;
      var vertical = rng() < 0.5;
      var line = lines[(rng() * lines.length) | 0];
      var along = V.clamp((vertical ? pz : px) + (rng() < 0.5 ? -1 : 1) * (95 + rng() * 45), -290, 250);
      var x = vertical ? line + 5.6 : along;
      var z = vertical ? along : line - 5.6;
      if (V.dist2d(x, z, px, pz) < 80) continue;
      var car = V.spawnCar('cruiser', x, z, vertical ? 0 : Math.PI / 2, { driver: 'police' });
      car.ai = { active: true, reverseT: 0, stuckT: 0, lastX: x, lastZ: z };
      cruisers.push(car);
      return car;
    }
    return null;
  }

  function spawnOfficer(scene, x, z) {
    var rig = V.buildHumanoid({ shirt: 0x27364e, pants: 0x1c2733, skin: 0xc89878, cap: 0x141c28 });
    rig.pistol.visible = true;
    rig.group.position.set(x, 0, z);
    scene.add(rig.group);
    var off = { rig: rig, group: rig.group, x: x, z: z, ry: 0, phase: rng() * 6, shootT: 1 + rng(), health: 60 };
    officers.push(off);
    return off;
  }

  function initLaw(scene) { sceneRef = scene; }

  function stepCruiser(car, dt, ctx) {
    var ai = car.ai;
    var tx = ctx.px, tz = ctx.pz;
    var d = V.dist2d(car.x, car.z, tx, tz);
    var desired = Math.atan2(tx - car.x, tz - car.z);
    var delta = V.angleDelta(car.ry, desired);
    var want;
    if (ai.reverseT > 0) {
      ai.reverseT -= dt;
      want = -13;
      car.ry += (delta > 0 ? -1 : 1) * 1.6 * dt;
    } else {
      car.ry += V.clamp(delta, -2.6 * dt, 2.6 * dt);
      want = d > 34 ? car.spec.top : (d > 12 ? 27 : (ctx.pSpeed > 4 ? 17 : 5));
      if (Math.abs(delta) > 2.4 && d < 16) { ai.reverseT = 0.7; want = -13; }
    }
    car.speed += V.clamp(want - car.speed, -34 * dt, car.spec.accel * dt);
    var ox = car.x, oz = car.z;
    car.x += Math.sin(car.ry) * car.speed * dt;
    car.z += Math.cos(car.ry) * car.speed * dt;
    var fixed = V.collideCircle(ctx.city, car.x, car.z, 1.6);
    if (fixed.x !== car.x || fixed.z !== car.z) {
      car.x = fixed.x; car.z = fixed.z;
      car.speed *= 0.3;
      ai.reverseT = Math.max(ai.reverseT, 0.55);
    }
    // ramming contact with the player's car
    if (ctx.playerCar && !ctx.playerCar.dead) {
      var pc = ctx.playerCar;
      if (V.dist2d(car.x, car.z, pc.x, pc.z) < 3.2) {
        V.damageCar(pc, Math.abs(car.speed) * 0.35 + 2, pc.x, pc.z);
        V.damageCar(car, 2.5, car.x, car.z);
        car.speed *= 0.55;
        if (V.onPoliceRam) V.onPoliceRam();
      }
    }
    // stuck detection: barely moved while trying to drive
    ai.stuckT += dt;
    if (ai.stuckT > 1.2) {
      ai.stuckT = 0;
      if (V.dist2d(car.x, car.z, ai.lastX, ai.lastZ) < 1.2 && Math.abs(want) > 4) ai.reverseT = 0.8;
      ai.lastX = car.x; ai.lastZ = car.z;
    }
    // light bar strobe
    var phase = (law.time * 7 + car.id) % 1;
    car.extras.barRed.material.color.setHex(phase < 0.5 ? 0xff2222 : 0x551111);
    car.extras.barBlue.material.color.setHex(phase < 0.5 ? 0x112255 : 0x3366ff);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.ry;
  }

  function updateLaw(dt, ctx) {
    law.time += dt;
    // --- heat decay while unseen -----------------------------------------
    var seen = false;
    var i, c;
    for (i = 0; i < cruisers.length; i++) {
      if (V.dist2d(cruisers[i].x, cruisers[i].z, ctx.px, ctx.pz) < 62) seen = true;
    }
    for (i = 0; i < officers.length; i++) {
      if (V.dist2d(officers[i].x, officers[i].z, ctx.px, ctx.pz) < 45) seen = true;
    }
    if (!seen && law.time - law.lastCrimeAt > 4) {
      law.hiddenTime += dt;
      law.heat = Math.max(0, law.heat - dt * 2.1);
      law.stars = starsFor(law.heat);
    } else law.hiddenTime = 0;

    // --- keep the cruiser count matched to the stars ----------------------
    var wantCruisers = law.stars === 0 ? 0 : Math.min(2 + law.stars, 6);
    if (cruisers.length < wantCruisers) spawnCruiser(ctx.city, ctx.px, ctx.pz);
    for (i = cruisers.length - 1; i >= 0; i--) {
      c = cruisers[i];
      var far = V.dist2d(c.x, c.z, ctx.px, ctx.pz) > 230;
      if (c.dead || (law.stars === 0 && far) || (law.stars === 0 && cruisers.length > 0 && law.hiddenTime > 6)) {
        c.driver = 'parked'; c.ai = null;
        cruisers.splice(i, 1);
        continue;
      }
      if (law.stars > 0) stepCruiser(c, dt, ctx);
      else { c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.ry; }
    }

    // --- foot officers at 3+ stars ----------------------------------------
    var wantOfficers = law.stars >= 3 ? Math.min(law.stars - 1, 4) : 0;
    if (officers.length < wantOfficers && cruisers.length > 0) {
      var host = cruisers[(rng() * cruisers.length) | 0];
      if (host && Math.abs(host.speed) < 6 && V.dist2d(host.x, host.z, ctx.px, ctx.pz) < 55) {
        spawnOfficer(sceneRef, host.x + 2.4, host.z + 1);
      }
    }
    var bustPressure = 0;
    for (i = officers.length - 1; i >= 0; i--) {
      var o = officers[i];
      if (o.health <= 0) {
        o.group.rotation.x = -Math.PI / 2;
        officers.splice(i, 1);
        continue;
      }
      var od = V.dist2d(o.x, o.z, ctx.px, ctx.pz);
      if (od > 240 || law.stars === 0) {
        sceneRef.remove(o.group);
        officers.splice(i, 1);
        continue;
      }
      var speed = od > 9 ? 6.6 : 2.2;
      var want2 = Math.atan2(ctx.px - o.x, ctx.pz - o.z);
      o.ry += V.angleDelta(o.ry, want2) * Math.min(1, dt * 9);
      if (od > 2.1) {
        o.x += Math.sin(o.ry) * speed * dt;
        o.z += Math.cos(o.ry) * speed * dt;
        var f2 = V.collideCircle(ctx.city, o.x, o.z, 0.5);
        o.x = f2.x; o.z = f2.z;
        o.phase += dt * speed * 2.2;
      }
      o.group.position.set(o.x, 0, o.z);
      o.group.rotation.y = o.ry;
      V.animateHumanoid(o.rig, o.phase, od > 2.1 ? 0.9 : 0.1);
      o.rig.aiming = od < 26;
      if (o.rig.aiming) o.rig.armR.rotation.x = -1.35;
      if (od < 30) {
        o.shootT -= dt;
        if (o.shootT <= 0) {
          o.shootT = 1.1 + rng() * 0.9;
          if (V.onOfficerShoot) V.onOfficerShoot(o, od);
        }
      }
      if (od < 2.6 && !ctx.inCar) bustPressure = Math.max(bustPressure, 1);
    }

    // --- BUSTED meter -------------------------------------------------------
    var nearCruiser = false;
    for (i = 0; i < cruisers.length; i++) {
      if (V.dist2d(cruisers[i].x, cruisers[i].z, ctx.px, ctx.pz) < 7.5) nearCruiser = true;
    }
    if (law.stars > 0 && ctx.pSpeed < 1.6 && (bustPressure > 0 || nearCruiser)) {
      law.bustedMeter += dt / 2.4;
    } else {
      law.bustedMeter = Math.max(0, law.bustedMeter - dt * 0.7);
    }
    if (law.bustedMeter >= 1 && V.onBusted) {
      law.bustedMeter = 0;
      V.onBusted();
    }
  }

  V.law = law;
  V.reportCrime = reportCrime;
  V.clearHeat = clearHeat;
  V.initLaw = initLaw;
  V.updateLaw = updateLaw;
  V.cruisers = cruisers;
  V.officers = officers;
  V.spawnCruiser = spawnCruiser;
})();
