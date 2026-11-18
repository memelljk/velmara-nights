// snapshots.js — deterministic posed scenes for ?shot=<scene>&seed=7
// Simulation is frozen in shot mode (play.js), so every pose below is exactly
// what the camera sees: cars sit ON road lanes, cruisers behind the player.
window.VN = window.VN || {};
VN.applyShot = function (name) {
  var g = VN.game;
  g.startGame(true);
  var hero = g.hero;
  function poseCar(car, x, z, heading, speed) {
    car.x = x; car.z = z; car.heading = heading; car.speed = speed || 0;
    car.mesh.position.set(x, 0, z); car.mesh.rotation.y = heading;
    g.scene.add(car.mesh); g.allCars.push(car);
    return car;
  }
  if (name === 'cover') {
    // pink Orphee GT on the x=0 avenue (Neon Mile), driving north, traffic ahead
    var car = poseCar(VN.makeCar(0, 5.5, 168, Math.PI), 5.5, 168, Math.PI, 17);
    g.enterCar(car, true);
    poseCar(VN.makeCar(3, 5.5, 138, Math.PI), 5.5, 138, Math.PI, 10);   // traffic ahead, same lane
    poseCar(VN.makeCar(4, -5.5, 124, 0), -5.5, 124, 0, 10);               // oncoming
    VN.story.idx = 0; VN.story.active = true; VN.story.step = 0;
    VN.ui.showBanner('FIRST PARCEL'); VN.ui.setObjective(VN.MISSIONS[0].steps[0].label);
    g.camYaw = 0; g.camPitch = 0.3;
  } else if (name === 'chase') {
    var coupe = poseCar(VN.makeCar(1, 5.5, -36, Math.PI), 5.5, -36, Math.PI, 26);
    g.enterCar(coupe, true);
    // FOUR cruisers behind the player car (south of it, in frame), light bars on
    var spots = [[-2, -32], [9.5, -32.5], [-2, -28], [9.5, -28.5]];
    for (var i = 0; i < 4; i++) {
      var pc = VN.makeCar(1, spots[i][0], spots[i][1], Math.PI, 0xe8ecf2);
      pc.mesh = VN.carMeshes(0xe8ecf2, { police: true });
      pc.x = spots[i][0]; pc.z = spots[i][1]; pc.heading = Math.PI;
      pc.mesh.position.set(pc.x, 0, pc.z); pc.mesh.rotation.y = Math.PI;
      g.scene.add(pc.mesh); VN.law.cars.push(pc);
    }
    var off = VN.makePerson(-10.5, -45, 0x1c2f57, 0x141c30, 0xa87858);
    off.mesh.position.set(-10.5, 0, -45); g.scene.add(off.mesh); VN.law.officers.push(off);
    VN.law.wanted = 4; VN.law.heat = 80;
    VN.ui.showBanner('LOSE THE POLICE'); VN.ui.setObjective('Lose the police — break their sight line');
    g.markerOverride = null;
    g.camYaw = 0; g.camPitch = 0.3;
  } else if (name === 'onfoot') {
    hero.x = -158; hero.z = -38; hero.heading = 0.6;
    hero.mesh.position.set(hero.x, 0, hero.z); hero.mesh.rotation.y = 0.6;
    // posed pedestrians among the stalls
    [[-148, -27, 0xd84f6a], [-143, -36, 0x3fa7d8], [-151, -20, 0xd8a53f]].forEach(function (pp) {
      var p = VN.makePerson(pp[0], pp[1], pp[2], 0x232830, 0xb98a64);
      p.mesh.position.set(pp[0], 0, pp[1]); p.mesh.rotation.y = 2.4;
      g.scene.add(p.mesh);
    });
    VN.story.idx = 0;
    VN.ui.dialogue(VN.MISSIONS[0].intro, function () { VN.story.start(); });
    VN.ui.dlgQueue = [];
    document.getElementById('dlg-name').textContent = 'Odile';
    document.getElementById('dlg-text').textContent = VN.MISSIONS[0].intro[0][1];
    document.getElementById('dialogue').style.display = 'block';
    g.state = 'play';
    VN.ui.setObjective('Meet Odile — marker 12 m');
    g.markerOverride = { x: hero.x + 7, z: hero.z - 10 };
    g.camYaw = -2.54; g.camPitch = 0.34;
  } else if (name === 'mission') {
    // Dockmaster Pickup on the harbor road (x=120 avenue), heading south to Dock Nine
    var truck = poseCar(VN.makeCar(2, 125.5, 196, 0), 125.5, 196, 0, 15);
    g.enterCar(truck, true);
    poseCar(VN.makeCar(3, 114.5, 246, Math.PI), 114.5, 246, Math.PI, 11); // oncoming traffic
    VN.story.idx = 1; VN.story.active = true; VN.story.step = 0; VN.story.timer = 96;
    VN.ui.showBanner('NINE MINUTES TO DOCK NINE');
    VN.ui.setObjective(VN.MISSIONS[1].steps[0].label);
    g.markerOverride = { x: 153.5, z: 233.5 }; // ~47 m from the truck
    g.camYaw = Math.PI; g.camPitch = 0.3;
  }
  g.updateHUDAndMap();
};
