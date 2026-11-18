// law.js — wanted stars, heat decay, police interceptors that chase & ram, foot officers, BUSTED meter
window.VN = window.VN || {};
VN.law = {
  wanted: 0, heat: 0, bust: 0, officers: [], cars: [],
  reset: function (scene) {
    this.cars.forEach(function (c) { scene.remove(c.mesh); });
    this.officers.forEach(function (o) { scene.remove(o.mesh); });
    this.cars = []; this.officers = []; this.wanted = 0; this.heat = 0; this.bust = 0;
  },
  reportCrime: function (amount, scene, targetPos) {
    this.heat = Math.min(100, this.heat + amount);
    var stars = this.heat > 0 ? Math.min(5, Math.ceil(this.heat / 20)) : 0;
    if (stars > this.wanted) this.wanted = stars;
    if (this.wanted > 0 && this.cars.length === 0) this.spawnWave(scene, targetPos);
  },
  spawnWave: function (scene, targetPos) {
    var n = Math.max(1, this.wanted);
    for (var i = 0; i < n && this.cars.length < 5; i++) {
      var a = (i / Math.max(1, n)) * 6.28 + 0.7;
      var x = targetPos.x + Math.sin(a) * 46, z = targetPos.z + Math.cos(a) * 46;
      var car = VN.makeCar(1, x, z, Math.atan2(targetPos.x - x, targetPos.z - z), 0xe8ecf2);
      // police livery: rebuild as police meshes
      scene.remove(car.mesh);
      car.mesh = VN.carMeshes(0xe8ecf2, { police: true });
      car.mesh.position.set(x, 0, z);
      car.police = true; car.parked = false; car.cruise = 30;
      car.model = { name: 'Interceptor', top: 44, accel: 16 };
      scene.add(car.mesh); this.cars.push(car);
    }
    if (this.wanted >= 3) {
      for (var j = 0; j < 2 && this.officers.length < 4; j++) {
        var o = VN.makePerson(targetPos.x + 14 + j * 5, targetPos.z + 18, 0x1c2f57, 0x141c30, 0xa87858);
        scene.add(o.mesh); this.officers.push(o);
      }
    }
  },
  update: function (dt, scene, target, heroHidden, onBusted) {
    if (this.wanted > 0 && !heroHidden) this.heat = Math.min(100, this.heat + dt * 1.2);
    if (heroHidden) { this.heat -= dt * 9; if (this.heat <= 0) { this.heat = 0; this.wanted = 0; } }
    if (this.wanted > 0) this.wanted = Math.max(1, Math.min(5, Math.ceil(this.heat / 20)));
    var self = this;
    var nearCop = false;
    this.cars.forEach(function (car) {
      var dx = target.x - car.x, dz = target.z - car.z, dist = Math.hypot(dx, dz);
      var want = Math.atan2(dx, dz);
      var diff = ((want - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      car.heading += Math.max(-1.7 * dt, Math.min(1.7 * dt, diff));
      var sp = dist > 60 ? 40 : dist > 12 ? 30 : 15;
      car.speed += (sp - car.speed) * Math.min(1, dt * 1.6);
      var nx = car.x + Math.sin(car.heading) * car.speed * dt, nz = car.z + Math.cos(car.heading) * car.speed * dt;
      if (!VN.collides(nx, nz, 1.1)) { car.x = nx; car.z = nz; } else car.speed *= 0.4;
      car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.heading;
      if (dist < 7) nearCop = true;
      if (dist < 3.4 && Math.abs(target.speed || 0) < 3) self.bust += dt * 34;
    });
    this.officers.forEach(function (o) {
      var dx = target.x - o.x, dz = target.z - o.z, dist = Math.hypot(dx, dz);
      if (dist > 3) { o.x += (dx / dist) * 4.4 * dt; o.z += (dz / dist) * 4.4 * dt; o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = Math.atan2(dx, dz); }
      if (dist < 4 && Math.abs(target.speed || 0) < 3) self.bust += dt * 30;
      if (dist < 5) nearCop = true;
    });
    if (!nearCop || Math.abs(target.speed || 0) >= 3) this.bust = Math.max(0, this.bust - dt * 26);
    if (this.bust >= 100) { this.bust = 0; onBusted && onBusted(); }
    if (this.wanted > 0 && this.cars.length < Math.min(5, this.wanted + 1) && Math.random() < dt * 0.25) this.spawnWave(scene, target);
    VN.sound && this.cars.length && Math.random() < dt * 0.7 && VN.sound.siren();
  }
};
