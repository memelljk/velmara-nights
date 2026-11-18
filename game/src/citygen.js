// citygen.js — procedural generation of Velmara, a rain-soaked neon port
// city at night. Seeded, so ?seed= rebuilds the same streets. Produces the
// merged static geometry (buildings with lit windows, streetlights, market
// stalls, container yards, harbour piers and cranes), the road grid data the
// traffic and police drive on, building colliders, and the named places the
// story missions use (Odile's booth, St. Mirella Hospital, Dock Nine, the
// harbour vault, Orphee Motors).
window.V = window.V || {};
(function () {
  'use strict';

  var ROAD_LINES = [-240, -144, -48, 48, 144, 240]; // road centre lines, both axes
  var ROAD_HALF = 12;                                // half the road width
  var WORLD = 320;                                   // ground plane half-size
  var QUAY_Z = 264;                                  // land ends, harbour water begins

  var DISTRICT_TABLE = [
    // iz rows run north (0) to south (4); ix columns west (0) to east (4)
    ['Neon Mile', 'The Heights', 'The Heights', 'The Heights', 'The Heights'],
    ['Neon Mile', 'Old Market', 'Old Market', 'The Heights', 'The Heights'],
    ['Neon Mile', 'Old Market', 'Old Market', 'Old Market', 'Dockyards'],
    ['Neon Mile', 'Harbor', 'Harbor', 'Dockyards', 'Dockyards'],
    ['Neon Mile', 'Harbor', 'Harbor', 'Dockyards', 'Dockyards']
  ];
  var DISTRICT_STYLE = {
    'Neon Mile':  { hMin: 17, hMax: 38, tint: [0x4a3a5e, 0x3d4a6e, 0x5e3a52, 0x36455e] },
    'The Heights': { hMin: 26, hMax: 54, tint: [0x3a4258, 0x424c66, 0x353d52, 0x4a546e] },
    'Old Market': { hMin: 8,  hMax: 17, tint: [0x54463a, 0x4a3f36, 0x5c4a3c, 0x463e46] },
    'Harbor':     { hMin: 10, hMax: 22, tint: [0x3c4a4c, 0x44524e, 0x39444e, 0x4c463e] },
    'Dockyards':  { hMin: 8,  hMax: 15, tint: [0x4e4438, 0x424e4a, 0x55483c, 0x3e4a52] }
  };

  // --- the lit-window atlas: 4x4 canvas tiles of window grids -------------
  function makeWindowAtlas(rng) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, 512, 512);
    var warm = ['#ffd489', '#ffb45e', '#fff0b8', '#ff9d5c'];
    var cool = ['#a8d8ff', '#7fb8ff', '#cfe8ff', '#8ff2e0'];
    var neon = ['#ff7fd4', '#8f7fff', '#5ff2c8', '#ff8f6e'];
    for (var ty = 0; ty < 4; ty++) {
      for (var tx = 0; tx < 4; tx++) {
        var palette = (tx + ty) % 3 === 0 ? neon : ((tx + ty) % 2 === 0 ? warm : cool);
        var litRatio = 0.34 + rng() * 0.3;
        var cols = 6, rows = 10;
        var cw = 128 / cols, ch = 128 / rows;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var x = tx * 128 + c * cw + 3;
            var y = ty * 128 + r * ch + 3;
            if (rng() < litRatio) {
              ctx.fillStyle = palette[(rng() * palette.length) | 0];
              ctx.globalAlpha = 0.55 + rng() * 0.45;
            } else {
              ctx.fillStyle = '#131722';
              ctx.globalAlpha = 1;
            }
            ctx.fillRect(x, y, cw - 6, ch - 6);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // --- the ground: one canvas paints asphalt, lanes, walks, the quay -----
  function makeGroundTexture() {
    var S = 2048, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var ctx = cv.getContext('2d');
    var px = function (w) { return (w + WORLD) / (WORLD * 2) * S; };
    ctx.fillStyle = '#191b23'; // block interiors / sidewalks
    ctx.fillRect(0, 0, S, S);
    // harbour water south of the quay
    var qy = px(QUAY_Z);
    ctx.fillStyle = '#0a1626';
    ctx.fillRect(0, qy, S, S - qy);
    ctx.fillStyle = '#2c3e55';
    for (var i = 0; i < 260; i++) {
      ctx.fillRect(Math.random() * S, qy + Math.random() * (S - qy), 22 + Math.random() * 60, 2);
    }
    ctx.fillStyle = '#3a3f4c'; // quay apron
    ctx.fillRect(0, px(250), S, qy - px(250));
    // roads
    ctx.fillStyle = '#0b0c11';
    ROAD_LINES.forEach(function (r) {
      ctx.fillRect(px(r - ROAD_HALF), 0, px(r + ROAD_HALF) - px(r - ROAD_HALF), qy);
      ctx.fillRect(0, px(r - ROAD_HALF), S, px(r + ROAD_HALF) - px(r - ROAD_HALF));
    });
    // lane dashes
    ctx.fillStyle = '#8f8348';
    ROAD_LINES.forEach(function (r) {
      for (var d = -WORLD; d < WORLD; d += 18) {
        ctx.fillRect(px(r) - 1, px(d), 2, px(d + 8) - px(d));
        ctx.fillRect(px(d), px(r) - 1, px(d + 8) - px(d), 2);
      }
    });
    // crosswalks at intersections
    ctx.fillStyle = 'rgba(210,215,225,0.5)';
    ROAD_LINES.forEach(function (rx) {
      ROAD_LINES.forEach(function (rz) {
        for (var s = -9; s <= 9; s += 4.5) {
          ctx.fillRect(px(rx + s) - 1, px(rz - ROAD_HALF) - 3, 2.4, 5);
          ctx.fillRect(px(rx + s) - 1, px(rz + ROAD_HALF) - 2, 2.4, 5);
          ctx.fillRect(px(rx - ROAD_HALF) - 3, px(rz + s) - 1, 5, 2.4);
          ctx.fillRect(px(rx + ROAD_HALF) - 2, px(rz + s) - 1, 5, 2.4);
        }
      });
    });
    // wet sheen streaks
    ctx.fillStyle = 'rgba(120,140,190,0.05)';
    for (var k = 0; k < 400; k++) {
      ctx.fillRect(Math.random() * S, Math.random() * qy, 3 + Math.random() * 8, 26 + Math.random() * 70);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // --- a neon sign texture -------------------------------------------------
  function makeSignTexture(text, fg, bg) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.font = 'bold 58px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fg;
    ctx.shadowBlur = 22;
    ctx.fillStyle = fg;
    ctx.fillText(text, 256, 68);
    ctx.shadowBlur = 6;
    ctx.fillText(text, 256, 68);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function cellIndex(w) {
    // world coordinate -> cell index 0..4 (cells sit between road lines)
    var centres = [-192, -96, 0, 96, 192];
    var best = 0, bd = 1e9;
    for (var i = 0; i < 5; i++) {
      var d = Math.abs(w - centres[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function generate(seed) {
    var rng = V.makeRng(seed * 7919 + 13);
    var city = {
      roadLines: ROAD_LINES,
      roadHalf: ROAD_HALF,
      world: WORLD,
      quayZ: QUAY_Z,
      colliders: [],       // {minX,maxX,minZ,maxZ} solid AABBs
      buildings: [],
      lampCount: 0,
      parkedSpawns: [],
      signs: []
    };
    city.districtAt = function (x, z) {
      return DISTRICT_TABLE[cellIndex(z)][cellIndex(x)];
    };
    city.isOnRoad = function (x, z) {
      for (var i = 0; i < ROAD_LINES.length; i++) {
        if (Math.abs(x - ROAD_LINES[i]) <= ROAD_HALF + 1) return true;
        if (Math.abs(z - ROAD_LINES[i]) <= ROAD_HALF + 1) return true;
      }
      return false;
    };

    var scene = new THREE.Group();
    var atlas = makeWindowAtlas(rng);

    // ground
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 2, WORLD * 2),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // water sheen
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 2, 130),
      new THREE.MeshLambertMaterial({ color: 0x14405e, transparent: true, opacity: 0.45 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, QUAY_Z + 62);
    scene.add(water);
    city.water = water;

    // ---- buildings ------------------------------------------------------
    var buildBatch = new V.Builder();
    var centres = [-192, -96, 0, 96, 192];
    var signSpots = []; // building faces that can carry a neon sign
    for (var iz = 0; iz < 5; iz++) {
      for (var ix = 0; ix < 5; ix++) {
        var district = DISTRICT_TABLE[iz][ix];
        var style = DISTRICT_STYLE[district];
        var cx = centres[ix], cz = centres[iz];
        var warehouse = district === 'Dockyards';
        var plots = warehouse ? 4 : 8 + ((rng() * 3) | 0);
        for (var p = 0; p < plots; p++) {
          var gx = (p % 3) - 1, gz = ((p / 3) | 0) - 1;
          if (warehouse) { gx = (p % 2) * 2 - 1; gz = ((p / 2) | 0) * 2 - 1; }
          var bw = warehouse ? 20 + rng() * 8 : 13 + rng() * 9;
          var bd = warehouse ? 18 + rng() * 8 : 13 + rng() * 9;
          var bx = cx + gx * 21 + (rng() - 0.5) * 5;
          var bz = cz + gz * 21 + (rng() - 0.5) * 5;
          var bh = style.hMin + rng() * (style.hMax - style.hMin);
          var tile = (rng() * 16) | 0;
          var tu = (tile % 4) / 4, tv = ((tile / 4) | 0) / 4;
          var vSpan = V.clamp(bh / 46, 0.3, 1) * 0.25;
          var tint = style.tint[(rng() * style.tint.length) | 0];
          buildBatch.box(bw, bh, bd, bx, bh / 2, bz, 0, tint, [tu, tv + 0.25 - vSpan, tu + 0.25, tv + 0.25]);
          // rooftop cap
          buildBatch.box(bw + 0.6, 0.7, bd + 0.6, bx, bh + 0.35, bz, 0, 0x14161e, null);
          city.buildings.push({ x: bx, z: bz, w: bw, d: bd, h: bh, district: district });
          city.colliders.push({ minX: bx - bw / 2 - 0.4, maxX: bx + bw / 2 + 0.4, minZ: bz - bd / 2 - 0.4, maxZ: bz + bd / 2 + 0.4 });
          if (district === 'Neon Mile' && ix === 0 && p < 3) {
            signSpots.push({ x: bx - bw / 2 - 0.3, y: bh * (0.45 + rng() * 0.3), z: bz, ry: -Math.PI / 2, w: Math.min(20, bd + 4) });
          }
        }
      }
    }
    var buildingMat = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true,
      emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.5
    });
    scene.add(buildBatch.build(buildingMat));

    // ---- streetlights: poles merged, heads merged emissive --------------
    var poleBatch = new V.Builder();
    var headBatch = new V.Builder();
    var lampSpots = [];
    ROAD_LINES.forEach(function (r) {
      [-1, 1].forEach(function (side) {
        for (var d = -306; d <= 306; d += 15) {
          var nearCross = false;
          ROAD_LINES.forEach(function (o) { if (Math.abs(d - o) < 16) nearCross = true; });
          if (nearCross) continue;
          lampSpots.push({ x: r + side * (ROAD_HALF + 1.6), z: d, vertical: true });
          lampSpots.push({ x: d, z: r + side * (ROAD_HALF + 1.6), vertical: false });
        }
      });
    });
    // trim to the design count with the seeded rng so it is stable per seed
    while (lampSpots.length > 648) lampSpots.splice((rng() * lampSpots.length) | 0, 1);
    lampSpots.forEach(function (s) {
      poleBatch.box(0.28, 5.4, 0.28, s.x, 2.7, s.z, 0, 0x23262e, null);
      var ax = s.vertical ? s.x - Math.sign(s.x % 97) * 0 : s.x;
      headBatch.box(1.5, 0.22, 0.5, s.x, 5.45, s.z, s.vertical ? 0 : Math.PI / 2, 0xffc37a, null);
      city.lampCount++;
    });
    scene.add(poleBatch.build(new THREE.MeshLambertMaterial({ vertexColors: true })));
    scene.add(headBatch.build(new THREE.MeshBasicMaterial({ vertexColors: true })));

    // ---- props: stalls, containers, cranes, piers, crates ---------------
    var propBatch = new V.Builder();
    var stallCols = [0xc94f6d, 0x3fa7a0, 0xd9a441, 0x7a5fd0, 0x4f8fc9];
    var stallSpots = [];
    // Old Market stalls ring the centre cells
    for (var s2 = 0; s2 < 14; s2++) {
      var sx = -128 + (s2 % 5) * 26 + rng() * 6;
      var sz = -26 + ((s2 / 5) | 0) * 30 + rng() * 6;
      var sc = stallCols[s2 % stallCols.length];
      propBatch.box(4.6, 0.9, 2.2, sx, 0.45, sz, 0, 0x5c4a36, null);            // counter
      propBatch.box(5.2, 0.24, 3.4, sx, 2.5, sz, 0, sc, null);                 // canopy
      propBatch.box(0.18, 2.5, 0.18, sx - 2.3, 1.25, sz - 1.4, 0, 0x3a3230, null);
      propBatch.box(0.18, 2.5, 0.18, sx + 2.3, 1.25, sz + 1.4, 0, 0x3a3230, null);
      propBatch.box(1.1, 0.7, 1.1, sx + 1.2, 1.25, sz, 0, 0xd9d3c3, null);     // goods crate
      city.colliders.push({ minX: sx - 2.6, maxX: sx + 2.6, minZ: sz - 1.8, maxZ: sz + 1.8 });
      stallSpots.push({ x: sx, z: sz });
    }
    city.stallSpots = stallSpots;
    // container yards in the Dockyards and along the quay
    var contCols = [0x9c4a32, 0x32649c, 0x3f8a52, 0x8a7432, 0x6a4a8c, 0x707880];
    function container(x, z, ry, lvl, ci) {
      propBatch.box(6.1, 2.6, 2.44, x, 1.3 + lvl * 2.6, z, ry, contCols[ci % contCols.length], null);
      if (lvl === 0) city.colliders.push({ minX: x - 3.2, maxX: x + 3.2, minZ: z - 1.4, maxZ: z + 1.4 });
    }
    for (var cix = 0; cix < 26; cix++) {
      var ccx = 120 + rng() * 180, ccz = 108 + rng() * 130;
      if (city.isOnRoad(ccx, ccz)) continue;
      var base = (rng() * 6) | 0;
      container(ccx, ccz, rng() < 0.5 ? 0 : Math.PI / 2, 0, base);
      if (rng() < 0.55) container(ccx, ccz, rng() < 0.5 ? 0 : Math.PI / 2, 1, base + 2);
    }
    // harbour piers reaching into the water
    [0, 96, 192].forEach(function (pxx) {
      propBatch.box(14, 0.3, 62, pxx, 0.15, QUAY_Z + 30, 0, 0x3d414c, null);
      for (var b = 0; b < 5; b++) propBatch.box(0.8, 1.6, 0.8, pxx - 6, 0.8, QUAY_Z + 6 + b * 13, 0, 0x2c2f38, null);
    });
    // two dock cranes
    [30, 150].forEach(function (crx) {
      propBatch.box(1.6, 26, 1.6, crx - 5, 13, 252, 0, 0x8c6a2e, null);
      propBatch.box(1.6, 26, 1.6, crx + 5, 13, 252, 0, 0x8c6a2e, null);
      propBatch.box(13, 1.8, 1.8, crx, 25.4, 252, 0, 0x8c6a2e, null);
      propBatch.box(1.1, 1.1, 30, crx, 24.6, 266, 0, 0xa87f36, null);
      propBatch.box(0.9, 7, 0.9, crx, 20.5, 278, 0, 0x554433, null);
    });
    // scattered crates and barrels near the market and docks
    for (var bi = 0; bi < 40; bi++) {
      var bx2 = (rng() - 0.5) * 560, bz2 = (rng() - 0.5) * 520;
      if (city.isOnRoad(bx2, bz2)) continue;
      if (rng() < 0.5) propBatch.box(1, 1, 1, bx2, 0.5, bz2, rng() * 3, 0x6e5a40, null);
      else propBatch.box(0.72, 1.05, 0.72, bx2, 0.52, bz2, 0, 0x44586a, null);
    }
    scene.add(propBatch.build(new THREE.MeshLambertMaterial({ vertexColors: true })));

    // ---- neon signs -------------------------------------------------------
    var SIGN_DEFS = [
      { text: 'VELMARA', fg: '#ff5fc8', bg: '#160a18' },
      { text: 'HOTEL MIRE', fg: '#5ff2c8', bg: '#0a1414' },
      { text: 'CLUB PULSE', fg: '#b78fff', bg: '#100a1c' },
      { text: 'NOODLE BAR', fg: '#ffb45e', bg: '#180f06' },
      { text: 'KARAOKE NOVA', fg: '#7fd4ff', bg: '#081018' }
    ];
    signSpots.slice(0, SIGN_DEFS.length).forEach(function (spot, i) {
      var def = SIGN_DEFS[i];
      var sign = new THREE.Mesh(
        new THREE.PlaneGeometry(spot.w, spot.w / 4),
        new THREE.MeshBasicMaterial({ map: makeSignTexture(def.text, def.fg, def.bg) })
      );
      sign.position.set(spot.x, spot.y, spot.z);
      sign.rotation.y = spot.ry;
      scene.add(sign);
      city.signs.push({ text: def.text, x: spot.x, z: spot.z });
    });
    // fixed story signs: Orphee Motors (Neon Mile), the harbour TATTOO
    // parlour, St. Mirella Hospital (The Heights) and Dock Nine.
    function fixedSign(text, fg, bg, x, y, z, ry, w) {
      var sign = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w / 4),
        new THREE.MeshBasicMaterial({ map: makeSignTexture(text, fg, bg) })
      );
      sign.position.set(x, y, z);
      sign.rotation.y = ry;
      scene.add(sign);
      city.signs.push({ text: text, x: x, z: z });
      return sign;
    }
    fixedSign('ORPHEE MOTORS', '#8f9fff', '#0a0c1c', -225.4, 9, -120, -Math.PI / 2, 22);
    fixedSign('TATTOO', '#ff6e5e', '#180806', 78, 6.5, 226.6, 0, 15);
    fixedSign('ST MIRELLA', '#a8ffd8', '#061410', 156.6, 12, -168, -Math.PI / 2, 20);
    fixedSign('DOCK NINE', '#ffd489', '#141006', 96, 7.5, 258, Math.PI, 18);
    fixedSign('PAWN & CO', '#ffe95e', '#141200', -225.4, 7, 40, -Math.PI / 2, 16);

    // ---- named places -----------------------------------------------------
    city.odileBooth = { x: -221, z: -48 };
    // Odile's booth: a little kiosk on the Neon Mile sidewalk
    var booth = new V.Builder();
    booth.box(3.4, 2.6, 2.6, city.odileBooth.x, 1.3, city.odileBooth.z, 0, 0x6d2a4a, null);
    booth.box(4.2, 0.3, 3.4, city.odileBooth.x, 2.85, city.odileBooth.z, 0, 0xff5fc8, null);
    booth.box(1.6, 1.0, 0.2, city.odileBooth.x - 1.8, 1.5, city.odileBooth.z, 0, 0x2b1030, null);
    scene.add(booth.build(new THREE.MeshLambertMaterial({ vertexColors: true })));
    city.colliders.push({ minX: city.odileBooth.x - 1.9, maxX: city.odileBooth.x + 1.9, minZ: city.odileBooth.z - 1.5, maxZ: city.odileBooth.z + 1.5 });

    city.hospital = { x: 150, z: -150, spawnX: 138, spawnZ: -138 };
    city.orpheeLot = { x: -233, z: -120 };          // the indigo Orphee GT waits here
    city.vault = { x: 150, z: 255 };                // harbour vault door, on the quay apron
    city.dockNine = { x: 96, z: 296 };              // end of the middle pier
    city.marketPickup = { x: stallSpots[3].x, z: stallSpots[3].z + 4 };
    city.raceStart = { x: -240, z: 168 };
    city.playerStart = { x: -216, z: -40 };

    // ---- parked car spawns along the kerbs --------------------------------
    var kinds = ['sedan', 'coupe', 'taxi', 'pickup', 'sedan', 'coupe'];
    for (var pk = 0; pk < 30; pk++) {
      var vertical = rng() < 0.5;
      var line = ROAD_LINES[(rng() * ROAD_LINES.length) | 0];
      var along = -290 + rng() * 580;
      var sideSign = rng() < 0.5 ? -1 : 1;
      var px2 = vertical ? line + sideSign * 8.6 : along;
      var pz2 = vertical ? along : line + sideSign * 8.6;
      var nearCross2 = false;
      ROAD_LINES.forEach(function (o) { if (Math.abs(along - o) < 20) nearCross2 = true; });
      if (nearCross2 || pz2 > 250) continue;
      city.parkedSpawns.push({
        x: px2, z: pz2,
        ry: vertical ? (sideSign < 0 ? Math.PI : 0) + (rng() - 0.5) * 0.06
                     : (sideSign < 0 ? -Math.PI / 2 : Math.PI / 2) + (rng() - 0.5) * 0.06,
        kind: kinds[(rng() * kinds.length) | 0]
      });
    }

    city.group = scene;
    return city;
  }

  // Resolve a circle (actor or car) against every building/prop AABB.
  V.collideCircle = function (city, x, z, r) {
    var list = city.colliders;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        var dxl = x - (b.minX - r), dxr = (b.maxX + r) - x;
        var dzl = z - (b.minZ - r), dzr = (b.maxZ + r) - z;
        var m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = b.minX - r;
        else if (m === dxr) x = b.maxX + r;
        else if (m === dzl) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
    var W = 312;
    if (x < -W) x = -W; if (x > W) x = W;
    if (z < -W) z = -W; if (z > 330) z = 330;
    return { x: x, z: z };
  };

  V.generateCity = generate;
})();
