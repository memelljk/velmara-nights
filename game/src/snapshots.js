// snapshots.js — deterministic posed scenes for ?shot=<scene>&seed=7 (no gameplay simulation)
window.VN = window.VN || {};
VN.applyShot = function (name) {
  var g = VN.game;
  g.startGame(true);
  var hero = g.hero;
  if (name === 'cover') {
    var car = VN.makeCar(0, 28, 168, Math.PI); // pink Orphee GT on the Neon Mile
    g.scene.add(car.mesh); g.allCars.push(car);
    g.enterCar(car, true);
    car.speed = 17; car.x = 28; car.z = 168; car.heading = Math.PI;
    car.mesh.position.set(28, 0, 168); car.mesh.rotation.y = Math.PI;
    VN.story.idx = 0; VN.story.active = true; VN.story.step = 0;
    VN.ui.showBanner('FIRST PARCEL'); VN.ui.setObjective(VN.MISSIONS[0].steps[0].label);
    g.camYaw = 0; // camera behind car (south), traffic ahead in frame
  } else if (name === 'chase') {
    var coupe = VN.makeCar(1, -8, -36, Math.PI);
    g.scene.add(coupe.mesh); g.allCars.push(coupe);
    g.enterCar(coupe, true); coupe.speed = 26; coupe.heading = Math.PI;
    coupe.mesh.position.set(-8, 0, -36); coupe.mesh.rotation.y = Math.PI;
    // FOUR cruisers behind the player car (positive z side, in frame from road camera)
    for (var i = 0; i < 4; i++) {
      var pc = VN.makeCar(1, -14 + (i % 2) * 11, -36 + 15 + Math.floor(i / 2) * 11, Math.PI, 0xe8ecf2);
      pc.mesh = VN.carMeshes(0xe8ecf2, { police: true });
      pc.mesh.position.set(pc.x, 0, pc.z); pc.mesh.rotation.y = Math.PI;
      g.scene.add(pc.mesh); VN.law.cars.push(pc);
    }
    var off = VN.makePerson(-19, -18, 0x1c2f57, 0x141c30, 0xa87858);
    g.scene.add(off.mesh); VN.law.officers.push(off);
    VN.law.wanted = 4; VN.law.heat = 80;
    VN.ui.showBanner('LOSE THE POLICE'); VN.ui.setObjective('Lose the police — break their sight line');
    g.camYaw = 0;
  } else if (name === 'onfoot') {
    hero.x = -158; hero.z = -38; hero.heading = 0.6;
    hero.mesh.position.set(hero.x, 0, hero.z);
    VN.story.idx = 0;
    VN.ui.dialogue(VN.MISSIONS[0].intro, function () { VN.story.start(); });
    // re-open visually for the still: keep dialogue box up with first line
    VN.ui.dlgQueue = [];
    document.getElementById('dlg-name').textContent = 'Odile';
    document.getElementById('dlg-text').textContent = VN.MISSIONS[0].intro[0][1];
    document.getElementById('dialogue').style.display = 'block';
    g.state = 'play';
    VN.ui.setObjective('Meet Odile — marker 12 m');
    g.markerOverride = { x: hero.x + 7, z: hero.z - 10 };
    g.camYaw = -2.54;
  } else if (name === 'mission') {
    var truck = VN.makeCar(2, 128, 196, Math.PI * 0.92);
    g.scene.add(truck.mesh); g.allCars.push(truck);
    g.enterCar(truck, true); truck.speed = 15; truck.heading = Math.PI * 0.92;
    truck.mesh.position.set(128, 0, 196); truck.mesh.rotation.y = truck.heading;
    VN.story.idx = 1; VN.story.active = true; VN.story.step = 0; VN.story.timer = 96;
    VN.ui.showBanner('NINE MINUTES TO DOCK NINE');
    VN.ui.setObjective(VN.MISSIONS[1].steps[0].label);
    g.markerOverride = { x: 160, z: 232 }; // ~47 m from truck
    g.camYaw = -0.25;
  }
  g.updateHUDAndMap();
};
