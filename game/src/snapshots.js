// snapshots.js — deterministic posed scenes for the screenshots
// (?shot=<scene>&seed=7). Headless Chrome on this machine composites frames
// only on demand, so instead of simulating gameplay each scene is POSED:
// cars placed, cruisers lit, wanted stars set, the HUD filled in directly.
// play.js keeps rendering (rain falls, light bars strobe) while the pose
// holds. The four scenes are the game's cover sheet: driving the Neon
// Mile, a four-cruiser chase, Jax on foot in the Old Market, and the
// timed Dock Nine harbour run.
window.V = window.V || {};
(function () {
  'use strict';

  var hudState = null;
  var posedCruisers = [];
  var tickCount = 0;

  function baseHud(api) {
    return {
      cash: 1240, rep: 46, rank: V.rankFor(46), clockMinutes: 21 * 60 + 24,
      health: 88, busted: 0, stars: 0, inCar: false, carSpeed: 0,
      carName: '', carHealth: 100, ammo: 12, reserve: 84, reloading: false,
      px: 0, pz: 0, ry: 0, city: api.city, playing: true, mapOpen: false, dt: 0.016
    };
  }

  function setObjective(label, x, z, dist, timer) {
    V.objective.label = label;
    V.objective.x = x; V.objective.z = z;
    V.objective.dist = dist;
    V.objective.timer = (timer === undefined ? null : timer);
    V.objective.visible = true;
  }

  function hideHero(api) { api.hero.group.visible = false; }
  function placeHero(api, x, z, ry) {
    api.hero.x = x; api.hero.z = z; api.hero.ry = ry;
    api.hero.group.position.set(x, 0, z);
    api.hero.group.rotation.y = ry;
    api.hero.group.visible = true;
  }

  var SCENES = {
    // 1 — the cover: pink Orphee GT on the Neon Mile in the rain
    cover: function (api) {
      var city = api.city;
      var gt = V.spawnCar('orphee', -234.4, -34, 0, { colour: 0xe7549a, driver: 'parked' });
      gt.isOrphee = false;
      V.spawnCar('sedan', -234.4, -14, 0, { driver: 'parked' });
      V.spawnCar('taxi', -245.6, -52, Math.PI, { driver: 'parked' });
      V.spawnCar('coupe', -245.6, 6, Math.PI, { driver: 'parked', colour: 0x3fa7a0 });
      hideHero(api);
      api.setCamera(-228.5, 3.1, -47.5, -235.5, 1.2, -26);
      setObjective('FIRST PARCEL — Pick up the parcel at the Old Market',
        city.marketPickup.x, city.marketPickup.z, 238, null);
      hudState = baseHud(api);
      hudState.inCar = true;
      hudState.carSpeed = 11.5;
      hudState.carName = 'ORPHEE GT';
      hudState.carHealth = 96;
      hudState.px = -234.4; hudState.pz = -34; hudState.ry = 0;
    },

    // 2 — the chase: four lit cruisers, four stars, one officer
    chase: function (api) {
      var city = api.city;
      var coupe = V.spawnCar('coupe', 6, 234.4, Math.PI / 2, { colour: 0xc94f6d, driver: 'parked' });
      var spots = [[-11, 233.2], [-17.5, 236.8], [-24, 232.6], [-31, 237.4]];
      for (var i = 0; i < spots.length; i++) {
        var c = V.spawnCar('cruiser', spots[i][0], spots[i][1], Math.PI / 2, { driver: 'parked' });
        c.ai = { active: false };
        V.cruisers.push(c);
        posedCruisers.push(c);
      }
      var officer = V.buildHumanoid({ shirt: 0x27364e, pants: 0x1c2733, skin: 0xc89878, cap: 0x141c28 });
      officer.pistol.visible = true;
      officer.armR.rotation.x = -1.35;
      officer.group.position.set(16, 0, 224.5);
      officer.group.rotation.y = Math.PI * 0.85;
      api.scene.add(officer.group);
      hideHero(api);
      api.setCamera(-6.5, 3.6, 224.8, 10, 1.1, 235.5);
      V.law.stars = 4;
      V.law.heat = 92;
      setObjective('Lose the police', 6, 234.4, 0, null);
      hudState = baseHud(api);
      hudState.inCar = true;
      hudState.stars = 4;
      hudState.carSpeed = 19;
      hudState.carName = 'COUPE';
      hudState.carHealth = 71;
      hudState.busted = 0.25;
      hudState.px = 6; hudState.pz = 234.4; hudState.ry = Math.PI / 2;
    },

    // 3 — on foot in the Old Market, Odile on the line, pistol out
    onfoot: function (api) {
      var city = api.city;
      var mp = city.marketPickup;
      placeHero(api, mp.x - 3, mp.z + 6, Math.PI * 0.8);
      api.hero.rig.pistol.visible = true;
      api.hero.rig.aiming = true;
      api.hero.rig.armR.rotation.x = -1.35;
      api.setCamera(mp.x - 6.5, 2.6, mp.z + 12.5, mp.x + 1, 1.3, mp.z - 2);
      setObjective('Pick up the parcel at the Old Market', mp.x + 9, mp.z - 7, 12, null);
      V.onDialogue({
        lines: [{ who: 'Odile Vane', text: 'Marek is the one sweating through his shirt by the spice stall, Jax. Take the parcel, smile at nobody, and walk like the rain is yours.' }],
        idx: 0, onDone: null
      });
      hudState = baseHud(api);
      hudState.health = 92;
      hudState.ammo = 12; hudState.reserve = 84;
      hudState.px = mp.x - 3; hudState.pz = mp.z + 6; hudState.ry = Math.PI * 0.8;
    },

    // 4 — the mission: Dockmaster Pickup on the harbour run, clock ticking
    mission: function (api) {
      var city = api.city;
      V.spawnCar('pickup', 52, 234.4, Math.PI / 2, { colour: 0x96684a, driver: 'parked' });
      V.spawnCar('sedan', 96, 245.6, -Math.PI / 2, { driver: 'parked', colour: 0x5e6e8c });
      V.spawnCar('taxi', 30, 245.6, -Math.PI / 2, { driver: 'parked' });
      hideHero(api);
      api.setCamera(38.5, 3.4, 226.5, 62, 1.2, 236);
      setObjective('NINE MINUTES TO DOCK NINE — Deliver to Dock Nine',
        city.dockNine.x, city.dockNine.z, 47, 96);
      hudState = baseHud(api);
      hudState.inCar = true;
      hudState.carSpeed = 13.5;
      hudState.carName = 'DOCKMASTER PICKUP';
      hudState.carHealth = 88;
      hudState.cash = 1590;
      hudState.px = 52; hudState.pz = 234.4; hudState.ry = Math.PI / 2;
    }
  };

  V.poseShot = function (name, api) {
    var scene = SCENES[name] || SCENES.cover;
    scene(api);
    window.__shotScene = name;
  };

  // Runs every frame while a shot is posed: strobe the light bars, keep
  // the HUD painted, and flag readiness once frames are flowing.
  V.shotTick = function (dt, api) {
    tickCount++;
    var phase = (tickCount * dt * 7) % 1;
    for (var i = 0; i < posedCruisers.length; i++) {
      var c = posedCruisers[i];
      c.extras.barRed.material.color.setHex(phase < 0.5 ? 0xff2222 : 0x551111);
      c.extras.barBlue.material.color.setHex(phase < 0.5 ? 0x112255 : 0x3366ff);
    }
    if (hudState) V.ui.update(hudState, tickCount * 16.7);
    if (tickCount === 40) window.__shotReady = true;
  };
})();
