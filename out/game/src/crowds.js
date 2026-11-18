// crowds.js — traffic AI on the road grid + pedestrians who stroll, flee and can be robbed
window.VN = window.VN || {};
VN.spawnTraffic = function (scene, rnd, count) {
  var cars = [];
  for (var i = 0; i < count; i++) {
    var onV = rnd() < 0.5;
    var road = VN.ROADS[Math.floor(rnd() * VN.ROADS.length)];
    var t = -280 + rnd() * 560;
    var lane = rnd() < 0.5 ? -5.5 : 5.5;
    var x = onV ? road + lane : t, z = onV ? t : road + lane;
    var heading = onV ? (lane > 0 ? Math.PI : 0) : (lane > 0 ? -Math.PI / 2 : Math.PI / 2);
    // align heading with travel: cars move along (sin h, cos h)
    if (onV) heading = lane > 0 ? Math.PI : 0; else heading = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    var car = VN.makeCar(Math.floor(rnd() * 5), x, z, heading);
    car.parked = false; car.traffic = true; car.cruise = 9 + rnd() * 7;
    car.axis = onV ? 'z' : 'x'; car.road = road; car.lane = lane;
    scene.add(car.mesh); cars.push(car);
  }
  return cars;
};
VN.spawnParked = function (scene, rnd, count) {
  var cars = [];
  var spots = [[16, 128], [-14, 60], [26, -14], [-128, 30], [132, -40], [-40, 132], [90, 246], [-246, -90], [246, 150], [-70, -128], [40, -246], [-160, 246]];
  for (var i = 0; i < count; i++) {
    var s = spots[i % spots.length];
    var car = VN.makeCar(i % 5, s[0] + (i > 11 ? 8 : 0), s[1], (i % 4) * Math.PI / 2);
    car.parked = true; scene.add(car.mesh); cars.push(car);
  }
  return cars;
};
VN.updateTraffic = function (cars, dt, heroPos, gunfire) {
  cars.forEach(function (car) {
    if (!car.traffic || car.driver === 'player') return;
    var ahead = { x: car.x + Math.sin(car.heading) * 9, z: car.z + Math.cos(car.heading) * 9 };
    var blocked = VN.collides(ahead.x, ahead.z, 1) || cars.some(function (o) { return o !== car && Math.abs(o.x - ahead.x) < 3.4 && Math.abs(o.z - ahead.z) < 3.4; });
    var fleeing = gunfire && Math.hypot(car.x - heroPos.x, car.z - heroPos.z) < 42;
    var target = blocked ? 0 : (fleeing ? 24 : car.cruise);
    car.speed += (target - car.speed) * Math.min(1, dt * (blocked ? 6 : 1.4));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (car.x > 330) car.x = -330; if (car.x < -330) car.x = 330;
    if (car.z > 340) car.z = -320; if (car.z < -330) car.z = 330;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.heading;
  });
};
VN.spawnPeds = function (scene, rnd, count) {
  var shirts = [0xd84f6a, 0x3fa7d8, 0xd8a53f, 0x51d88a, 0xb78bff, 0xe8e2d4, 0x3fd8c8];
  var peds = [];
  var zones = [[-180, -45], [30, 150], [-60, -200], [180, 90], [60, 60], [-230, 120]];
  for (var i = 0; i < count; i++) {
    var zn = zones[i % zones.length];
    var p = VN.makePerson(zn[0] + (rnd() - 0.5) * 46, zn[1] + (rnd() - 0.5) * 46, shirts[i % shirts.length], 0x232830, 0xb98a64);
    scene.add(p.mesh); peds.push(p);
  }
  return peds;
};
VN.updatePeds = function (peds, dt, heroPos, gunfire, aiming) {
  peds.forEach(function (p) {
    if (p.health <= 0) { p.mesh.rotation.x = Math.PI / 2; p.mesh.position.y = 0.2; return; }
    p.t -= dt;
    var dx = p.x - heroPos.x, dz = p.z - heroPos.z, dist = Math.hypot(dx, dz);
    if (gunfire && dist < 30) p.state = 'flee';
    else if (aiming && dist < 9) p.state = 'robbed';
    else if (p.t <= 0) { p.state = 'stroll'; p.heading = Math.random() * 6.28; p.t = 2 + Math.random() * 4; }
    var sp = p.state === 'flee' ? 7 : p.state === 'robbed' ? 0 : 1.6;
    if (p.state === 'flee') { p.heading = Math.atan2(dx, dz); }
    if (sp > 0) {
      var nx = p.x + Math.sin(p.heading) * sp * dt, nz = p.z + Math.cos(p.heading) * sp * dt;
      if (!VN.collides(nx, nz, 0.4)) { p.x = nx; p.z = nz; }
      else p.heading += 2.2 * dt;
    }
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.heading;
  });
};
