// crowds.js — the people of Velmara: pedestrians who stroll the sidewalks,
// flee gunfire and crashes, and can be robbed at gunpoint; plus Odile Vane,
// the fixer who waits at her Neon Mile booth and hands out the story.
window.V = window.V || {};
(function () {
  'use strict';

  var rng = V.makeRng(90210);
  var peds = [];
  var SHIRTS = [0xb8563f, 0x3f6eb8, 0x53a05a, 0xb8a03f, 0x8a5fb0, 0x4fb0a5, 0xc2c7d1, 0x94553d, 0x3d7a8c, 0xd17ba0];
  var PANTS = [0x23242e, 0x3a3f4c, 0x54463a, 0x2e3a54, 0x40343c];
  var SKINS = [0xe8b98f, 0xc89878, 0x9c6b4a, 0x77502f, 0xf0c8a0];

  function makePed(scene, x, z) {
    var rig = V.buildHumanoid({
      shirt: SHIRTS[(rng() * SHIRTS.length) | 0],
      pants: PANTS[(rng() * PANTS.length) | 0],
      skin: SKINS[(rng() * SKINS.length) | 0],
      cap: rng() < 0.3 ? 0x1c202a : null
    });
    rig.group.position.set(x, 0, z);
    scene.add(rig.group);
    var ped = {
      rig: rig, group: rig.group, x: x, z: z, ry: rng() * 6.28,
      state: 'stroll', timer: 0, phase: rng() * 6,
      tx: x, tz: z, speed: 1.6 + rng() * 0.9, health: 100, robbed: false
    };
    pickStrollTarget(ped, null);
    peds.push(ped);
    return ped;
  }

  // Sidewalk targets: a point along a road edge, so peds walk the grid.
  function pickStrollTarget(ped, city) {
    var lines = [-240, -144, -48, 48, 144, 240];
    if (rng() < 0.55 && ped.road) {
      // keep walking the same street
      ped.tx = ped.road.vertical ? ped.road.line + ped.road.side * 14.6 : -280 + rng() * 560;
      ped.tz = ped.road.vertical ? -280 + rng() * 560 : ped.road.line + ped.road.side * 14.6;
      return;
    }
    var vertical = rng() < 0.5;
    var line = lines[(rng() * lines.length) | 0];
    var side = rng() < 0.5 ? -1 : 1;
    ped.road = { vertical: vertical, line: line, side: side };
    ped.tx = vertical ? line + side * 14.6 : -280 + rng() * 560;
    ped.tz = vertical ? -280 + rng() * 560 : line + side * 14.6;
    if (ped.tz > 246) ped.tz = 246;
  }

  function initCrowds(scene, city) {
    for (var i = 0; i < 26; i++) {
      var lines = city.roadLines;
      var vertical = rng() < 0.5;
      var line = lines[(rng() * lines.length) | 0];
      var side = rng() < 0.5 ? -1 : 1;
      var along = -270 + rng() * 520;
      var x = vertical ? line + side * 14.6 : along;
      var z = vertical ? along : line + side * 14.6;
      if (z > 246) z = 246 - rng() * 30;
      var ped = makePed(scene, x, z);
      ped.road = { vertical: vertical, line: line, side: side };
      pickStrollTarget(ped, city);
    }
    // Odile Vane at her booth, magenta dress, always facing the street
    var rig = V.buildHumanoid({ shirt: 0xd94f9e, dress: 0xa02c6e, skin: 0x8a5a3c });
    rig.group.position.set(city.odileBooth.x - 3.4, 0, city.odileBooth.z);
    rig.group.rotation.y = -Math.PI / 2;
    scene.add(rig.group);
    V.odile = { rig: rig, x: city.odileBooth.x - 3.4, z: city.odileBooth.z, phase: 0 };
  }

  function panic(x, z, radius) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      if (V.dist2d(p.x, p.z, x, z) < radius) {
        p.state = 'flee';
        p.timer = 2.5 + rng() * 2;
        p.fleeX = x; p.fleeZ = z;
      }
    }
  }

  function updateCrowds(dt, city) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var speed = 0, moving = false;
      if (p.state === 'flee') {
        p.timer -= dt;
        var dx = p.x - p.fleeX, dz = p.z - p.fleeZ;
        var dl = Math.sqrt(dx * dx + dz * dz) || 1;
        p.tx = p.x + dx / dl * 10; p.tz = p.z + dz / dl * 10;
        speed = 6.4; moving = true;
        if (p.timer <= 0) { p.state = 'stroll'; pickStrollTarget(p, city); }
      } else if (p.state === 'handsup') {
        p.timer -= dt;
        p.rig.armL.rotation.x = -2.8;
        p.rig.armR.rotation.x = -2.8;
        if (p.timer <= 0) {
          p.state = 'flee'; p.timer = 3; p.fleeX = p.robberX || p.x + 5; p.fleeZ = p.robberZ || p.z;
        }
      } else if (p.state === 'aimed') {
        // frozen while a gun is on them; combat.js drives the outcome
        p.rig.armL.rotation.x = -2.8;
        p.rig.armR.rotation.x = -2.8;
      } else {
        speed = p.speed; moving = true;
        if (V.dist2d(p.x, p.z, p.tx, p.tz) < 2.2) pickStrollTarget(p, city);
      }
      if (moving) {
        var want = Math.atan2(p.tx - p.x, p.tz - p.z);
        p.ry += V.angleDelta(p.ry, want) * Math.min(1, dt * 8);
        p.x += Math.sin(p.ry) * speed * dt;
        p.z += Math.cos(p.ry) * speed * dt;
        var fixed = V.collideCircle(city, p.x, p.z, 0.5);
        p.x = fixed.x; p.z = fixed.z;
        p.phase += dt * speed * 2.4;
      }
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.ry;
      if (p.state !== 'handsup' && p.state !== 'aimed') {
        V.animateHumanoid(p.rig, p.phase, moving ? (p.state === 'flee' ? 1 : 0.55) : 0.05);
      }
    }
    if (V.odile) {
      V.odile.phase += dt;
      V.animateHumanoid(V.odile.rig, V.odile.phase * 0.7, 0.06);
    }
  }

  function hurtPed(ped, dmg) {
    ped.health -= dmg;
    if (ped.health <= 0 && ped.state !== 'down') {
      ped.state = 'down';
      ped.group.rotation.x = -Math.PI / 2;
      ped.group.position.y = 0.25;
      return true;
    }
    if (ped.state !== 'down') { ped.state = 'flee'; ped.timer = 3; ped.fleeX = ped.x + 8; ped.fleeZ = ped.z; }
    return false;
  }

  V.peds = peds;
  V.initCrowds = initCrowds;
  V.updateCrowds = updateCrowds;
  V.crowdPanic = panic;
  V.hurtPed = hurtPed;
})();
