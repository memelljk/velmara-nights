// drive.js — arcade cars: player driving, handbrake drift, damage & smoke; traffic car factory
window.VN = window.VN || {};
VN.CAR_MODELS = [
  { name: 'Orphee GT', color: 0xff4fa0, top: 46, accel: 17 },
  { name: 'Velmara Coupe', color: 0x37b6ff, top: 40, accel: 15 },
  { name: 'Dockmaster Pickup', color: 0xd8a53f, top: 34, accel: 12, pickup: true },
  { name: 'City Sedan', color: 0x8f9aa6, top: 36, accel: 13 },
  { name: 'Street Hatch', color: 0x51d88a, top: 33, accel: 12 }
];
VN.makeCar = function (modelIdx, x, z, heading, colorOverride) {
  var m = VN.CAR_MODELS[modelIdx % VN.CAR_MODELS.length];
  var group = VN.carMeshes(colorOverride == null ? m.color : colorOverride, { pickup: !!m.pickup });
  group.position.set(x, 0, z); group.rotation.y = heading || 0;
  // smoke emitter points start BELOW ground (proven fix) so nothing piles at origin
  var smokeGeo = new THREE.BufferGeometry();
  var sp = new Float32Array(24 * 3);
  for (var i = 0; i < 24; i++) { sp[i * 3] = 0; sp[i * 3 + 1] = -50; sp[i * 3 + 2] = 0; }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  var smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 1.1, transparent: true, opacity: 0.5 }));
  smoke.visible = false; group.add(smoke);
  return {
    mesh: group, smoke: smoke, model: m, x: x, z: z, heading: heading || 0,
    speed: 0, steer: 0, health: 100, parked: true, driver: null, police: false,
    updateDrive: function (dt, keys) {
      var accel = 0;
      if (keys['w'] || keys['arrowup']) accel = this.model.accel;
      if (keys['s'] || keys['arrowdown']) accel = this.speed > 0.5 ? -22 : -8;
      this.speed += accel * dt;
      var drag = keys[' '] ? 1.6 : 0.35;
      this.speed -= this.speed * drag * dt;
      var top = (keys['s'] || keys['arrowdown']) ? -14 : this.model.top;
      this.speed = Math.max(-14, Math.min(top, this.speed));
      var steerIn = 0;
      if (keys['a'] || keys['arrowleft']) steerIn = 1;
      if (keys['d'] || keys['arrowright']) steerIn = -1;
      var grip = keys[' '] ? 0.45 : 1;
      this.steer += (steerIn * 0.55 - this.steer) * Math.min(1, dt * 8);
      if (Math.abs(this.speed) > 0.2) this.heading += this.steer * dt * (this.speed / 9) * grip * 1.6;
      var nx = this.x + Math.sin(this.heading) * this.speed * dt;
      var nz = this.z + Math.cos(this.heading) * this.speed * dt;
      if (VN.collides(nx, nz, 1.2)) { if (Math.abs(this.speed) > 12) { this.health -= 12; VN.sound.crash(); } this.speed *= -0.25; }
      else { this.x = nx; this.z = nz; }
      this.x = Math.max(-322, Math.min(322, this.x)); this.z = Math.max(-322, Math.min(335, this.z));
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      this.mesh.rotation.z = -this.steer * Math.min(0.09, Math.abs(this.speed) / 500);
      this.smoke.visible = this.health < 55;
      if (this.smoke.visible) {
        var arr = this.smoke.geometry.attributes.position.array;
        for (var j = 0; j < 24; j++) { arr[j * 3 + 1] += dt * 3; if (arr[j * 3 + 1] > 3) { arr[j * 3] = (Math.random() - 0.5); arr[j * 3 + 1] = 1; arr[j * 3 + 2] = -1.8; } }
        this.smoke.geometry.attributes.position.needsUpdate = true;
      }
      return Math.abs(this.speed);
    }
  };
};
