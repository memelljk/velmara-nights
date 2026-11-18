// avatar.js — Jax Rook on foot: third-person walk/run, orbit camera helpers
window.VN = window.VN || {};
VN.makeHero = function () {
  var mesh = VN.humanoidMesh(0xc89878, 0x24303e, 0x1a1d24);
  var g = new THREE.Group(); g.add(mesh);
  return {
    mesh: g, x: 0, z: 110, y: 0, heading: Math.PI, health: 100, speed: 0, walkPhase: 0,
    update: function (dt, keys) {
      var run = keys['shift'] ? 9.5 : 5.2;
      var f = 0, r = 0;
      if (keys['w'] || keys['arrowup']) f += 1;
      if (keys['s'] || keys['arrowdown']) f -= 1;
      if (keys['d'] || keys['arrowright']) r += 1;
      if (keys['a'] || keys['arrowleft']) r -= 1;
      var yaw = VN.camYaw || 0;
      // camera sits at target + (sin yaw, cos yaw)*dist, so view forward is -(sin,cos)
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      var rx = -fz, rz = fx;
      if (f || r) {
        var wx = fx * f + rx * r, wz = fz * f + rz * r;
        var len = Math.hypot(wx, wz); wx /= len; wz /= len;
        var nx = this.x + wx * run * dt, nz = this.z + wz * run * dt;
        if (!VN.collides(nx, this.z, 0.5)) this.x = nx;
        if (!VN.collides(this.x, nz, 0.5)) this.z = nz;
        this.x = Math.max(-318, Math.min(318, this.x)); this.z = Math.max(-318, Math.min(330, this.z));
        this.heading = Math.atan2(wx, wz);
        this.speed = run; this.walkPhase += dt * 9;
      } else this.speed = 0;
      this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.06, this.z);
      this.mesh.rotation.y = this.heading;
    }
  };
};
VN.makePerson = function (x, z, shirt, pants, skin) {
  var mesh = VN.humanoidMesh(skin == null ? 0xb98a64 : skin, shirt, pants == null ? shirt : pants);
  var g = new THREE.Group(); g.add(mesh); g.position.set(x, 0, z);
  return { mesh: g, x: x, z: z, heading: Math.random() * 6.28, health: 60, state: 'stroll', t: Math.random() * 4, shirt: shirt };
};
