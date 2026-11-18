// law.js — Velmara PD: wanted stars 0–5, heat that decays when you break
// line of sight, interceptor cruisers that chase and ram, foot officers at
// high stars, and the BUSTED meter that fills when they pin you down.
window.VN = window.VN || {};

VN.law = (function () {
  'use strict';

  function init(city, rng) {
    return {
      wanted: 0, heat: 0, hiddenTime: 0, cruisers: [], officers: [],
      bustedMeter: 0, city: city, rng: rng, flash: 0, reportCooldown: 0
    };
  }

  // Report a crime: severity 1 (theft/robbery) .. 3 (shooting an officer).
  function report(law, severity, state) {
    if (law.reportCooldown > 0 && severity < 3) return;
    law.reportCooldown = 1.2;
    law.heat = Math.min(100, law.heat + severity * 22);
    var stars = law.heat > 82 ? 5 : law.heat > 62 ? 4 : law.heat > 44 ? 3 : law.heat > 24 ? 2 : law.heat > 6 ? 1 : 0;
    if (stars > law.wanted) {
      law.wanted = stars;
      if (window.VN && VN.sound) VN.sound.sirenBurst();
    }
    law.hiddenTime = 0;
  }

  function desiredCruisers(law) {
    return [0, 1, 2, 3, 4, 5][law.wanted] || 0;
  }
  function desiredOfficers(law) {
    return law.wanted >= 4 ? 3 : law.wanted >= 3 ? 1 : 0;
  }

  function spawnCruiser(law, state) {
    var car = VN.drive.makeCar(8, law.rng, true);
    // spawn on a road, 55–80 m from the player, out of direct view if possible
    var ang = law.rng() * Math.PI * 2;
    var dist = 58 + law.rng() * 22;
    var x = state.player.x + Math.sin(ang) * dist;
    var z = state.player.z + Math.cos(ang) * dist;
    car.x = Math.round(x / 48) * 48 + 3.1;
    car.z = Math.max(-215, Math.min(215, z));
    car.ai = { chase: true };
    law.city.scene.add(car.group);
    law.cruisers.push(car);
    return car;
  }
  function spawnOfficer(law, state) {
    var fig = VN.avatar.makeOfficer();
    var ang = law.rng() * Math.PI * 2;
    var o = {
      fig: fig, x: state.player.x + Math.sin(ang) * 26, z: state.player.z + Math.cos(ang) * 26,
      ry: 0, phase: 0, health: 60, dead: false, shootCd: 1 + law.rng()
    };
    fig.group.position.set(o.x, 0, o.z);
    law.city.scene.add(fig.group);
    law.officers.push(o);
    return o;
  }

  function step(law, state, dt) {
    law.flash += dt * 6;
    if (law.reportCooldown > 0) law.reportCooldown -= dt;
    var player = state.player;
    // Can any officer/cruiser "see" the player? (range + not in a fresh hide)
    var seen = false;
    var i, c, dx, dz, d2;
    for (i = 0; i < law.cruisers.length; i++) {
      c = law.cruisers[i];
      dx = c.x - player.x; dz = c.z - player.z; d2 = dx * dx + dz * dz;
      if (d2 < 70 * 70) seen = true;
    }
    for (i = 0; i < law.officers.length; i++) {
      if (law.officers[i].dead) continue;
      dx = law.officers[i].x - player.x; dz = law.officers[i].z - player.z;
      if (dx * dx + dz * dz < 40 * 40) seen = true;
    }
    if (law.wanted > 0) {
      if (seen) { law.hiddenTime = 0; law.heat = Math.min(100, law.heat + dt * 1.1); }
      else {
        law.hiddenTime += dt;
        law.heat -= dt * (law.hiddenTime > 3 ? 3.2 : 0.8);
        if (law.heat <= 0) { law.heat = 0; law.wanted = 0; clearUnits(law, state); }
        else {
          var stars = law.heat > 82 ? 5 : law.heat > 62 ? 4 : law.heat > 44 ? 3 : law.heat > 24 ? 2 : 1;
          if (stars < law.wanted) law.wanted = stars;
        }
      }
    }

    // fleet management
    var want = desiredCruisers(law);
    while (law.cruisers.length < want) spawnCruiser(law, state);
    if (law.cruisers.length > want) {
      var extra = law.cruisers.pop();
      law.city.scene.remove(extra.group);
    }
    var wantOff = desiredOfficers(law);
    var aliveOff = law.officers.filter(function (o) { return !o.dead; }).length;
    while (aliveOff < wantOff) { spawnOfficer(law, state); aliveOff++; }

    // --- cruisers chase & ram ------------------------------------------
    for (i = 0; i < law.cruisers.length; i++) {
      c = law.cruisers[i];
      if (c.dead) continue;
      dx = player.x - c.x; dz = player.z - c.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var targetRy = Math.atan2(dx, dz);
      var diff = wrapAngle(targetRy - c.ry);
      c.steer = Math.max(-0.6, Math.min(0.6, diff * 1.4));
      var targetSpeed = c.def.top * (dist > 26 ? 1 : 0.72);
      if (Math.abs(diff) > 2.4) targetSpeed = -8; // reverse out of a bad angle
      c.speed += Math.sign(targetSpeed - c.speed) * Math.min(Math.abs(targetSpeed - c.speed), c.def.acc * dt);
      c.ry += c.steer * (c.speed / Math.max(6, c.def.top)) * 2.1 * dt * (c.speed < 0 ? -1 : 1);
      var nx = c.x + Math.sin(c.ry) * c.speed * dt;
      var nz = c.z + Math.cos(c.ry) * c.speed * dt;
      var res = VN.city.collide(law.city.colliders, nx, nz, 1.35);
      if (res.x !== nx || res.z !== nz) c.speed *= 0.4;
      c.x = res.x; c.z = res.z;
      VN.drive.sync(c, dt);
      // light bar flash
      if (c.group.userData.barL) {
        var on = Math.sin(law.flash * 3.2) > 0;
        c.group.userData.barL.material.color.setHex(on ? 0xff2233 : 0x551118);
        c.group.userData.barR.material.color.setHex(on ? 0x112255 : 0x2266ff);
      }
      // ram contact
      if (player.car && dist < 3.4 && Math.abs(c.speed) > 6) {
        VN.drive.damage(player.car, Math.abs(c.speed) * 0.35);
        player.car.speed *= 0.72;
        c.speed *= 0.6;
        if (window.VN && VN.sound) VN.sound.crash();
      }
      // despawn if hopelessly far
      if (dist > 300) { c.x = player.x + 60; c.z = player.z + 60; }
    }

    // --- foot officers ---------------------------------------------------
    for (i = 0; i < law.officers.length; i++) {
      var o = law.officers[i];
      if (o.dead) continue;
      dx = player.x - o.x; dz = player.z - o.z;
      var od = Math.sqrt(dx * dx + dz * dz) || 1;
      o.ry = Math.atan2(dx, dz);
      if (od > 13) {
        o.x += Math.sin(o.ry) * 4.6 * dt;
        o.z += Math.cos(o.ry) * 4.6 * dt;
        o.phase += dt * 9;
        VN.avatar.pose(o.fig, o.phase, 1, false);
      } else {
        VN.avatar.pose(o.fig, 0, 0, true);
        o.fig.gun.visible = true;
        o.shootCd -= dt;
        if (o.shootCd <= 0 && state.mode === 'foot') {
          o.shootCd = 1.1 + law.rng() * 0.9;
          if (VN.combat) VN.combat.enemyShoot(state, o);
        }
      }
      o.fig.group.position.set(o.x, 0, o.z);
      o.fig.group.rotation.y = o.ry;
    }

    // --- BUSTED meter ------------------------------------------------------
    var pinned = false;
    if (state.mode === 'foot' && law.wanted > 0) {
      for (i = 0; i < law.officers.length; i++) {
        if (law.officers[i].dead) continue;
        dx = law.officers[i].x - player.x; dz = law.officers[i].z - player.z;
        if (dx * dx + dz * dz < 30) pinned = true;
      }
    }
    if (player.car && law.wanted > 0 && Math.abs(player.car.speed) < 1.2) {
      for (i = 0; i < law.cruisers.length; i++) {
        dx = law.cruisers[i].x - player.x; dz = law.cruisers[i].z - player.z;
        if (dx * dx + dz * dz < 64) pinned = true;
      }
    }
    if (pinned) law.bustedMeter += dt / 2.6;
    else law.bustedMeter = Math.max(0, law.bustedMeter - dt * 0.7);
    if (law.bustedMeter >= 1 && state.mode !== 'busted') {
      state.mode = 'busted';
      if (VN.ui) VN.ui.showBusted(state);
    }
  }

  function clearUnits(law, state) {
    for (var i = 0; i < law.cruisers.length; i++) law.city.scene.remove(law.cruisers[i].group);
    for (var j = 0; j < law.officers.length; j++) law.city.scene.remove(law.officers[j].fig.group);
    law.cruisers = []; law.officers = []; law.bustedMeter = 0;
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  return { init: init, report: report, step: step, clearUnits: clearUnits };
})();
