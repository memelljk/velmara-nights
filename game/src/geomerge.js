// geomerge.js — Velmara Nights static-geometry merging.
// The whole city used to be thousands of little meshes. This module collects
// coloured boxes / planes into a handful of big BufferGeometries so the frame
// stays near ~350 draw calls even with 200+ buildings and 600+ streetlights.
window.VN = window.VN || {};

VN.merge = (function () {
  'use strict';

  // A BoxCollector gathers transformed, coloured boxes and bakes them into a
  // single geometry. Vertex colours carry the palette, so one Lambert
  // material serves every merged mesh.
  function BoxCollector() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
  }
  var FACES = [
    // [normal, four corner offsets (x,y,z in -1..1 space, wound outward)]
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
    [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]
  ];
  BoxCollector.prototype.add = function (cx, cy, cz, sx, sy, sz, ry, color, shade) {
    var r = (color >> 16 & 255) / 255, g = (color >> 8 & 255) / 255, b = (color & 255) / 255;
    var cos = Math.cos(ry || 0), sin = Math.sin(ry || 0);
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var base = this.count * 24;
    for (var f = 0; f < 6; f++) {
      var n = FACES[f][0], corners = FACES[f][1];
      var s = shade ? shade[f] : 1;
      // rotate normal
      var nx = n[0] * cos + n[2] * sin, nz = -n[0] * sin + n[2] * cos;
      for (var i = 0; i < 4; i++) {
        var lx = corners[i][0] * hx, ly = corners[i][1] * hy, lz = corners[i][2] * hz;
        var wx = lx * cos + lz * sin, wz = -lx * sin + lz * cos;
        this.pos.push(cx + wx, cy + ly, cz + wz);
        this.nor.push(nx, n[1], nz);
        this.col.push(r * s, g * s, b * s);
      }
      var o = base + f * 4;
      this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    this.count++;
    return this;
  };
  BoxCollector.prototype.build = function (material) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    var mat = material || new THREE.MeshLambertMaterial({ vertexColors: true });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    return mesh;
  };

  // Per-face shading so merged boxes still read as 3D in flat light.
  var SHADE = [0.92, 0.78, 0.84, 0.7, 1.0, 0.55];
  function shaded(collector, cx, cy, cz, sx, sy, sz, ry, color) {
    return collector.add(cx, cy, cz, sx, sy, sz, ry, color, SHADE);
  }

  // Merge an array of ready THREE geometries (already transformed) that share
  // one material — used for cylinders (wheels are dynamic, but crane cables,
  // lamp heads and pier posts are baked this way via manual geometry lists).
  function mergeGeometries(geos) {
    var pos = [], nor = [], idx = [], off = 0;
    for (var i = 0; i < geos.length; i++) {
      var g = geos[i];
      var p = g.getAttribute('position'), n = g.getAttribute('normal');
      for (var v = 0; v < p.count; v++) {
        pos.push(p.getX(v), p.getY(v), p.getZ(v));
        nor.push(n.getX(v), n.getY(v), n.getZ(v));
      }
      var index = g.getIndex();
      if (index) {
        for (var k = 0; k < index.count; k++) idx.push(index.getX(k) + off);
      } else {
        for (var k2 = 0; k2 < p.count; k2++) idx.push(k2 + off);
      }
      off += p.count;
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setIndex(idx);
    return out;
  }

  return { BoxCollector: BoxCollector, shaded: shaded, mergeGeometries: mergeGeometries };
})();
