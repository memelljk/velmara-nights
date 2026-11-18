// geomerge.js — static geometry batching for Velmara Nights.
// The whole city (buildings, lamp posts, stalls, containers, cranes) is baked
// into a few merged BufferGeometries so the frame costs a few hundred draw
// calls instead of a few thousand. A Builder collects transformed copies of
// simple geometries, stamps each vertex with a flat colour and an optional
// window into a texture atlas, and bakes everything into one mesh.
window.V = window.V || {};
(function () {
  'use strict';

  function Builder() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.vertexCount = 0;
  }

  // add(geometry, matrix, colourHex, uvRect)
  // uvRect is [u0, v0, u1, v1] in atlas space, or null to keep the raw UVs.
  Builder.prototype.add = function (geometry, matrix, colourHex, uvRect) {
    var geo = geometry.index ? geometry.toNonIndexed() : geometry;
    var pos = geo.attributes.position;
    var nor = geo.attributes.normal;
    var uv = geo.attributes.uv;
    var normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    var v = new THREE.Vector3();
    var n = new THREE.Vector3();
    var c = new THREE.Color(colourHex);
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      this.positions.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      this.normals.push(n.x, n.y, n.z);
      this.colors.push(c.r, c.g, c.b);
      var u = uv ? uv.getX(i) : 0;
      var w = uv ? uv.getY(i) : 0;
      if (uvRect) {
        u = uvRect[0] + u * (uvRect[2] - uvRect[0]);
        w = uvRect[1] + w * (uvRect[3] - uvRect[1]);
      }
      this.uvs.push(u, w);
    }
    this.vertexCount += pos.count;
    if (geo !== geometry) geo.dispose();
    return this;
  };

  // Convenience: an axis-aligned (optionally yawed) box centred at x,z.
  Builder.prototype.box = function (w, h, d, x, y, z, ry, colourHex, uvRect) {
    var m = new THREE.Matrix4().makeRotationY(ry || 0);
    m.setPosition(x, y, z);
    return this.add(new THREE.BoxGeometry(w, h, d), m, colourHex, uvRect || null);
  };

  // Convenience: a flat plane (rotated by euler angles) for signs and decks.
  Builder.prototype.plane = function (w, h, x, y, z, rx, ry, colourHex, uvRect) {
    var e = new THREE.Euler(rx || 0, ry || 0, 0);
    var m = new THREE.Matrix4().makeRotationFromEuler(e);
    m.setPosition(x, y, z);
    return this.add(new THREE.PlaneGeometry(w, h), m, colourHex, uvRect || null);
  };

  Builder.prototype.build = function (material) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    var mesh = new THREE.Mesh(g, material);
    mesh.matrixAutoUpdate = false;
    return mesh;
  };

  V.Builder = Builder;

  // mulberry32: tiny deterministic PRNG so a seed rebuilds the same city.
  V.makeRng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  V.clamp = function (x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };
  V.lerp = function (a, b, t) { return a + (b - a) * t; };
  V.dist2d = function (ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  // Shortest signed angle from a to b, in radians.
  V.angleDelta = function (a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
})();
