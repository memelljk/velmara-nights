// geomerge.js — merge many coloured boxes / planes into single meshes (low draw calls)
window.VN = window.VN || {};
VN.mergeBoxes = function (list, opts) {
  opts = opts || {};
  var pos = [], nor = [], col = [], idx = [];
  var c = new THREE.Color();
  list.forEach(function (b) {
    var base = pos.length / 3;
    var w = b.w / 2, h = b.h / 2, d = b.d / 2;
    c.set(b.color == null ? 0x888888 : b.color);
    if (b.tint) { c.offsetHSL(0, 0, b.tint); }
    var rot = b.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    // 6 faces, each 4 verts
    var faces = [
      { n: [0, 1, 0], v: [[-w, h, -d], [w, h, -d], [w, h, d], [-w, h, d]] },
      { n: [0, -1, 0], v: [[-w, -h, d], [w, -h, d], [w, -h, -d], [-w, -h, -d]] },
      { n: [0, 0, 1], v: [[-w, -h, d], [-w, h, d], [w, h, d], [w, -h, d]] },
      { n: [0, 0, -1], v: [[w, -h, -d], [w, h, -d], [-w, h, -d], [-w, -h, -d]] },
      { n: [1, 0, 0], v: [[w, -h, d], [w, h, d], [w, h, -d], [w, -h, -d]] },
      { n: [-1, 0, 0], v: [[-w, -h, -d], [-w, h, -d], [-w, h, d], [-w, -h, d]] }
    ];
    faces.forEach(function (f) {
      var s = opts.shade == null ? 1 : opts.shade;
      var shade = 0.72 + 0.28 * Math.abs(f.n[1]) + (f.n[2] > 0 ? 0.08 : 0);
      f.v.forEach(function (v) {
        var x = v[0] * cs - v[2] * sn, z = v[0] * sn + v[2] * cs;
        pos.push(x + b.x, v[1] + b.y, z + b.z);
        nor.push(f.n[0] * cs - f.n[2] * sn, f.n[1], f.n[0] * sn + f.n[2] * cs);
        col.push(c.r * shade * s, c.g * shade * s, c.b * shade * s);
      });
      var n = pos.length / 3 - 4;
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    });
    void base;
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  var mat = opts.material || new THREE.MeshLambertMaterial({ vertexColors: true });
  var mesh = new THREE.Mesh(g, mat);
  mesh.matrixAutoUpdate = false;
  return mesh;
};
VN.mergePlanes = function (list, mat) {
  // list: {w,h,x,y,z,rotY,color} vertical planes facing +z rotated by rotY
  var pos = [], col = [], idx = [];
  var c = new THREE.Color();
  list.forEach(function (p) {
    c.set(p.color == null ? 0xffffff : p.color);
    var w = p.w / 2, h = p.h / 2, cs = Math.cos(p.rotY || 0), sn = Math.sin(p.rotY || 0);
    [[-w, -h], [w, -h], [w, h], [-w, h]].forEach(function (v) {
      pos.push(v[0] * cs + p.x, v[1] + p.y, v[0] * sn + p.z);
      col.push(c.r, c.g, c.b);
    });
    var n = pos.length / 3 - 4;
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2, n); // double-sided look
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, mat || new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.matrixAutoUpdate = false;
  return mesh;
};
VN.humanoidMesh = function (skin, shirt, pants) {
  // ONE merged mesh: legs (pants colour always defined), torso, head, arms
  pants = (pants == null ? shirt : pants); // fix: never undefined colour
  var parts = [
    { w: 0.26, h: 0.78, d: 0.26, x: -0.16, y: 0.39, z: 0, color: pants },
    { w: 0.26, h: 0.78, d: 0.26, x: 0.16, y: 0.39, z: 0, color: pants },
    { w: 0.62, h: 0.72, d: 0.34, x: 0, y: 1.14, z: 0, color: shirt },
    { w: 0.34, h: 0.36, d: 0.34, x: 0, y: 1.68, z: 0, color: skin },
    { w: 0.36, h: 0.1, d: 0.36, x: 0, y: 1.9, z: 0, color: 0x14100e },
    { w: 0.16, h: 0.62, d: 0.16, x: -0.4, y: 1.12, z: 0, color: shirt },
    { w: 0.16, h: 0.62, d: 0.16, x: 0.4, y: 1.12, z: 0, color: shirt }
  ];
  return VN.mergeBoxes(parts, {});
};
VN.carMeshes = function (bodyColor, opts) {
  opts = opts || {};
  var group = new THREE.Group();
  var lower = opts.pickup ? 1.05 : 0.62;
  var parts = [
    { w: 1.8, h: lower, d: 4.3, x: 0, y: 0.55, z: 0, color: bodyColor },
    { w: 1.6, h: 0.55, d: 2.1, x: 0, y: 1.05, z: opts.pickup ? -0.7 : -0.2, color: bodyColor },
    { w: 1.62, h: 0.4, d: 1.9, x: 0, y: 1.08, z: opts.pickup ? -0.7 : -0.2, color: 0x101820 },
    { w: 0.34, h: 0.62, d: 0.62, x: -0.82, y: 0.32, z: 1.35, color: 0x0a0a0a },
    { w: 0.34, h: 0.62, d: 0.62, x: 0.82, y: 0.32, z: 1.35, color: 0x0a0a0a },
    { w: 0.34, h: 0.62, d: 0.62, x: -0.82, y: 0.32, z: -1.35, color: 0x0a0a0a },
    { w: 0.34, h: 0.62, d: 0.62, x: 0.82, y: 0.32, z: -1.35, color: 0x0a0a0a }
  ];
  if (opts.pickup) parts.push({ w: 1.8, h: 0.5, d: 1.7, x: 0, y: 0.95, z: 1.25, color: 0x2a2f36 });
  if (opts.police) parts.push({ w: 1.2, h: 0.22, d: 0.5, x: 0, y: 1.42, z: -0.2, color: 0x222222 });
  var body = VN.mergeBoxes(parts, {});
  group.add(body);
  var lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  var lamps = [
    { w: 0.36, h: 0.16, d: 0.06, x: -0.55, y: 0.62, z: 2.16, color: 0xfff2b0 },
    { w: 0.36, h: 0.16, d: 0.06, x: 0.55, y: 0.62, z: 2.16, color: 0xfff2b0 },
    { w: 0.36, h: 0.14, d: 0.06, x: -0.55, y: 0.62, z: -2.16, color: 0xff2233 },
    { w: 0.36, h: 0.14, d: 0.06, x: 0.55, y: 0.62, z: -2.16, color: 0xff2233 }
  ];
  if (opts.police) {
    lamps.push({ w: 0.55, h: 0.2, d: 0.46, x: -0.32, y: 1.44, z: -0.2, color: 0xff2244 });
    lamps.push({ w: 0.55, h: 0.2, d: 0.46, x: 0.32, y: 1.44, z: -0.2, color: 0x2266ff });
  }
  var lampMesh = VN.mergeBoxes(lamps, { material: lampMat });
  group.add(lampMesh);
  // headlight cones: faint, fog-free, front side only (proven fix)
  var coneMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.04, fog: false, side: THREE.FrontSide, depthWrite: false });
  [-0.55, 0.55].forEach(function (lx) {
    var cone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 7, 10, 1, true), coneMat);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(lx, 0.6, 5.6);
    group.add(cone);
  });
  group.userData.body = body; group.userData.lamps = lampMesh;
  return group;
};
