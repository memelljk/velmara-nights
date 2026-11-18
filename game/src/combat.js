// combat.js — pistol work: mouse aim, hitscan tracers, reload, melee swing,
// thugs and officers who shoot back, pedestrian panic and robbery at gunpoint.
window.VN = window.VN || {};

VN.combat = (function () {
  'use strict';

  var MAG = 12;
  var tracers = []; // {line, life}

  function init(scene) {
    return { ammo: MAG, reserve: 60, reloading: 0, cooldown: 0, scene: scene };
  }

  function makeTracer(scene, from, to, color) {
    var geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z)
    ]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line: line, life: 0.09 });
  }
  function stepTracers(scene, dt) {
    for (var i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].line);
        tracers[i].line.geometry.dispose();
        tracers.splice(i, 1);
      }
    }
  }

  // Player fires toward the camera aim direction. Returns true if a shot went off.
  function playerShoot(state) {
    var c = state.combat;
    if (c.cooldown > 0 || c.reloading > 0) return false;
    if (c.ammo <= 0) { reload(state); return false; }
    c.ammo--; c.cooldown = 0.16;
    var cam = state.camera;
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    var origin = cam.position.clone();
    var best = null, bestT = 60;
    function testPoint(x, y, z, obj, kind) {
      var to = new THREE.Vector3(x - origin.x, y - origin.y, z - origin.z);
      var t = to.dot(dir);
      if (t < 1 || t > bestT) return;
      var px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
      var ddx = x - px, ddy = y - py, ddz = z - pz;
      if (ddx * ddx + ddy * ddy + ddz * ddz < 1.15) { best = obj; bestT = t; best.kind = kind; }
    }
    var i, ped;
    for (i = 0; i < state.peds.length; i++) { ped = state.peds[i]; if (!ped.dead) testPoint(ped.x, 1.1, ped.z, ped, 'ped'); }
    for (i = 0; i < state.thugs.length; i++) { var th = state.thugs[i]; if (!th.dead) testPoint(th.x, 1.1, th.z, th, 'thug'); }
    for (i = 0; i < state.law.officers.length; i++) { var of = state.law.officers[i]; if (!of.dead) testPoint(of.x, 1.1, of.z, of, 'officer'); }
    var allCars = state.traffic.concat(state.parked, state.law.cruisers);
    for (i = 0; i < allCars.length; i++) { var car = allCars[i]; if (!car.dead) testPoint(car.x, 0.9, car.z, car, 'car'); }
    var end = origin.clone().add(dir.clone().multiplyScalar(bestT));
    var muzzle = { x: state.player.x + Math.sin(state.player.ry) * 0.5, y: 1.35, z: state.player.z + Math.cos(state.player.ry) * 0.5 };
    makeTracer(state.scene, muzzle, end, 0xffe9a8);
    if (VN.sound) { VN.sound.shot(); VN.sound.panicAt(state, end); }
    state.panic = { x: end.x, z: end.z, t: 2.5 };
    if (best) {
      if (best.kind === 'car') {
        VN.drive.damage(best, 14);
        if (best.health <= 0 && !best.dead) { best.dead = true; best.speed = 0; }
        VN.law.report(state.law, 2, state);
      } else {
        best.health -= 55;
        if (best.kind === 'officer') VN.law.report(state.law, 3, state);
        else VN.law.report(state.law, 2, state);
        if (best.health <= 0 && !best.dead) killPerson(state, best, best.kind);
        else if (best.kind === 'ped') best.state = 'flee';
      }
    } else {
      VN.law.report(state.law, 1, state); // shots heard
    }
    if (c.ammo === 0) reload(state);
    return true;
  }

  function killPerson(state, who, kind) {
    who.dead = true;
    VN.avatar.fall(who.fig);
    if (kind === 'ped') state.stats.pedsDown++;
    if (kind === 'thug' && state.story) VN.story.onThugDown(state);
    if (VN.sound) VN.sound.thud();
  }

  function reload(state) {
    var c = state.combat;
    if (c.reloading > 0 || c.reserve <= 0 || c.ammo === MAG) return;
    c.reloading = 1.1;
    if (VN.sound) VN.sound.reloadClick();
  }
  function stepCombat(state, dt) {
    var c = state.combat;
    if (c.cooldown > 0) c.cooldown -= dt;
    if (c.reloading > 0) {
      c.reloading -= dt;
      if (c.reloading <= 0) {
        var take = Math.min(MAG - c.ammo, c.reserve);
        c.ammo += take; c.reserve -= take;
      }
    }
    stepTracers(state.scene, dt);
  }

  // Melee: shove the nearest person/car within 1.8 m.
  function melee(state) {
    var p = state.player;
    var all = state.peds.concat(state.thugs, state.law.officers);
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (o.dead) continue;
      var dx = o.x - p.x, dz = o.z - p.z;
      if (dx * dx + dz * dz < 3.4) {
        o.health -= 45;
        o.x += dx * 0.4; o.z += dz * 0.4;
        if (o.health <= 0) killPerson(state, o, o === state.peds[i] ? 'ped' : 'thug');
        else if (o.state !== undefined) o.state = 'flee';
        VN.law.report(state.law, 1, state);
        if (VN.sound) VN.sound.thud();
        return;
      }
    }
  }

  // An enemy (thug/officer) shoots at the player.
  function enemyShoot(state, who) {
    var p = state.player;
    var from = { x: who.x, y: 1.35, z: who.z };
    var jitter = (Math.random() - 0.5) * 1.6;
    var to = { x: p.x + jitter, y: 1.1, z: p.z + jitter };
    makeTracer(state.scene, from, to, 0xff5544);
    if (VN.sound) VN.sound.shot(true);
    state.panic = { x: p.x, z: p.z, t: 2.0 };
    var dx = p.x - who.x, dz = p.z - who.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var hitChance = Math.max(0.08, 0.5 - dist * 0.012);
    if (Math.random() < hitChance && state.mode === 'foot') {
      hurtPlayer(state, 7 + Math.random() * 8);
    }
  }

  function hurtPlayer(state, dmg) {
    if (state.mode === 'wasted' || state.mode === 'busted') return;
    state.player.health -= dmg;
    if (VN.ui) VN.ui.flashDamage(state);
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.mode = 'wasted';
      if (VN.ui) VN.ui.showWasted(state);
    }
  }

  // Rob the pedestrian Jax is aiming at (called when a hands-up ped is close).
  function tryRob(state) {
    var p = state.player;
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.dead || ped.robbed || ped.state !== 'handsup') continue;
      var dx = ped.x - p.x, dz = ped.z - p.z;
      if (dx * dx + dz * dz < 12) {
        ped.robbed = true;
        state.player.cash += ped.cash;
        state.stats.robberies++;
        VN.law.report(state.law, 1, state);
        if (VN.ui) VN.ui.toast(state, 'Robbed $' + ped.cash + ' off a bystander.');
        ped.state = 'flee';
        return true;
      }
    }
    return false;
  }

  return { init: init, playerShoot: playerShoot, reload: reload, melee: melee, enemyShoot: enemyShoot, hurtPlayer: hurtPlayer, tryRob: tryRob, step: stepCombat, MAG: MAG };
})();
