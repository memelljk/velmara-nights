// geomerge.js — static-geometry batching for Velmara Nights.
// The whole city is baked into a handful of vertex-coloured meshes so the
// renderer stays near a hundred draw calls instead of thousands. A Batch
// collects transformed primitives, stamps one flat colour per vertex, and
// builds a single BufferGeometry at the end.
window.VN = window.VN || {};

VN.GeoBatch = class GeoBatch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.vertCount = 0;
    this._color = new THREE.Color(0xffffff);
    this._m = new THREE.Matrix4();
    this._nm = new THREE.Matrix3();
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
  }

  // Append any BufferGeometry, transformed by `matrix`, tinted `color`.
  addGeo(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    this._color.set(color);
    this._nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      this._v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this._n.fromBufferAttribute(n, i).applyMatrix3(this._nm).normalize();
      this.pos.push(this._v.x, this._v.y, this._v.z);
      this.nor.push(this._n.x, this._n.y, this._n.z);
      this.col.push(this._color.r, this._color.g, this._color.b);
    }
    for (let i = 0; i < p.count; i++) this.idx.push(this.vertCount + i);
    this.vertCount += p.count;
    if (g !== geo) g.dispose();
    return this;
  }

  matrix(x, y, z, ry, sx, sy, sz) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
    return m;
  }

  box(w, h, d, x, y, z, color, ry) {
    const geo = new THREE.BoxGeometry(w, h, d);
    this.addGeo(geo, this.matrix(x, y, z, ry || 0), color);
    geo.dispose();
    return this;
  }

  // A box that can also lean (roof props, crane arms, ramps).
  boxEuler(w, h, d, x, y, z, color, euler) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(euler || new THREE.Euler(0, 0, 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    const geo = new THREE.BoxGeometry(w, h, d);
    this.addGeo(geo, m, color);
    geo.dispose();
    return this;
  }

  cyl(rt, rb, h, seg, x, y, z, color) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg || 7);
    this.addGeo(geo, this.matrix(x, y, z, 0), color);
    geo.dispose();
    return this;
  }

  cone(r, h, seg, x, y, z, color) {
    const geo = new THREE.ConeGeometry(r, h, seg || 8);
    this.addGeo(geo, this.matrix(x, y, z, 0), color);
    geo.dispose();
    return this;
  }

  sphere(r, x, y, z, color) {
    const geo = new THREE.SphereGeometry(r, 8, 6);
    this.addGeo(geo, this.matrix(x, y, z, 0), color);
    geo.dispose();
    return this;
  }

  // Flat quad facing +Z before rotation (windows, markings, glow cards).
  quad(w, h, x, y, z, color, ry) {
    const geo = new THREE.PlaneGeometry(w, h);
    this.addGeo(geo, this.matrix(x, y, z, ry || 0), color);
    geo.dispose();
    return this;
  }

  build(material, shadows) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    if (shadows) { mesh.castShadow = false; mesh.receiveShadow = false; }
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
};

// Materials shared by every batch.
VN.MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  basic: new THREE.MeshBasicMaterial({ vertexColors: true }),
  flat: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x222233 }),
};

// Deterministic PRNG (mulberry32) — the whole city hangs off this stream.
VN.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

VN.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
VN.lerp = (a, b, t) => a + (b - a) * t;
VN.dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// Shortest signed angular difference a-b wrapped to [-PI, PI].
VN.angDiff = function (a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
