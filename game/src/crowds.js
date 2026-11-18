// crowds.js — Velmara's living street: pedestrians who stroll the sidewalks,
// flee gunfire and can be robbed at gunpoint, plus the traffic fleet and the
// parked cars waiting to be stolen.
window.VN = window.VN || {};

VN.crowds = (function () {
  'use strict';

  var PED_COUNT = 46;
  var TRAFFIC_COUNT = 15;

  function spawnPed(rng, city, near) {
    var p = VN.avatar.makePed(rng);
    var x, z, tries = 0;
    do {
      x = near ? near.x + (rng() - 0.5) * 90 : (rng() - 0.5) * 400;
      z = near ? near.z + (rng() - 0.5) * 90 : (rng() - 0.5) * 400;
      tries++;
    } while (VN.city.isRoad(x) && VN.city.isRoad(z) && tries < 8);
    // nudge onto a sidewalk: if on a road centre, step sideways
    if (VN.city.isRoad(x)) x += 9;
    if (VN.city.isRoad(z)) z += 9;
    var res = VN.city.collide(city.colliders, x, z, 0.5);
    p.group.position.set(res.x, 0, res.z);
    city.scene.add(p.group);
    return {
      fig: p, x: res.x, z: res.z, ry: rng() * Math.PI * 2,
      phase: rng() * 6, speed: 0, state: 'stroll', timer: 2 + rng() * 5,
      health: 100, dead: false, cash: 15 + (rng() * 70) | 0, robbed: false
    };
  }

  function init(rng, city) {
    var peds = [];
    for (var i = 0; i < PED_COUNT; i++) peds.push(spawnPed(rng, city, null));

    var traffic = [];
    for (var t = 0; t < TRAFFIC_COUNT; t++) {
      var model = (rng() * 8) | 0;
      var car = VN.drive.makeCar(model, rng, false);
      car.ai = VN.drive.makeTrafficBrain(rng, 0, 0);
      // place on a random avenue, correct lane side
      var avenue = ((rng() * 9) | 0 - 4) * 48;
      var along = (rng() - 0.5) * 380;
      if (car.ai.horizontal) { car.x = along; car.z = Math.round(avenue / 48) * 48 + (car.ai.dir > 0 ? 3.1 : -3.1); }
      else { car.z = along; car.x = Math.round(avenue / 48) * 48 + (car.ai.dir > 0 ? 3.1 : -3.1); }
      car.speed = car.ai.cruise;
      city.scene.add(car.group);
      VN.drive.sync(car, 0);
      traffic.push(car);
    }

    var parked = [];
    var spots = city.parkSpots.slice();
    for (var s = 0; s < spots.length && parked.length < 22; s++) {
      if (rng() < 0.35) continue;
      var pm = (rng() * 8) | 0;
      var pc = VN.drive.makeCar(pm, rng, false);
      pc.x = spots[s].x; pc.z = spots[s].z; pc.ry = spots[s].ry + (rng() - 0.5) * 0.1;
      pc.parked = true;
      city.scene.add(pc.group);
      VN.drive.sync(pc, 0);
      parked.push(pc);
    }
    // The indigo Orphee GT always waits behind the Rialto casino (mission 3).
    var gt = VN.drive.makeCar(4, rng, false);
    gt.group.children.forEach(function () {});
    gt.x = -24; gt.z = -118; gt.ry = 0.2; gt.parked = true; gt.special = 'orphee';
    city.scene.add(gt.group);
    VN.drive.sync(gt, 0);
    parked.push(gt);

    return { peds: peds, traffic: traffic, parked: parked };
  }

  function stepPeds(state, dt, panic) {
    var player = state.player;
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.dead) continue;
      ped.timer -= dt;
      var dx = ped.x - player.x, dz = ped.z - player.z;
      var distP = Math.sqrt(dx * dx + dz * dz);
      if (panic && panicDist(ped, panic) < 26) ped.state = 'flee';
      if (player.aiming && distP < 9 && !ped.robbed && state.mode === 'foot') ped.state = 'handsup';
      if (ped.state === 'flee') {
        var fx = ped.x - panic.x, fz = ped.z - panic.z;
        var fl = Math.sqrt(fx * fx + fz * fz) || 1;
        ped.ry = Math.atan2(fx / fl, fz / fl);
        ped.speed = 5.2;
        if (fl > 34) ped.state = 'stroll';
      } else if (ped.state === 'handsup') {
        ped.speed = 0;
        ped.ry = Math.atan2(player.x - ped.x, player.z - ped.z);
        ped.fig.armL.rotation.x = -2.6; ped.fig.armR.rotation.x = -2.6;
        if (!player.aiming || distP > 11) { ped.state = 'stroll'; ped.fig.armL.rotation.x = 0; ped.fig.armR.rotation.x = 0; }
      } else {
        ped.speed = 1.4;
        if (ped.timer <= 0) { ped.ry = Math.random() * Math.PI * 2; ped.timer = 3 + Math.random() * 6; }
      }
      if (ped.speed > 0) {
        var nx = ped.x + Math.sin(ped.ry) * ped.speed * dt;
        var nz = ped.z + Math.cos(ped.ry) * ped.speed * dt;
        var res = VN.city.collide(state.city.colliders, nx, nz, 0.45);
        if (res.x === nx && res.z === nz) { ped.x = nx; ped.z = nz; }
        else ped.ry += 1.8 * dt + 0.4; // slide-turn away from walls
        ped.phase += dt * ped.speed * 2.4;
      }
      ped.fig.group.position.set(ped.x, 0, ped.z);
      ped.fig.group.rotation.y = ped.ry;
      if (ped.state !== 'handsup') VN.avatar.pose(ped.fig, ped.phase, ped.speed / 3, false);
      // keep the crowd near the action: recycle far peds to the player's area
      if (distP > 190) {
        var fresh = spawnPed(state.rng, state.city, player);
        ped.x = fresh.x; ped.z = fresh.z;
        state.city.scene.remove(fresh.fig.group);
      }
    }
  }
  function panicDist(p, q) { var dx = p.x - q.x, dz = p.z - q.z; return Math.sqrt(dx * dx + dz * dz); }

  function stepTraffic(state, dt, panic) {
    var all = state.traffic.concat(state.law ? state.law.cruisers : []);
    if (state.player.car) all.push(state.player.car);
    for (var i = 0; i < state.traffic.length; i++) {
      var car = state.traffic[i];
      if (car.dead || car === state.player.car) continue;
      VN.drive.stepTraffic(car, dt, all, panic);
      // gentle collision with player car: shove + damage both
      var pc = state.player.car;
      if (pc && pc !== car) {
        var dx = car.x - pc.x, dz = car.z - pc.z;
        if (dx * dx + dz * dz < 9.5) {
          var push = 1.6;
          car.x += dx * 0.1 + push * 0.1; car.z += dz * 0.1;
          VN.drive.damage(car, 3); VN.drive.damage(pc, 2);
          car.speed *= 0.6;
        }
      }
      // recycle strays back toward the player
      var ddx = car.x - state.player.x, ddz = car.z - state.player.z;
      if (ddx * ddx + ddz * ddz > 420 * 420) {
        car.x = state.player.x + (Math.random() - 0.5) * 260;
        car.z = state.player.z + (Math.random() - 0.5) * 260;
        car.x = Math.round(car.x / 48) * 48 + 3.1;
      }
    }
  }

  return { init: init, stepPeds: stepPeds, stepTraffic: stepTraffic, spawnPed: spawnPed };
})();
