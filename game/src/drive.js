// drive.js — Velmara's cars: factory for nine body styles (including the
// indigo / magenta Orphee GT), arcade driving physics with handbrake drift
// and damage smoke, plus the road-grid traffic brain every AI car shares.
window.VN = window.VN || {};

VN.drive = (function () {
  'use strict';

  var MODELS = [
    { name: 'Civetta Sedan', w: 1.9, l: 4.4, h: 0.62, cab: 0.5, top: 34, acc: 15, colors: [0x707a88, 0x9c3848, 0x38618c, 0x888888, 0x2e4a3a] },
    { name: 'Blista Compact', w: 1.75, l: 3.8, h: 0.6, cab: 0.52, top: 30, acc: 16, colors: [0xc7a23a, 0x60a0c0, 0xb0b0b0, 0x7050b8] },
    { name: 'Dockmaster Pickup', w: 2.0, l: 4.9, h: 0.72, cab: 0.5, top: 30, acc: 14, colors: [0x8a4a20, 0x4a5a68, 0x705838, 0x37474f] },
    { name: 'Vigero Coupe', w: 1.9, l: 4.5, h: 0.55, cab: 0.44, top: 40, acc: 20, colors: [0xd06030, 0x222228, 0x9c2030, 0x286048] },
    { name: 'Orphee GT', w: 2.0, l: 4.7, h: 0.5, cab: 0.4, top: 48, acc: 26, colors: [0xff2e88, 0x3b2bd8, 0x00b8a8] },
    { name: 'Regina Wagon', w: 1.9, l: 4.8, h: 0.66, cab: 0.56, top: 31, acc: 14, colors: [0x6a7a5c, 0x8c6a4a, 0x5a6a8c] },
    { name: 'Taxi Cabrio', w: 1.9, l: 4.4, h: 0.6, cab: 0.5, top: 35, acc: 17, colors: [0xf2b821] },
    { name: 'Pony Van', w: 2.0, l: 4.9, h: 0.95, cab: 0.62, top: 28, acc: 13, colors: [0xb8bcc2, 0x708090, 0x9c8455] },
    { name: 'Interceptor', w: 1.95, l: 4.7, h: 0.58, cab: 0.46, top: 46, acc: 24, colors: [0x14161f] }
  ];

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }
  var glassMat = new THREE.MeshLambertMaterial({ color: 0x0e2233 });
  var tyreMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
  var chromeMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ae });
  var lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  var policePaint = new THREE.MeshLambertMaterial({ color: 0xe8ecf2 });
  var policeDark = new THREE.MeshLambertMaterial({ color: 0x14161f });

  function buildCar(modelIdx, color, isPolice) {
    var def = MODELS[modelIdx];
    var g = new THREE.Group();
    var paint = new THREE.MeshLambertMaterial({ color: color });
    var body = box(def.w, def.h, def.l, isPolice ? policeDark : paint, 0, 0.42 + def.h / 2, 0);
    g.add(body);
    var cabZ = def.l * 0.02;
    var cab = box(def.w * 0.82, def.cab, def.l * 0.46, isPolice ? policePaint : glassMat, 0, 0.42 + def.h + def.cab / 2 - 0.04, cabZ);
    g.add(cab);
    if (isPolice) {
      // light bar: red / blue halves, toggled flashing by law.js
      var barL = box(0.55, 0.16, 0.5, new THREE.MeshBasicMaterial({ color: 0xff2233 }), -0.32, 0.42 + def.h + def.cab + 0.06, cabZ);
      var barR = box(0.55, 0.16, 0.5, new THREE.MeshBasicMaterial({ color: 0x2266ff }), 0.32, 0.42 + def.h + def.cab + 0.06, cabZ);
      barL.name = 'barL'; barR.name = 'barR';
      g.add(barL); g.add(barR);
      g.userData.barL = barL; g.userData.barR = barR;
    }
    // headlights + tails
    g.add(box(0.34, 0.14, 0.06, lightMat, -def.w * 0.32, 0.72, def.l / 2 + 0.01));
    g.add(box(0.34, 0.14, 0.06, lightMat, def.w * 0.32, 0.72, def.l / 2 + 0.01));
    g.add(box(0.34, 0.12, 0.06, tailMat, -def.w * 0.32, 0.74, -def.l / 2 - 0.01));
    g.add(box(0.34, 0.12, 0.06, tailMat, def.w * 0.32, 0.74, -def.l / 2 - 0.01));
    // wheels
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    var wheels = [];
    var wx = def.w / 2 - 0.05, wz = def.l / 2 - 0.85;
    [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, tyreMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.36, p[1]);
      g.add(w); wheels.push(w);
    });
    g.add(box(def.w * 0.7, 0.1, 0.08, chromeMat, 0, 0.5, def.l / 2 + 0.02)); // bumper shine
    // headlight cones (fake volumetrics, additive planes)
    var coneMat = new THREE.MeshBasicMaterial({ color: 0xffedb5, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false });
    var coneGeo = new THREE.ConeGeometry(1.5, 9, 12, 1, true);
    [-0.6, 0.6].forEach(function (ox) {
      var cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2 + 0.06;
      cone.position.set(ox, 0.66, def.l / 2 + 4.4);
      g.add(cone);
    });
    return { group: g, wheels: wheels, def: def };
  }

  function makeCar(modelIdx, rng, isPolice) {
    var def = MODELS[modelIdx];
    var color = isPolice ? 0x14161f : def.colors[(rng() * def.colors.length) | 0];
    var built = buildCar(modelIdx, color, isPolice);
    return {
      model: modelIdx, def: def, group: built.group, wheels: built.wheels,
      x: 0, z: 0, ry: 0, speed: 0, steer: 0,
      health: 100, smoke: 0, police: !!isPolice, driver: null,
      ai: null, dead: false, color: color
    };
  }

  // Arcade step for the player's car. input: {f,b,l,r,hand}
  function stepPlayer(car, input, dt, colliders) {
    var def = car.def;
    var accel = input.f ? def.acc : 0;
    var brake = input.b ? (car.speed > 0.5 ? 26 : -9) : 0;
    car.speed += (accel + brake) * dt;
    if (!input.f && !input.b) car.speed -= car.speed * 0.55 * dt;      // drag
    car.speed -= car.speed * Math.abs(car.speed) * 0.004 * dt * 10;   // aero
    var maxF = def.top, maxR = -10;
    if (car.speed > maxF) car.speed = maxF;
    if (car.speed < maxR) car.speed = maxR;
    var steerTarget = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    car.steer += (steerTarget * 0.55 - car.steer) * Math.min(1, dt * 8);
    var grip = input.hand ? 0.35 : 1;
    if (input.hand) car.speed -= car.speed * 0.9 * dt;
    var turn = car.steer * (car.speed / Math.max(6, def.top)) * 1.9 * grip;
    if (car.speed !== 0) car.ry += turn * dt * (car.speed < 0 ? -1 : 1) * (input.hand ? 1.7 : 1);
    var nx = car.x + Math.sin(car.ry) * car.speed * dt;
    var nz = car.z + Math.cos(car.ry) * car.speed * dt;
    var res = VN.city.collide(colliders, nx, nz, 1.35);
    if (res.x !== nx || res.z !== nz) { // hit a wall: scrape damage
      if (Math.abs(car.speed) > 9) damage(car, Math.abs(car.speed) * 0.7);
      car.speed *= 0.35;
    }
    car.x = res.x; car.z = res.z;
    sync(car, dt);
  }

  function sync(car, dt) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.ry;
    var spin = car.speed * (dt || 0.016) / 0.36;
    for (var i = 0; i < car.wheels.length; i++) {
      car.wheels[i].rotation.x += spin;
      if (i < 2) car.wheels[i].rotation.y = car.steer * 0.7;
    }
    // damage smoke: grey puffs scale with damage
    car.smoke = car.health < 55 ? (55 - car.health) / 55 : 0;
  }

  function damage(car, amount) {
    car.health -= amount;
    if (car.health < 0) car.health = 0;
  }

  // --- Traffic brain -----------------------------------------------------
  // Cars follow avenue lines; at each junction they may turn. They brake for
  // the car ahead and flee (fast, sloppy) when gunfire is near.
  function makeTrafficBrain(rng, x, z) {
    var horizontal = rng() < 0.5;
    return {
      horizontal: horizontal,
      dir: rng() < 0.5 ? 1 : -1,
      lane: (rng() < 0.5 ? 1 : -1) * 3.1,
      cruise: 10 + rng() * 6,
      flee: 0,
      turnCooldown: 0
    };
  }
  function stepTraffic(car, dt, allCars, panic) {
    var ai = car.ai, def = car.def;
    var target = ai.cruise;
    if (panic && panicDist(car, panic) < 30) ai.flee = 2.5;
    if (ai.flee > 0) { ai.flee -= dt; target = def.top * 0.92; }
    // brake for leader on same lane
    for (var i = 0; i < allCars.length; i++) {
      var o = allCars[i];
      if (o === car || o.dead) continue;
      var dx = o.x - car.x, dz = o.z - car.z;
      var ahead = ai.horizontal ? dx * ai.dir : dz * ai.dir;
      var side = ai.horizontal ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && side < 2.2) { target = Math.min(target, Math.max(0, (ahead - 5) * 2)); }
    }
    var accel = target > car.speed ? def.acc * 0.55 : 22;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt);
    // advance along axis; turn at junctions
    if (ai.horizontal) car.x += ai.dir * car.speed * dt;
    else car.z += ai.dir * car.speed * dt;
    ai.turnCooldown -= dt;
    var along = ai.horizontal ? car.x : car.z;
    var mod = ((along % 48) + 48) % 48;
    if (ai.turnCooldown <= 0 && (mod < 1.6 || mod > 46.4) && Math.random() < 0.012) {
      // turn onto the crossing avenue, snapped to its right-hand lane
      if (ai.horizontal) car.z = snapLane(car.z, ai); else car.x = snapLane(car.x, ai);
      ai.horizontal = !ai.horizontal;
      ai.dir = Math.random() < 0.5 ? 1 : -1;
      ai.turnCooldown = 3;
    }
    // keep lane offset
    if (ai.horizontal) { car.z += ((Math.round(car.z / 48) * 48 + laneOff(ai)) - car.z) * Math.min(1, dt * 2); car.ry = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.x += ((Math.round(car.x / 48) * 48 + laneOff(ai)) - car.x) * Math.min(1, dt * 2); car.ry = ai.dir > 0 ? 0 : Math.PI; }
    // world edge: turn around
    if (Math.abs(car.x) > 224 || Math.abs(car.z) > 224) { ai.dir *= -1; }
    sync(car, dt);
  }
  function laneOff(ai) { return ai.dir > 0 ? 3.1 : -3.1; }
  function snapLane(v, ai) { return Math.round(v / 48) * 48 + laneOff(ai); }
  function panicDist(car, p) { var dx = car.x - p.x, dz = car.z - p.z; return Math.sqrt(dx * dx + dz * dz); }

  return { MODELS: MODELS, makeCar: makeCar, stepPlayer: stepPlayer, stepTraffic: stepTraffic, makeTrafficBrain: makeTrafficBrain, damage: damage, sync: sync };
})();
