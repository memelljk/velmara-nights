// snapshots.js - deterministic posed scenes for the screenshots (?shot=).
// Headless Chrome on this VM composites frames only on demand and runs
// real-time simulation at a fraction of real time, so scenes are POSED, not
// played: positions, cars, cruisers, stars and HUD state are set directly,
// then the still renders. No gameplay state is simulated for a shot.
window.VN = window.VN || {};

VN.SHOTS = {
  apply(G, name) {
    const ui = G.ui;
    ui.hideTitle();
    G.cash = 1840;
    G.rep = 120;
    G.health = 92;
    G.clockMinutes = 23 * 60 + 12;
    const cam = (x, y, z, lx, ly, lz) => {
      G.camera.position.set(x, y, z);
      G.camera.lookAt(lx, ly, lz);
    };
    const mission = (idx, legIdx, extra) => {
      G.story.active = Object.assign(
        { mission: VN.MISSIONS[idx], legIdx, timer: null, holdT: 0, thugs: [], aliveCount: 0 },
        extra || {}
      );
      const leg = G.story.currentLeg();
      ui.setObjective(VN.MISSIONS[idx].title, leg ? leg.label : '');
    };
    const drivePose = (car, x, z, heading, speed) => {
      car.x = x; car.z = z; car.heading = heading; car.speed = speed || 0;
      car.driver = 'player';
      car.parked = false;
      car.setHeadlights(true);
      car.syncMesh();
      G.playerCar = car;
      G.mode = 'car';
      G.player.group.visible = false;
      return car;
    };
    const findCar = (model, parked) => G.cars.find(c => c.model === model && (parked == null || c.parked === parked) && c !== G.gtCar) || G.cars[0];

    if (name === 'cover') {
      // Pink Orphee GT eastbound on the Neon Mile, traffic ahead, rain on.
      const gt = new VN.Car({ x: 30, z: 23.6, heading: -Math.PI / 2, model: 'gt', color: 0xff5fa8 }, {});
      G.scene.add(gt.group); G.scene.add(gt.smoke);
      G.cars.push(gt);
      drivePose(gt, 30, 23.6, -Math.PI / 2, 17);
      const ahead1 = findCar('sedan', false);
      ahead1.x = 58; ahead1.z = 23.6; ahead1.heading = -Math.PI / 2; ahead1.speed = 9; ahead1.syncMesh();
      const ahead2 = findCar('hatch', false);
      ahead2.x = 84; ahead2.z = 16.4; ahead2.heading = Math.PI / 2; ahead2.speed = 8; ahead2.syncMesh();
      mission(0, 0);
      cam(30 + Math.sin(-Math.PI / 2) * 11.5, 3.6, 23.6 + Math.cos(-Math.PI / 2) * 11.5, 44, 1.8, 23.6);
    } else if (name === 'chase') {
      // Player coupe at speed; the camera waits AHEAD of the car, looking
      // back down the lane, so all four cruisers sit in frame behind it.
      const coupe = findCar('coupe', true);
      drivePose(coupe, 46, -56.4, -Math.PI / 2, 26);
      coupe.color = 0xd8b13c;
      for (let i = 0; i < 4; i++) {
        const cruiser = new VN.Car(
          { x: 34 - i * 10.5, z: -56.4 + (i % 2) * 1.4, heading: -Math.PI / 2, model: 'cruiser', color: 0x232a38 },
          { police: true }
        );
        cruiser.driver = 'cop';
        cruiser.speed = 24;
        cruiser.setHeadlights(true);
        cruiser.syncMesh();
        G.scene.add(cruiser.group); G.scene.add(cruiser.smoke);
        G.cars.push(cruiser);
        G.law.cruisers.push(cruiser);
      }
      const off = G.law.spawnOfficer(G.law.cruisers[0]);
      off.x = 52; off.z = -47.5; off.heading = -Math.PI / 2; off.syncMesh();
      G.law.heat = 380;
      G.law.stars = 4;
      G.story.active = { mission: VN.MISSIONS[4], legIdx: 2, timer: null, holdT: 0, thugs: [], aliveCount: 0 };
      ui.setObjective('THE HARBOR VAULT', 'Lose the police');
      cam(46 + 17, 3.4, -56.4 + 2.5, 30, 1.6, -56.4);
    } else if (name === 'onfoot') {
      // Jax in the Old Market, ~12 m from the parcel marker, Odile across
      // her travelling stall with the dialogue open, pistol drawn.
      G.player.x = -147; G.player.z = -60;
      G.player.heading = Math.atan2(-158 - -147, -66 - -60);
      G.player.group.position.set(G.player.x, 0, G.player.z);
      G.player.group.rotation.y = G.player.heading;
      G.player.fig.setGun(true);
      G.gunDrawn = true;
      G.odile.group.position.set(-152, 0, -64.5);
      G.odile.group.rotation.y = Math.atan2(G.player.x - -152, G.player.z - -64.5);
      const near = [[-142, -56], [-155, -52], [-138, -66], [-160, -58]];
      near.forEach((pt, i) => {
        const ped = G.peds[i + 3];
        if (ped) { ped.x = pt[0]; ped.z = pt[1]; ped.speed = 0; ped.syncMesh(); }
      });
      mission(0, 0);
      ui.showDialogue('Odile', 'The parcel is in the blue stall behind you, Rook. Dry hands, quick feet - and do not open it.');
      G.camYaw = G.player.heading + Math.PI;
      cam(G.player.x + Math.sin(G.camYaw) * 7.5, 3.1, G.player.z + Math.cos(G.camYaw) * 7.5, -156, 1.5, -65);
    } else if (name === 'mission') {
      // Dockmaster Pickup on the harbor run: ~47 m out, ~96 s on the clock,
      // the TATTOO sign lit ahead-right, oncoming traffic in the far lane.
      const pickup = findCar('pickup', false) || findCar('pickup', true);
      drivePose(pickup, 185, 183.6, -Math.PI / 2, 21);
      const oncoming = findCar('sedan', false);
      oncoming.x = 224; oncoming.z = 176.4; oncoming.heading = Math.PI / 2; oncoming.speed = 10; oncoming.syncMesh();
      mission(1, 0, { timer: 95.6 });
      cam(185 - 12.5, 4.6, 183.6 - 3.5, 205, 2.2, 186);
    }
    // One HUD refresh with the posed numbers (minimap included).
    ui.update(0);
  },
};
