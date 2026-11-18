// snapshots.js — deterministic posed scenes for the screenshots (?shot=…).
// Headless Chrome on this machine composites on demand and real-time play
// runs at a fraction of real time, so scenes are POSED, not simulated:
// positions, cars, cruisers with lit light bars, wanted stars and HUD state
// are set directly, then one frame is rendered for the capture.
window.VN = window.VN || {};

VN.snapshots = (function () {
  'use strict';

  function placeCar(state, car, x, z, ry, speed) {
    car.x = x; car.z = z; car.ry = ry; car.speed = speed || 0;
    VN.drive.sync(car, 0);
    if (state.scene.children.indexOf(car.group) === -1) state.scene.add(car.group);
    return car;
  }
  function setPlayerCar(state, model, colorHex, x, z, ry) {
    var car = VN.drive.makeCar(model, state.rng, false);
    // repaint: rebuild with the exact colour by tinting the body material
    car.group.traverse(function (n) {
      if (n.isMesh && n.material && n.material.color && n.geometry && n.geometry.parameters && n.geometry.parameters.depth === car.def.l) {
        n.material = new THREE.MeshLambertMaterial({ color: colorHex });
      }
    });
    placeCar(state, car, x, z, ry, 18);
    state.player.car = car;
    state.player.x = x; state.player.z = z;
    state.mode = 'drive';
    return car;
  }
  function tattooSign(state, x, y, z, ry) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(8,6,16,0.92)'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#00e5ff'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 58);
    g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#00e5ff'; g.shadowBlur = 14; g.fillStyle = '#00e5ff';
    g.fillText('TATTOO', 128, 34);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.8),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    m.position.set(x, y, z); m.rotation.y = ry;
    state.scene.add(m);
  }
  function lightBarsOn(state, on) {
    state.law.cruisers.forEach(function (c) {
      if (c.group.userData.barL) {
        c.group.userData.barL.material.color.setHex(on ? 0xff2233 : 0x551118);
        c.group.userData.barR.material.color.setHex(on ? 0x112255 : 0x2266ff);
      }
    });
  }

  var SCENES = {
    // 1 — cover: pink Orphee GT on the Neon Mile, rain, traffic ahead,
    // FIRST PARCEL banner, full HUD + minimap.
    cover: function (state) {
      var car = setPlayerCar(state, 4, 0xff2e88, -6, -48, Math.PI / 2);
      car.speed = 22;
      var t1 = VN.drive.makeCar(0, state.rng, false);
      placeCar(state, t1, 16, -44.9, Math.PI / 2, 14); state.traffic.push(t1);
      var t2 = VN.drive.makeCar(6, state.rng, false);
      placeCar(state, t2, 34, -44.9, Math.PI / 2, 14); state.traffic.push(t2);
      var t3 = VN.drive.makeCar(1, state.rng, false);
      placeCar(state, t3, 10, -51.1, -Math.PI / 2, 12); state.traffic.push(t3);
      state.story.active = VN.story.MISSIONS[0];
      state.story.stage = 0;
      VN.ui.banner(state, 'FIRST PARCEL');
      return { pos: [-17, 4.6, -55.5], look: [8, 1.2, -46] };
    },
    // 2 — chase: coupe at speed, four cruisers lit behind, officer on the
    // sidewalk, 4 stars, "Lose the police".
    chase: function (state) {
      var car = setPlayerCar(state, 3, 0xd06030, 0, 0, Math.PI / 2);
      car.speed = 30;
      state.law.wanted = 4; state.law.heat = 70;
      var offs = [[-11, 3.4], [-13, -3.2], [-20, 3.6], [-23, -3.4]];
      for (var i = 0; i < 4; i++) {
        var pc = VN.drive.makeCar(8, state.rng, true);
        placeCar(state, pc, offs[i][0], offs[i][1], Math.PI / 2, 29);
        state.law.cruisers.push(pc);
      }
      lightBarsOn(state, true);
      var off = VN.avatar.makeOfficer();
      off.group.position.set(7, 0, 8.6);
      off.group.rotation.y = -Math.PI / 2;
      state.scene.add(off.group);
      state.story.active = VN.story.MISSIONS[2];
      state.story.stage = 1; // escape stage
      return { pos: [-13.5, 4.2, -7.5], look: [14, 1.1, 1.5] };
    },
    // 3 — on foot: Jax in the Old Market, stalls + peds, Odile dialogue open,
    // objective ~12 m away, pistol ammo on the HUD.
    onfoot: function (state) {
      var plaza = state.city.plaza;
      state.player.x = plaza.x - 11; state.player.z = plaza.z + 3;
      state.player.ry = Math.PI / 2;
      state.player.aiming = true;
      state.player.fig.gun.visible = true;
      VN.avatar.pose(state.player.fig, 0, 0, true);
      state.mode = 'foot';
      // Odile figure facing Jax (she came to the market herself for this one)
      var odile = VN.avatar.buildPerson({ skin: 0xe8b48c, shirt: 0x701a4d, pants: 0x14141c, hat: false });
      odile.group.position.set(plaza.x - 8.6, 0, plaza.z + 3.2);
      odile.group.rotation.y = -Math.PI / 2;
      state.scene.add(odile.group);
      // a few peds among the stalls
      for (var i = 0; i < 5 && i < state.peds.length; i++) {
        var ped = state.peds[i];
        ped.x = plaza.x - 4 + i * 3.4; ped.z = plaza.z - 5 + (i % 2) * 7;
        ped.fig.group.position.set(ped.x, 0, ped.z);
        ped.fig.group.rotation.y = i * 1.3;
      }
      state.story.active = VN.story.MISSIONS[0];
      state.story.stage = 0; // reach plaza: player stands ~11–12 m out
      VN.ui.dialogue(state, [['Odile Vane', 'The parcel is under the third stall, Jax. Take it, and do not let the rain — or anyone — slow you down.']], null);
      state.mode = 'dialogue';
      return { pos: [plaza.x - 15.5, 3.1, plaza.z + 8.5], look: [plaza.x - 4, 1.2, plaza.z + 1] };
    },
    // 4 — mission: Dockmaster Pickup on the harbor run, timed stage at ~96 s,
    // marker ~47 m, TATTOO sign, oncoming traffic.
    mission: function (state) {
      var car = setPlayerCar(state, 2, 0x8a4a20, -46, 153, -Math.PI / 3.2);
      car.speed = 20;
      state.story.active = VN.story.MISSIONS[1];
      state.story.stage = 1; // timed delivery to Dock Nine
      state.story.timer = 96;
      var on = VN.drive.makeCar(0, state.rng, false);
      placeCar(state, on, -64, 147, -Math.PI / 2, 12); state.traffic.push(on);
      var on2 = VN.drive.makeCar(7, state.rng, false);
      placeCar(state, on2, -18, 147, -Math.PI / 2, 12); state.traffic.push(on2);
      tattooSign(state, -58, 6.5, 158.5, Math.PI);
      return { pos: [-58, 5.2, 141], look: [-30, 1.2, 162] };
    }
  };

  function setup(state, name) {
    var fn = SCENES[name] || SCENES.cover;
    var cam = fn(state);
    state.shotCam = cam;
    return cam;
  }

  return { setup: setup, names: Object.keys(SCENES) };
})();
