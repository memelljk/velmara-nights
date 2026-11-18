// citygen.js — Velmara: a rain-soaked neon port city, generated from a seed.
// Five districts on a regular road grid, ~210 buildings with lit windows,
// ~648 streetlights, a working harbor (water, piers, cranes, container yards),
// Old Market stalls and a plaza. All static geometry is merged into a few
// dozen meshes; dynamic things (cars, people) live in their own modules.
window.VN = window.VN || {};

VN.city = (function () {
  'use strict';

  // mulberry32 — small, fast, deterministic.
  function RNG(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var GRID = 48;              // road spacing
  var HALF = 4;               // roads at -192..192 (9 avenues each way)
  var ROAD_W = 13;            // asphalt width
  var CITY_EDGE = 216;

  function roadCoord(i) { return (i - HALF) * GRID; }
  function isRoad(v) {
    var m = ((v % GRID) + GRID) % GRID;
    return m < ROAD_W / 2 + 1.5 || m > GRID - ROAD_W / 2 - 1.5;
  }
  function districtAt(x, z) {
    if (z > 118) return 'Harbor';
    if (x > 108 && z > 20) return 'Dockyards';
    if (x < -104 && z < -56) return 'The Heights';
    if (x > -104 && x < 60 && z > -118 && z < 24 && Math.abs(x + 20) < 90 && z > -60) return 'Old Market';
    if (Math.abs(x) < 120 && z <= 24 && z >= -118) return 'Neon Mile';
    if (z < -118) return 'The Heights';
    return 'Neon Mile';
  }

  var PALETTES = {
    'Neon Mile':   [0x3b2d5c, 0x27355e, 0x4a2440, 0x1f3a4d, 0x503a24],
    'Harbor':      [0x24404d, 0x2c3844, 0x3d3428, 0x1d3038],
    'Old Market':  [0x4d3421, 0x59392a, 0x3a2c4d, 0x2e4034],
    'The Heights': [0x2a2f3d, 0x353a2c, 0x402f38, 0x27333d],
    'Dockyards':   [0x33302a, 0x2b3644, 0x40342a, 0x2e2e38]
  };
  var NEON = [0xff2e88, 0x00e5ff, 0xffa726, 0x7c4dff, 0x69f0ae, 0xff5252, 0x40c4ff, 0xff4081];
  var SIGNS = ['VELMARA', 'NOODLE 9', 'HOTEL LUMEN', 'KTV STAR', 'ORPHEE MOTORS', 'TATTOO',
    'PAWN & CO', 'BAR DELFIN', 'CASINO RIALTO', 'RAMEN', 'CLUB VESPER', 'FISH MARKET',
    'HOTEL MIRELLA', 'GYM ATLAS', 'LIQUOR', 'PIER 9 DINER', 'SAUNA', 'DISCO NAUTILUS'];

  function signTexture(text, colorCss) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(8,6,16,0.92)';
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = colorCss; g.lineWidth = 3;
    g.strokeRect(3, 3, 250, 58);
    g.font = 'bold 30px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = colorCss; g.shadowBlur = 14;
    g.fillStyle = colorCss;
    g.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }
  function windowTexture(rng, base) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 64, 128);
    for (var y = 6; y < 120; y += 10) {
      for (var x = 5; x < 58; x += 10) {
        var lit = rng() < 0.42;
        g.fillStyle = lit ? (rng() < 0.8 ? '#ffd98a' : '#9fe8ff') : 'rgba(10,12,20,0.85)';
        g.fillRect(x, y, 6, 7);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }
  function hexCss(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  function build(seed) {
    var rng = RNG(seed * 1000 + 77);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d1d);
    scene.fog = new THREE.FogExp2(0x0d1024, 0.0038);

    var colliders = [];   // {x0,z0,x1,z1} solid footprints
    var lamps = [];       // streetlight head positions
    var parkSpots = [];   // parked-car placements {x,z,ry}
    var signs = [];
    var stats = { buildings: 0, lamps: 0 };

    // ---- lights -------------------------------------------------------
    scene.add(new THREE.AmbientLight(0x35406e, 0.85));
    var moon = new THREE.DirectionalLight(0x8fb4ff, 0.5);
    moon.position.set(-120, 220, -80);
    scene.add(moon);
    var glow = new THREE.PointLight(0xff2e88, 0.55, 260);
    glow.position.set(0, 40, -48);
    scene.add(glow);

    // ---- ground: plazas / sidewalks base ------------------------------
    var groundGeo = new THREE.PlaneGeometry(CITY_EDGE * 2 + 160, CITY_EDGE * 2 + 160);
    var ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x232733 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    var boxes = new VN.merge.BoxCollector();
    var dark = new VN.merge.BoxCollector();   // asphalt & water-side darks
    var bright = new VN.merge.BoxCollector(); // emissive-look trim (lamp heads etc.)

    // Roads: asphalt strips along every grid line, both directions.
    var ri, rj;
    for (ri = 0; ri <= HALF * 2; ri++) {
      var rc = roadCoord(ri);
      dark.add(rc, 0.01, 0, ROAD_W, 0.06, CITY_EDGE * 2, 0, 0x14151f);
      dark.add(0, 0.01, rc, CITY_EDGE * 2, 0.06, ROAD_W, 0, 0x14151f);
      // centre dashes
      for (var d = -CITY_EDGE + 8; d < CITY_EDGE; d += 12) {
        bright.add(rc, 0.06, d, 0.35, 0.02, 4.5, 0, 0x8a8f6a);
        bright.add(d, 0.06, rc, 4.5, 0.02, 0.35, 0, 0x8a8f6a);
      }
    }
    // Sidewalk rims
    for (ri = 0; ri <= HALF * 2; ri++) {
      var sc = roadCoord(ri);
      boxes.add(sc - ROAD_W / 2 - 1.6, 0.09, 0, 3.2, 0.18, CITY_EDGE * 2, 0, 0x2e3242);
      boxes.add(sc + ROAD_W / 2 + 1.6, 0.09, 0, 3.2, 0.18, CITY_EDGE * 2, 0, 0x2e3242);
      boxes.add(0, 0.09, sc - ROAD_W / 2 - 1.6, CITY_EDGE * 2, 0.18, 3.2, 0, 0x2e3242);
      boxes.add(0, 0.09, sc + ROAD_W / 2 + 1.6, CITY_EDGE * 2, 0.18, 3.2, 0, 0x2e3242);
    }

    // ---- streetlights: poles merged, heads merged emissive ------------
    for (ri = 0; ri <= HALF * 2; ri++) {
      var lc = roadCoord(ri);
      for (var s = -CITY_EDGE + 12; s < CITY_EDGE; s += 16) {
        if (Math.abs(s - Math.round(s / GRID) * GRID) < 10) continue; // skip junctions
        // both kerbs, both orientations: a lamp every 16 m on every street
        for (var sd = 0; sd < 2; sd++) {
          var side = sd === 0 ? 1 : -1;
          var lx = lc + side * (ROAD_W / 2 + 1.2), lz = s;
          boxes.add(lx, 2.6, lz, 0.28, 5.2, 0.28, 0, 0x1c1f2a);
          bright.add(lx - side * 0.9, 5.15, lz, 1.9, 0.22, 0.5, 0, 0xffd9a0);
          lamps.push({ x: lx - side * 0.9, z: lz });
          var lx2 = s, lz2 = lc + side * (ROAD_W / 2 + 1.2);
          boxes.add(lx2, 2.6, lz2, 0.28, 5.2, 0.28, 0, 0x1c1f2a);
          bright.add(lx2, 5.15, lz2 - side * 0.9, 0.5, 0.22, 1.9, 0, 0xffd9a0);
          lamps.push({ x: lx2, z: lz2 - side * 0.9 });
          stats.lamps += 2;
        }
      }
    }

    // ---- buildings ------------------------------------------------------
    var winMats = [];
    var winTexByBase = {};
    function winMat(baseCss) {
      if (!winTexByBase[baseCss]) {
        var tex = windowTexture(rng, baseCss);
        winTexByBase[baseCss] = new THREE.MeshLambertMaterial({ map: tex });
        winMats.push(winTexByBase[baseCss]);
      }
      return winTexByBase[baseCss];
    }
    var buildingMeshes = [];
    var signMats = {};
    function addBuilding(cx, cz, w, d, h, district) {
      var palette = PALETTES[district] || PALETTES['Neon Mile'];
      var color = palette[(rng() * palette.length) | 0];
      var mat = winMat(hexCss(color));
      var geo = new THREE.BoxGeometry(w, h, d);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, h / 2, cz);
      buildingMeshes.push(mesh);
      // roof cap + water tank sometimes
      VN.merge.shaded(boxes, cx, h + 0.4, cz, w + 0.6, 0.8, d + 0.6, 0, 0x191c28);
      if (rng() < 0.3) VN.merge.shaded(boxes, cx + w * 0.25, h + 1.8, cz, 2.2, 2.2, 2.2, 0, 0x2c2f3a);
      // neon trim on Neon Mile towers
      if (district === 'Neon Mile' && rng() < 0.6) {
        var nc = NEON[(rng() * NEON.length) | 0];
        bright.add(cx, h * (0.55 + rng() * 0.3), cz + d / 2 + 0.15, w * 0.8, 0.5, 0.3, 0, nc);
      }
      // ground-floor sign facing a road
      if (rng() < 0.5) {
        var txt = SIGNS[(rng() * SIGNS.length) | 0];
        var col = NEON[(rng() * NEON.length) | 0];
        var key = txt + col;
        if (!signMats[key]) signMats[key] = new THREE.MeshBasicMaterial({ map: signTexture(txt, hexCss(col)) });
        var sp = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.85, 13), 3.2), signMats[key]);
        var face = (rng() * 4) | 0;
        var off = (face < 2 ? d : w) / 2 + 0.12;
        sp.position.set(cx + (face === 2 ? off : face === 3 ? -off : 0), 3.4, cz + (face === 0 ? off : face === 1 ? -off : 0));
        sp.rotation.y = face === 0 ? 0 : face === 1 ? Math.PI : face === 2 ? Math.PI / 2 : -Math.PI / 2;
        signs.push(sp);
        scene.add(sp);
      }
      colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
      stats.buildings++;
    }

    for (var bx = 0; bx < HALF * 2; bx++) {
      for (var bz = 0; bz < HALF * 2; bz++) {
        var cx0 = roadCoord(bx) + GRID / 2, cz0 = roadCoord(bz) + GRID / 2;
        var district = districtAt(cx0, cz0);
        if (district === 'Harbor' && cz0 > 140) continue;       // open water blocks
        if (bx === 3 && bz === 4) continue;                      // Old Market plaza
        if (bx === 4 && bz === 4) continue;                      // Neon Mile plaza / Odile corner
        var per = district === 'The Heights' ? 3 : 4;
        for (var k = 0; k < per; k++) {
          var ox = (k % 2 === 0 ? -1 : 1) * (8 + rng() * 3);
          var oz = (k < 2 ? -1 : 1) * (8 + rng() * 3);
          var w = 11 + rng() * 6, d = 11 + rng() * 6;
          var tall = district === 'Neon Mile' ? 26 + rng() * 30 : district === 'The Heights' ? 14 + rng() * 16 : 9 + rng() * 13;
          addBuilding(cx0 + ox, cz0 + oz, w, d, tall, district);
        }
        // an annex block fills most block centres: ~220 buildings in all
        if (rng() < 0.42) {
          addBuilding(cx0 + (rng() - 0.5) * 4, cz0 + (rng() - 0.5) * 4, 8 + rng() * 3, 8 + rng() * 3, 6 + rng() * 7, district);
        }
        // parked cars along block edges
        if (rng() < 0.75) {
          var px = cx0 - GRID / 2 + ROAD_W / 2 + 2.6, pz = cz0 + (rng() - 0.5) * 22;
          parkSpots.push({ x: px, z: pz, ry: Math.PI / 2 });
        }
        if (rng() < 0.5) {
          parkSpots.push({ x: cx0 + (rng() - 0.5) * 22, z: cz0 - GRID / 2 + ROAD_W / 2 + 2.6, ry: 0 });
        }
      }
    }
    for (var bm = 0; bm < buildingMeshes.length; bm++) scene.add(buildingMeshes[bm]);

    // ---- Old Market plaza: stalls with striped canopies -----------------
    var plaza = { x: roadCoord(3) + GRID / 2, z: roadCoord(4) + GRID / 2 };
    for (var si = 0; si < 14; si++) {
      var sx = plaza.x - 16 + (si % 5) * 8 + rng() * 1.5;
      var sz = plaza.z - 10 + Math.floor(si / 5) * 9 + rng() * 1.5;
      var cc = NEON[(rng() * NEON.length) | 0];
      VN.merge.shaded(boxes, sx, 1.0, sz, 4.6, 2.0, 3.2, 0, 0x4a3826);
      VN.merge.shaded(bright, sx, 2.45, sz, 5.4, 0.35, 4.0, 0, cc);
      VN.merge.shaded(boxes, sx, 1.65, sz + 0.4, 4.0, 0.5, 0.8, 0, 0xd8c9a3);
      colliders.push({ x0: sx - 2.3, z0: sz - 1.6, x1: sx + 2.3, z1: sz + 1.6 });
    }

    // ---- Harbor: water, piers, cranes, containers, lighthouse -----------
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_EDGE * 2 + 200, 190),
      new THREE.MeshLambertMaterial({ color: 0x0b2f4a, transparent: true, opacity: 0.92 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.12, 252);
    scene.add(water);
    // quay wall
    VN.merge.shaded(boxes, 0, 0.7, 158, CITY_EDGE * 2, 1.6, 5, 0, 0x2b303e);
    for (var pi = 0; pi < 5; pi++) {
      var pierX = -160 + pi * 78;
      VN.merge.shaded(boxes, pierX, 0.55, 196, 10, 1.1, 74, 0, 0x333947);
      for (var pp = 0; pp < 5; pp++) dark.add(pierX - 4, -0.4, 168 + pp * 15, 1.1, 1.2, 1.1, 0, 0x11131c);
      // crane: legs + jib
      VN.merge.shaded(boxes, pierX, 11, 176, 1.4, 22, 1.4, 0, 0xb3541e);
      VN.merge.shaded(boxes, pierX, 22.4, 190, 1.2, 1.6, 34, 0, 0xb3541e);
      VN.merge.shaded(bright, pierX, 18, 200, 0.3, 7, 0.3, 0, 0x8a8f9a);
      VN.merge.shaded(boxes, pierX, 14.4, 203, 3.4, 2.2, 3.4, 0, 0x2456a8);
    }
    // container yards (Dockyards + harbor edge)
    var contCols = [0xa83226, 0x2456a8, 0x2e7d4f, 0xb8860b, 0x6a3fa0, 0x707880];
    for (var ci = 0; ci < 90; ci++) {
      var qx = 120 + rng() * 90, qz = 60 + rng() * 80;
      if (isRoad(qx) || isRoad(qz)) continue;
      var lvl = rng() < 0.35 ? 2 : 1;
      for (var lv = 0; lv < lvl; lv++) {
        VN.merge.shaded(boxes, qx, 1.3 + lv * 2.6, qz, 6.1, 2.6, 2.5, rng() < 0.5 ? 0 : Math.PI / 2, contCols[(rng() * contCols.length) | 0]);
      }
      if (ci % 3 === 0) colliders.push({ x0: qx - 3.1, z0: qz - 1.3, x1: qx + 3.1, z1: qz + 1.3 });
    }
    // lighthouse on the breakwater
    VN.merge.shaded(boxes, 196, 7, 232, 5, 14, 5, 0, 0xd8d3c8);
    VN.merge.shaded(bright, 196, 15.4, 232, 3.4, 2.2, 3.4, 0, 0xffe9a0);
    colliders.push({ x0: 193, z0: 229, x1: 199, z1: 235 });
    // moored boats: hull + cabin
    for (var bi = 0; bi < 6; bi++) {
      var boatX = -140 + bi * 52 + rng() * 10, boatZ = 210 + rng() * 40;
      VN.merge.shaded(boxes, boatX, 0.8, boatZ, 9, 1.6, 3.4, rng() * 0.6 - 0.3, 0x7d2438);
      VN.merge.shaded(boxes, boatX, 2.1, boatZ, 3.6, 1.4, 2.4, 0, 0xd8d3c8);
    }

    // ---- St. Mirella Hospital + Odile's booth (landmarks) ----------------
    var hosp = { x: roadCoord(6) + 14, z: roadCoord(2) + 12 };
    VN.merge.shaded(boxes, hosp.x, 7, hosp.z, 20, 14, 14, 0, 0xcfd4da);
    VN.merge.shaded(bright, hosp.x, 12.5, hosp.z - 7.2, 8, 2.4, 0.3, 0, 0xff3355);
    VN.merge.shaded(bright, hosp.x, 10.4, hosp.z - 7.2, 2.2, 6, 0.3, 0, 0xff3355);
    colliders.push({ x0: hosp.x - 10, z0: hosp.z - 7, x1: hosp.x + 10, z1: hosp.z + 7 });

    var booth = { x: roadCoord(4) + GRID / 2 + 10, z: roadCoord(4) + GRID / 2 - 12 };
    VN.merge.shaded(boxes, booth.x, 1.5, booth.z, 5, 3, 4, 0, 0x2c2140);
    VN.merge.shaded(bright, booth.x, 3.4, booth.z, 6, 0.5, 5, 0, 0xff2e88);
    colliders.push({ x0: booth.x - 2.5, z0: booth.z - 2, x1: booth.x + 2.5, z1: booth.z + 2 });

    // ---- rain ------------------------------------------------------------
    var rainCount = 900;
    var rainPos = new Float32Array(rainCount * 3);
    for (var r2 = 0; r2 < rainCount; r2++) {
      rainPos[r2 * 3] = (rng() - 0.5) * 260;
      rainPos[r2 * 3 + 1] = rng() * 60;
      rainPos[r2 * 3 + 2] = (rng() - 0.5) * 260;
    }
    var rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    var rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x9fc4e8, size: 0.85, transparent: true, opacity: 0.65
    }));
    rain.frustumCulled = false;
    scene.add(rain);

    scene.add(boxes.build());
    scene.add(dark.build());
    scene.add(bright.build(new THREE.MeshBasicMaterial({ vertexColors: true })));

    return {
      scene: scene, rng: rng, colliders: colliders, lamps: lamps,
      parkSpots: parkSpots, rain: rain, stats: stats,
      plaza: plaza, booth: booth, hospital: hosp,
      districtAt: districtAt, isRoad: isRoad, roadCoord: roadCoord,
      GRID: GRID, EDGE: CITY_EDGE
    };
  }

  // Resolve a point out of building footprints (cheap AABB push-out).
  function collide(colliders, x, z, radius) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x > c.x0 - radius && x < c.x1 + radius && z > c.z0 - radius && z < c.z1 + radius) {
        var dl = x - (c.x0 - radius), dr = (c.x1 + radius) - x;
        var dn = z - (c.z0 - radius), df = (c.z1 + radius) - z;
        var m = Math.min(dl, dr, dn, df);
        if (m === dl) x = c.x0 - radius;
        else if (m === dr) x = c.x1 + radius;
        else if (m === dn) z = c.z0 - radius;
        else z = c.z1 + radius;
      }
    }
    var E = CITY_EDGE + 6;
    if (x < -E) x = -E; if (x > E) x = E;
    if (z < -E) z = -E; if (z > 246) z = 246;
    return { x: x, z: z };
  }

  return { build: build, collide: collide, RNG: RNG, districtAt: districtAt, isRoad: isRoad };
})();
