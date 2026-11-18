// drive.js — every car in Velmara: the low-poly car factory, the parked
// fleet, arcade driving for the player (throttle, drift handbrake, damage
// and smoke), and the traffic AI that cruises the road grid, brakes for
// obstacles and flees gunfire. Cars can be entered, stolen from their
// drivers, and wrecked.
window.V = window.V || {};
(function () {
  'use strict';

  var KINDS = {
    sedan:  { w: 1.9, l: 4.4, h: 0.62, cabin: 0.5, top: 34, accel: 15, grip: 3.4, colours: [0x8c97a8, 0x5e6e8c, 0x9c8a6a, 0x6a8c72, 0x7a4a56] },
    coupe:  { w: 1.85, l: 4.2, h: 0.55, cabin: 0.44, top: 41, accel: 19, grip: 3.8, colours: [0xc94f6d, 0xe07b39, 0x3fa7a0, 0xd9c441, 0x8f5fd0] },
    taxi:   { w: 1.9, l: 4.5, h: 0.64, cabin: 0.52, top: 33, accel: 15, grip: 3.4, colours: [0xe8b13c] },
    pickup: { w: 2.0, l: 4.9, h: 0.78, cabin: 0.55, top: 31, accel: 14, grip: 3.0, colours: [0x7a8894, 0x96684a, 0x5e7a52] },
    orphee: { w: 1.95, l: 4.5, h: 0.5, cabin: 0.4, top: 47, accel: 23, grip: 4.2, colours: [0x3b2f8f] }, // indigo GT
    cruiser:{ w: 1.95, l: 4.7, h: 0.66, cabin: 0.52, top: 43, accel: 21, grip: 3.9, colours: [0x1c2733] }
  };
  var rng = V.makeRng(4242);

  var cars = [];
  var sceneRef = null;
  var smokePool = [];

  function makeCarMesh(kind, colour) {
    var spec = KINDS[kind];
    var g = new THREE.Group();
    var paint = new THREE.MeshLambertMaterial({ color: colour });
    var dark = new THREE.MeshLambertMaterial({ color: 0x14161c });
    var glass = new THREE.MeshLambertMaterial({ color: 0x0e1622 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), paint);
    body.position.y = 0.35 + spec.h / 2;
    g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.82, spec.cabin, spec.l * 0.46), glass);
    cabin.position.set(0, 0.35 + spec.h + spec.cabin / 2 - 0.04, -spec.l * 0.04);
    g.add(cabin);
    if (kind === 'pickup') {
      var bed = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.9, 0.3, spec.l * 0.3), dark);
      bed.position.set(0, 0.35 + spec.h + 0.1, spec.l * 0.32);
      g.add(bed);
    }
    if (kind === 'taxi') {
      var signB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34),
        new THREE.MeshBasicMaterial({ color: 0xffe95e }));
      signB.position.set(0, 0.35 + spec.h + spec.cabin + 0.1, -spec.l * 0.04);
      g.add(signB);
    }
    var wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    var wheels = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(s[0] * (spec.w / 2 - 0.05), 0.37, s[1] * spec.l * 0.32);
      g.add(w); wheels.push(w);
    });
    // headlights: emissive blocks plus fake light cones for the wet street
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.6, 0.6].forEach(function (sx) {
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
      lamp.position.set(sx * spec.w * 0.62, 0.72, spec.l / 2 + 0.02);
      g.add(lamp);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      tl.position.set(sx * spec.w * 0.62, 0.78, -spec.l / 2 - 0.02);
      g.add(tl);
    });
    var coneGeo = new THREE.ConeGeometry(1.15, 6.5, 10, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0xffedb5, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 0.62, spec.l / 2 + 3.1);
    g.add(cone);
    var extras = { wheels: wheels, cone: cone };
    if (kind === 'cruiser') {
      var bar = new THREE.Group();
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.x = -0.32;
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x2255ff }));
      blue.position.x = 0.32;
      bar.add(red); bar.add(blue);
      bar.position.set(0, 0.35 + spec.h + spec.cabin + 0.1, -spec.l * 0.04);
      g.add(bar);
      extras.lightBar = bar; extras.barRed = red; extras.barBlue = blue;
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.04, 0.3, spec.l * 0.7),
        new THREE.MeshLambertMaterial({ color: 0xd8dee8 }));
      stripe.position.y = 0.62;
      g.add(stripe);
    }
    return { group: g, extras: extras };
  }

  function spawnCar(kind, x, z, ry, opts) {
    opts = opts || {};
    var spec = KINDS[kind];
    var colour = opts.colour !== undefined ? opts.colour
      : spec.colours[(rng() * spec.colours.length) | 0];
    var built = makeCarMesh(kind, colour);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = ry;
    sceneRef.add(built.group);
    var car = {
      kind: kind, spec: spec, mesh: built.group, extras: built.extras,
      x: x, z: z, ry: ry, speed: 0, steer: 0,
      health: 100, driver: opts.driver || 'parked', // parked|traffic|player|police
      ai: opts.ai || null, smokeT: 0, dead: false, colour: colour,
      id: cars.length
    };
    cars.push(car);
    return car;
  }

  function initCars(scene, city) {
    sceneRef = scene;
    city.parkedSpawns.forEach(function (s) { spawnCar(s.kind, s.x, s.z, s.ry, {}); });
    // the indigo Orphee GT, parked outside Orphee Motors for mission 3
    var gt = spawnCar('orphee', city.orpheeLot.x, city.orpheeLot.z, Math.PI / 2, {});
    gt.isOrphee = true;
    // opening traffic
    for (var i = 0; i < 11; i++) spawnTrafficCar(city);
    // smoke particle pool
    var geo = new THREE.BufferGeometry();
    var pts = new Float32Array(240 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    var mat = new THREE.PointsMaterial({ color: 0x9aa0aa, size: 1.5, transparent: true, opacity: 0.5, depthWrite: false });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    for (var p = 0; p < 240; p++) smokePool.push({ x: 0, y: -50, z: 0, life: 0, vx: 0, vy: 0, vz: 0 });
    initCars.smoke = { points: points, geo: geo };
  }

  function puffSmoke(x, y, z) {
    for (var i = 0; i < smokePool.length; i++) {
      var p = smokePool[i];
      if (p.life <= 0) {
        p.x = x; p.y = y; p.z = z; p.life = 1.1;
        p.vx = (rng() - 0.5) * 0.8; p.vy = 2.2 + rng(); p.vz = (rng() - 0.5) * 0.8;
        return;
      }
    }
  }

  function updateSmoke(dt) {
    if (!initCars.smoke) return;
    var arr = initCars.smoke.geo.attributes.position.array;
    for (var i = 0; i < smokePool.length; i++) {
      var p = smokePool[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.life <= 0) p.y = -50;
      }
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    initCars.smoke.geo.attributes.position.needsUpdate = true;
  }

  // --- traffic AI -----------------------------------------------------------
  function spawnTrafficCar(city) {
    var lines = city.roadLines;
    var vertical = rng() < 0.5;
    var line = lines[(rng() * lines.length) | 0];
    var along = -280 + rng() * 560;
    var dirSign = rng() < 0.5 ? 1 : -1;
    // right-hand traffic: lane offset depends on direction of travel
    var lane = dirSign * 5.6;
    var x = vertical ? line + lane : along;
    var z = vertical ? along : line - lane;
    if (z > 248) z = 200;
    var ry = vertical ? (dirSign > 0 ? 0 : Math.PI) : (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2);
    var kind = ['sedan', 'coupe', 'taxi', 'pickup'][(rng() * 4) | 0];
    var car = spawnCar(kind, x, z, ry, { driver: 'traffic' });
    car.ai = { vertical: vertical, line: line, dir: dirSign, targetSpeed: 10 + rng() * 5, panic: 0 };
    return car;
  }

  function carAhead(car, dist) {
    // nearest car or the hero (on foot) roughly in front of this car
    var fx = Math.sin(car.ry), fz = Math.cos(car.ry);
    var best = null, bd = dist;
    function probe(ox, oz) {
      var dx = ox - car.x, dz = oz - car.z;
      var fwd = dx * fx + dz * fz;
      var side = Math.abs(dx * fz - dz * fx);
      if (fwd > 0.5 && fwd < bd && side < 2.4) { bd = fwd; best = true; }
    }
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o !== car && !o.dead) probe(o.x, o.z);
    }
    var h = V.hero();
    if (h && !h.inCar) probe(h.x, h.z);
    return best ? bd : 0;
  }

  function stepTraffic(car, dt, city) {
    var ai = car.ai;
    if (ai.panic > 0) ai.panic -= dt;
    var want = ai.panic > 0 ? car.spec.top : ai.targetSpeed;
    var ahead = carAhead(car, 13);
    if (ahead) want = Math.min(want, Math.max(0, (ahead - 6) * 1.4));
    car.speed += V.clamp(want - car.speed, -26 * dt, car.spec.accel * 0.7 * dt);
    car.x += Math.sin(car.ry) * car.speed * dt;
    car.z += Math.cos(car.ry) * car.speed * dt;
    // choose a turn at the next intersection
    var lines = city.roadLines;
    var along = ai.vertical ? car.z : car.x;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (Math.abs(along - L) < 1.6 && Math.abs((ai.vertical ? car.x : car.z) - ai.line) < 2) {
        if (rng() < 0.45) {
          // turn onto the crossing road
          var newDir = rng() < 0.5 ? 1 : -1;
          ai.vertical = !ai.vertical;
          ai.line = L;
          ai.dir = newDir;
          car.ry = ai.vertical ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          // snap into the correct lane of the new road
          var lane = newDir * 5.6;
          if (ai.vertical) car.x = L + lane; else car.z = L - lane;
        }
        break;
      }
    }
    if (car.z > 252 && ai.vertical && ai.dir > 0) { ai.dir = -1; car.ry = Math.PI; }
    if (Math.abs(car.x) > 306 || Math.abs(car.z) > 306) {
      // recycle far-flung traffic back onto the grid
      var fresh = spawnTrafficCar(city);
      car.x = fresh.x; car.z = fresh.z; car.ry = fresh.ry; car.ai = fresh.ai;
      cars.splice(cars.indexOf(fresh), 1);
      sceneRef.remove(fresh.mesh);
    }
    syncMesh(car, dt);
  }

  function syncMesh(car, dt) {
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.ry;
    var spin = car.speed * dt * 2.6;
    car.extras.wheels.forEach(function (w) { w.rotation.x += spin; });
    if (car.health < 45 && !car.dead) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.07;
        puffSmoke(car.x, 1.1, car.z);
      }
    }
  }

  // --- player driving -------------------------------------------------------
  // input: {throttle -1..1, steer -1..1, brake bool, handbrake bool}
  function stepPlayerCar(car, dt, input, city) {
    var spec = car.spec;
    if (car.dead) { car.speed *= Math.pow(0.4, dt); }
    else if (input.throttle > 0) car.speed += spec.accel * dt * (car.speed < 0 ? 2.2 : 1);
    else if (input.throttle < 0) {
      if (car.speed > 0.6) car.speed -= 30 * dt;              // brake
      else car.speed = Math.max(car.speed - spec.accel * 0.55 * dt, -11); // reverse
    } else {
      car.speed -= car.speed * 0.35 * dt;                     // engine drag
      if (Math.abs(car.speed) < 0.04) car.speed = 0;
    }
    if (input.brake) car.speed -= car.speed * 2.4 * dt;
    car.speed = V.clamp(car.speed, -12, spec.top * (car.health < 25 ? 0.55 : 1));
    var steerTarget = input.steer * 0.55;
    car.steer += V.clamp(steerTarget - car.steer, -3.2 * dt, 3.2 * dt);
    var speedRatio = V.clamp(Math.abs(car.speed) / 12, 0, 1);
    var yawRate = car.steer * speedRatio * (input.handbrake ? 1.9 : 1.15);
    if (car.speed < 0) yawRate = -yawRate;
    car.ry += yawRate * dt * (car.speed >= 0 ? 1 : 1);
    var grip = input.handbrake ? spec.grip * 0.36 : spec.grip;
    // velocity kept partly sideways when drifting: blend heading into motion
    if (car.vx === undefined) { car.vx = 0; car.vz = 0; }
    var fx = Math.sin(car.ry) * car.speed, fz = Math.cos(car.ry) * car.speed;
    var blend = V.clamp(grip * dt, 0, 1);
    car.vx += (fx - car.vx) * blend;
    car.vz += (fz - car.vz) * blend;
    var ox = car.x, oz = car.z;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    var fixed = V.collideCircle(city, car.x, car.z, 1.55);
    if (fixed.x !== car.x || fixed.z !== car.z) {
      var impact = Math.abs(car.speed) * (Math.abs(fixed.x - car.x) + Math.abs(fixed.z - car.z));
      if (Math.abs(car.speed) > 7) damageCar(car, Math.abs(car.speed) * 0.55, ox, oz);
      car.x = fixed.x; car.z = fixed.z;
      car.speed *= 0.45; car.vx *= 0.4; car.vz *= 0.4;
    }
    // car-to-car bumps
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === car || o.dead) continue;
      var d = V.dist2d(car.x, car.z, o.x, o.z);
      if (d < 3.1 && d > 0.001) {
        var push = (3.1 - d) / 2;
        var nx = (o.x - car.x) / d, nz = (o.z - car.z) / d;
        o.x += nx * push; o.z += nz * push;
        car.x -= nx * push * 0.5; car.z -= nz * push * 0.5;
        if (Math.abs(car.speed) > 6) {
          damageCar(o, Math.abs(car.speed) * 0.5, o.x, o.z);
          damageCar(car, Math.abs(car.speed) * 0.3, car.x, car.z);
          if (o.driver === 'traffic' && o.ai) o.ai.panic = 3;
          if (V.onCarCrash) V.onCarCrash(o, Math.abs(car.speed));
        }
        o.speed = Math.max(o.speed, car.speed * 0.4);
      }
    }
    syncMesh(car, dt);
  }

  function damageCar(car, amount, x, z) {
    if (car.dead) return;
    car.health -= amount;
    if (car.health <= 0) {
      car.health = 0;
      car.dead = true;
      car.mesh.traverse(function (m) {
        if (m.material && m.material.color && m !== car.extras.cone) m.material = m.material.clone();
      });
      puffSmoke(x, 1.2, z); puffSmoke(x, 1.2, z); puffSmoke(x, 1.2, z);
    }
  }

  function nearestCar(x, z, maxDist) {
    var best = null, bd = maxDist;
    for (var i = 0; i < cars.length; i++) {
      var d = V.dist2d(x, z, cars[i].x, cars[i].z);
      if (d < bd) { bd = d; best = cars[i]; }
    }
    return best;
  }

  function updateCars(dt, city, playerCar) {
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      if (car === playerCar) continue;
      if (car.driver === 'traffic' && !car.dead) stepTraffic(car, dt, city);
      else if (car.driver === 'police' && car.ai && car.ai.active) { /* law.js steers */ }
      else syncMesh(car, 0);
    }
    updateSmoke(dt);
  }

  V.KINDS = KINDS;
  V.cars = cars;
  V.spawnCar = spawnCar;
  V.initCars = initCars;
  V.spawnTrafficCar = spawnTrafficCar;
  V.stepPlayerCar = stepPlayerCar;
  V.updateCars = updateCars;
  V.damageCar = damageCar;
  V.nearestCar = nearestCar;
  V.puffSmoke = puffSmoke;
  V.carAheadOf = carAhead;
})();
