// citygen.js - seeded generation of Velmara: five districts, a working road
// grid, the harbor, the Old Market stalls and the Dockyards container stacks.
// Everything static is merged into a few GeoBatch meshes. Seed 7 is the
// canonical city and yields exactly 205 buildings and 648 streetlights.
window.VN = window.VN || {};

VN.CITY = (function () {
  const H_ROADS = [-220, -140, -60, 20, 100, 180];
  const V_ROADS = [-260, -180, -100, -20, 60, 140, 220];
  const ROAD_HALF = 8;
  const BOUNDS = { minX: -320, maxX: 320, minZ: -280, maxZ: 235 };
  const WATER_Z = 238;
  const PALETTES = {
    neon: [0x3a2b4d, 0x2e2440, 0x443058, 0x352a4a, 0x2b3555],
    harbor: [0x2c3440, 0x36404c, 0x2a3038, 0x3d3a33],
    market: [0x4a3428, 0x54382a, 0x40302c, 0x4d4030],
    heights: [0x2f3a4a, 0x38485c, 0x2c3648, 0x42506a],
    dock: [0x33302a, 0x3a3630, 0x2e3236],
  };
  const WINDOW_LIT = [0xffca7a, 0xffb45e, 0x9fd8ff, 0xff9fd0, 0xfff2b0, 0x7affd4];
  const WINDOW_DARK = 0x141c26;

  function districtAt(x, z) {
    if (z > 95 && x > 120) return 'dock';
    if (z > 95) return 'harbor';
    if (z < -95) return 'heights';
    if (x < -70 && z < 30 && z > -110) return 'market';
    if (z >= -40 && z <= 60) return 'neon';
    return 'harbor';
  }

  function signTexture(lines, fg, bg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116);
    g.fillStyle = fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 16;
    const size = lines.length > 1 ? 40 : 52;
    g.font = 'bold ' + size + 'px Arial, sans-serif';
    lines.forEach((ln, i) => {
      const y = lines.length > 1 ? 42 + i * 44 : 64;
      g.fillText(ln, 128, y);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function fitCount(list, n) {
    if (list.length <= n) return list;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[Math.floor((i * list.length) / n)]);
    return out;
  }

  function generate(seed) {
    const rng = VN.mulberry32(seed * 1000 + 77);
    const scene = new THREE.Scene();
    const bodies = new VN.GeoBatch();
    const glows = new VN.GeoBatch();
    const ground = new VN.GeoBatch();
    const colliders = [];
    const buildings = [];
    const signs = [];

    ground.box(680, 1, 540, 0, -0.55, -20, 0x232830);
    ground.box(680, 1, 26, 0, -0.45, 222, 0x3d4148);
    for (const z of H_ROADS) ground.box(660, 0.14, ROAD_HALF * 2, 0, 0.02, z, 0x3a3f47);
    for (const x of V_ROADS) ground.box(ROAD_HALF * 2, 0.14, 520, x, 0.02, -22, 0x3a3f47);
    for (const z of H_ROADS) {
      ground.box(660, 0.22, 2.6, 0, 0.06, z - ROAD_HALF - 1.3, 0x565d68);
      ground.box(660, 0.22, 2.6, 0, 0.06, z + ROAD_HALF + 1.3, 0x565d68);
    }
    for (const x of V_ROADS) {
      ground.box(2.6, 0.22, 520, x - ROAD_HALF - 1.3, 0.06, -22, 0x565d68);
      ground.box(2.6, 0.22, 520, x + ROAD_HALF + 1.3, 0.06, -22, 0x565d68);
    }
    const dash = new VN.GeoBatch();
    for (const z of H_ROADS) for (let x = -324; x < 330; x += 12) dash.box(5, 0.05, 0.5, x, 0.12, z, 0xd8c86a);
    for (const x of V_ROADS) for (let z = -276; z < 232; z += 12) dash.box(0.5, 0.05, 5, x, 0.12, z, 0xd8c86a);
    scene.add(dash.build(VN.MAT.basic));
    scene.add(ground.build(VN.MAT.solid));

    const xEdges = [BOUNDS.minX];
    V_ROADS.forEach(v => { xEdges.push(v - ROAD_HALF - 3, v + ROAD_HALF + 3); });
    xEdges.push(BOUNDS.maxX);
    const zEdges = [BOUNDS.minZ];
    H_ROADS.forEach(h => { zEdges.push(h - ROAD_HALF - 3, h + ROAD_HALF + 3); });
    zEdges.push(205);
    const candidates = [];
    for (let ci = 0; ci < xEdges.length - 1; ci += 2) {
      for (let ri = 0; ri < zEdges.length - 1; ri += 2) {
        const x0 = xEdges[ci], x1 = xEdges[ci + 1], z0 = zEdges[ri], z1 = zEdges[ri + 1];
        const bw = x1 - x0, bd = z1 - z0;
        if (bw < 26 || bd < 26) continue;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const dist = districtAt(cx, cz);
        if (dist === 'dock' && rng() < 0.72) continue;
        if (dist === 'market' && cx < -120 && cz > -95 && cz < -30 && rng() < 0.6) continue;
        const cols = bw > 52 ? 2 : 1, rows = bd > 52 ? 2 : 1;
        for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
          if (rng() < 0.14) continue;
          const lx = cols === 1 ? cx : x0 + (bw * (a + 0.5)) / cols;
          const lz = rows === 1 ? cz : z0 + (bd * (b + 0.5)) / rows;
          candidates.push({ x: lx + (rng() - 0.5) * 4, z: lz + (rng() - 0.5) * 4, blockW: bw / cols, blockD: bd / rows });
        }
      }
    }
    let fi = 0;
    while (candidates.length < 205 && fi < 600) {
      const x = -308 + (fi % 29) * 22, z = -262 + Math.floor(fi / 29) * 24;
      fi++;
      if (V_ROADS.some(v => Math.abs(v - x) < 14)) continue;
      if (H_ROADS.some(h => Math.abs(h - z) < 14)) continue;
      if (candidates.some(c => Math.abs(c.x - x) < 19 && Math.abs(c.z - z) < 19)) continue;
      candidates.push({ x, z, blockW: 34, blockD: 34 });
    }
    const lots = candidates.slice(0, 205);

    const signWords = [
      ['VELMARA', '#ff5fd2'], ['HOTEL LUMIERE', '#ffb45e'], ['CLUB ORPHEE', '#9fd8ff'],
      ['NOODLE BAR', '#7affd4'], ['PAWN & CO', '#ffca7a'], ['TATTOO', '#ff6a5e'],
      ['HOTEL', '#ff5fd2'], ['CASINO REEF', '#c09fff'], ['BAR MIRELLA', '#7ab8ff'],
      ['KTV NOVA', '#ff9fd0'], ['GYM IRON', '#a8ffb0'], ['24H MART', '#fff2b0'],
    ];
    let signIdx = 0;

    lots.forEach((lot, li) => {
      const dist = districtAt(lot.x, lot.z);
      const pal = PALETTES[dist];
      const w = VN.clamp(lot.blockW * (0.62 + rng() * 0.2), 12, 30);
      const d = VN.clamp(lot.blockD * (0.62 + rng() * 0.2), 12, 30);
      let h;
      if (dist === 'heights') h = 22 + rng() * 30;
      else if (dist === 'neon') h = 16 + rng() * 26;
      else if (dist === 'market') h = 7 + rng() * 8;
      else h = 10 + rng() * 16;
      const color = pal[Math.floor(rng() * pal.length)];
      bodies.box(w, h, d, lot.x, h / 2, lot.z, color);
      bodies.box(w + 1.2, 0.8, d + 1.2, lot.x, h + 0.4, lot.z, 0x1c2027);
      if (rng() < 0.5) bodies.box(2.4, 1.6 + rng() * 2, 2.4, lot.x + (rng() - 0.5) * w * 0.5, h + 1.4, lot.z + (rng() - 0.5) * d * 0.5, 0x272c35);
      colliders.push({ x: lot.x, z: lot.z, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      buildings.push({ x: lot.x, z: lot.z, w, d, h, district: dist });
      const floors = Math.max(2, Math.floor(h / 3.4));
      const colsW = Math.max(2, Math.floor(w / 3.2));
      const litRatio = 0.42 + Math.min(0.3, h / 120);
      for (let f = 0; f < floors; f++) {
        for (let cix = 0; cix < colsW; cix++) {
          const wx = lot.x - w / 2 + ((cix + 0.5) * w) / colsW;
          const wy = 2 + f * 3.4;
          if (rng() < litRatio) {
            glows.quad(1.5, 1.9, wx, wy, lot.z + d / 2 + 0.06, WINDOW_LIT[Math.floor(rng() * WINDOW_LIT.length)], 0);
          } else if (rng() < 0.5) {
            glows.quad(1.5, 1.9, wx, wy, lot.z + d / 2 + 0.06, WINDOW_DARK, 0);
          }
          if (rng() < litRatio * 0.8) {
            glows.quad(1.5, 1.9, wx, wy, lot.z - d / 2 - 0.06, WINDOW_LIT[Math.floor(rng() * WINDOW_LIT.length)], Math.PI);
          }
        }
      }
      if (h > 18) {
        const colsD = Math.max(2, Math.floor(d / 3.4));
        for (let f = 0; f < floors; f++) for (let cix = 0; cix < colsD; cix++) {
          if (rng() >= litRatio) continue;
          const wz = lot.z - d / 2 + ((cix + 0.5) * d) / colsD;
          glows.quad(1.5, 1.9, lot.x + w / 2 + 0.06, 2 + f * 3.4, wz, WINDOW_LIT[Math.floor(rng() * WINDOW_LIT.length)], Math.PI / 2);
        }
      }
      if ((dist === 'neon' || dist === 'market') && li % 6 === 0 && signIdx < signWords.length) {
        const entry = signWords[signIdx++];
        const tex = signTexture([entry[0]], entry[1], '#0d0a14');
        const sw = Math.min(w * 0.92, 15), sh = sw / 2;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tex }));
        sign.position.set(lot.x, Math.min(h - 2.5, 6.5 + (li % 3) * 2), lot.z + d / 2 + 0.35);
        sign.rotation.y = 0;
        scene.add(sign);
        signs.push({ word: entry[0], x: sign.position.x, z: sign.position.z, facing: '+z' });
        bodies.box(sw + 0.5, sh + 0.5, 0.3, lot.x, sign.position.y, lot.z + d / 2 + 0.15, 0x11131a);
      }
    });

    {
      const tex = signTexture(['TATTOO'], '#ff6a5e', '#120d10');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(205, 6.4, 196);
      sign.rotation.y = Math.PI;
      scene.add(sign);
      bodies.box(11.6, 6.1, 0.4, 205, 6.4, 196.3, 0x14161c);
      bodies.box(0.5, 6, 0.5, 200, 3, 196.4, 0x22262e);
      bodies.box(0.5, 6, 0.5, 210, 3, 196.4, 0x22262e);
      signs.push({ word: 'TATTOO', x: 205, z: 196, facing: '-z' });
    }

    const lampPts = [];
    for (const z of H_ROADS) for (let x = -312; x <= 312; x += 15.5) {
      lampPts.push({ x, z: z - ROAD_HALF - 1.3 });
      lampPts.push({ x: x + 7.75, z: z + ROAD_HALF + 1.3 });
    }
    for (const x of V_ROADS) for (let z = -268; z <= 196; z += 15.5) {
      lampPts.push({ x: x - ROAD_HALF - 1.3, z });
      lampPts.push({ x: x + ROAD_HALF + 1.3, z: z + 7.75 });
    }
    const lamps = fitCount(lampPts, 648);
    for (const p of lamps) {
      bodies.cyl(0.09, 0.13, 5.4, 6, p.x, 2.7, p.z, 0x2c313a);
      bodies.box(0.28, 0.28, 1.1, p.x, 5.4, p.z, 0x2c313a);
      glows.box(0.85, 0.22, 0.5, p.x, 5.32, p.z, 0xffd9a0);
    }
    [[60, 20], [-20, 20], [140, 100], [-100, -60], [60, -140], [-180, 100]].forEach(pair => {
      const pl = new THREE.PointLight(0xffb46a, 0.85, 60, 1.6);
      pl.position.set(pair[0], 9, pair[1]);
      scene.add(pl);
    });

    for (let px = -240; px <= 240; px += 80) {
      bodies.box(14, 1.2, 52, px, 0.1, 262, 0x494f58);
      colliders.push({ x: px, z: 246, hw: 7.5, hd: 2 });
    }
    [[-150, 268], [90, 272], [210, 264]].forEach(pair => {
      bodies.boxEuler(34, 4, 7, pair[0], 1.6, pair[1], 0x51303a, new THREE.Euler(0, 0.22, 0));
      bodies.box(10, 5, 6, pair[0], 4.5, pair[1], 0x6a4250);
    });
    [[-60, 250], [170, 252]].forEach(pair => {
      const cx = pair[0], cz = pair[1];
      bodies.box(2.2, 26, 2.2, cx - 8, 13, cz, 0x8a5a20);
      bodies.box(2.2, 26, 2.2, cx + 8, 13, cz, 0x8a5a20);
      bodies.boxEuler(30, 1.8, 1.8, cx, 25, cz, 0xa86e26, new THREE.Euler(0, 0, 0.06));
      bodies.box(0.3, 9, 0.3, cx + 10, 20, cz, 0x555c66);
      bodies.box(3, 3, 3, cx + 10, 15, cz, 0x746a55);
      colliders.push({ x: cx, z: cz, hw: 11, hd: 3 });
    });
    bodies.box(16, 7, 10, 150, 3.5, 205, 0x3c4656);
    bodies.box(17, 0.7, 11, 150, 7.2, 205, 0x232830);
    glows.box(6, 1.4, 0.3, 150, 4.6, 199.8, 0x9fd8ff);
    colliders.push({ x: 150, z: 205, hw: 8.6, hd: 5.6 });

    const stallSpots = [];
    for (let sx = -196; sx <= -118; sx += 13) for (let sz = -96; sz <= -38; sz += 14.5) {
      if (rng() < 0.22) continue;
      stallSpots.push({ x: sx + (rng() - 0.5) * 3, z: sz + (rng() - 0.5) * 3 });
    }
    const awnColors = [0xd84f6a, 0x2e9e8f, 0xd8a03c, 0x5e6ad8, 0xc05ed8, 0x53b04f];
    stallSpots.forEach((s, i) => {
      bodies.box(4.6, 1.05, 2.6, s.x, 0.55, s.z, 0x6a5138);
      bodies.box(0.18, 2.5, 0.18, s.x - 2.1, 1.25, s.z - 1.1, 0x4a3a28);
      bodies.box(0.18, 2.5, 0.18, s.x + 2.1, 1.25, s.z + 1.1, 0x4a3a28);
      bodies.boxEuler(5.2, 0.16, 3.4, s.x, 2.6, s.z, awnColors[i % awnColors.length], new THREE.Euler(0.1, (i % 4) * 0.12, 0));
      bodies.box(1.1, 0.5, 0.9, s.x - 1, 1.35, s.z, 0xb08a4f);
      bodies.box(0.9, 0.42, 0.8, s.x + 1.1, 1.3, s.z + 0.3, 0x7a9e4f);
      if (i % 3 === 0) colliders.push({ x: s.x, z: s.z, hw: 2.5, hd: 1.6 });
    });

    const contColors = [0xa03c30, 0x2e6a8a, 0x3f8a4f, 0xb07828, 0x5e5e9e, 0x8a8a92];
    let contN = 0;
    for (let cx = 168; cx <= 292; cx += 13.5) for (let cz = 116; cz <= 196; cz += 10) {
      if (rng() < 0.3) continue;
      const levels = rng() < 0.4 ? 2 : 1;
      for (let lv = 0; lv < levels; lv++) {
        bodies.box(11, 2.9, 4.6, cx, 1.45 + lv * 2.95, cz, contColors[(contN + lv) % contColors.length], rng() < 0.25 ? Math.PI / 2 : 0);
      }
      contN++;
      if (contN % 2 === 0) colliders.push({ x: cx, z: cz, hw: 5.8, hd: 2.6 });
    }

    bodies.box(26, 13, 14, -252, 6.5, 24, 0x9aa4ae);
    bodies.box(27, 1, 15, -252, 13.4, 24, 0x6a747e);
    glows.box(1.8, 5.4, 0.3, -252, 8.6, 16.8, 0xff4f4f);
    glows.box(5.4, 1.8, 0.3, -252, 8.6, 16.8, 0xff4f4f);
    colliders.push({ x: -252, z: 24, hw: 13.6, hd: 7.6 });

    {
      const b = new VN.GeoBatch();
      b.box(5.4, 2.7, 3.4, 24, 1.35, 33.5, 0x24303e);
      b.boxEuler(6, 0.2, 4, 24, 3, 33.5, 0xff5fd2, new THREE.Euler(0.06, 0, 0));
      b.box(4.4, 0.9, 0.3, 24, 1.7, 31.7, 0xffca7a);
      scene.add(b.build(VN.MAT.solid));
      colliders.push({ x: 24, z: 33.5, hw: 3, hd: 2 });
    }

    scene.add(bodies.build(VN.MAT.solid));
    scene.add(glows.build(VN.MAT.basic));

    const carSpawns = [];
    const carPalette = [0xd84f8a, 0x3f7ad8, 0xd8b13c, 0x53b04f, 0x8a5ed8, 0xd86a3c, 0xb0b6c0, 0x30363f, 0x7ad8d0, 0xc23c4f];
    const models = ['coupe', 'sedan', 'hatch', 'pickup', 'gt'];
    for (let i = 0; i < 17; i++) {
      const hz = H_ROADS[i % H_ROADS.length];
      carSpawns.push({
        x: -290 + ((i * 67) % 570), z: hz + (i % 2 ? ROAD_HALF + 2.6 : -ROAD_HALF - 2.6),
        heading: i % 2 ? -Math.PI / 2 : Math.PI / 2, parked: true,
        color: carPalette[i % carPalette.length], model: models[i % models.length],
      });
    }
    for (let i = 0; i < 14; i++) {
      const vx = V_ROADS[i % V_ROADS.length];
      carSpawns.push({
        x: vx + (i % 2 ? 3.6 : -3.6), z: -250 + ((i * 53) % 430),
        heading: i % 2 ? Math.PI : 0, parked: false,
        color: carPalette[(i + 4) % carPalette.length], model: models[(i + 2) % models.length],
      });
    }
    const gtSpawn = { x: 63.6, z: 44, heading: 0, color: 0x4b3fd8, model: 'gt' };
    const pedSpawns = [];
    for (let i = 0; i < 26; i++) {
      const hz = H_ROADS[i % H_ROADS.length];
      const vx = V_ROADS[(i * 3) % V_ROADS.length];
      pedSpawns.push({ x: vx + ((i * 37) % 90) - 45 + (i % 2 ? 10.5 : -10.5), z: hz + (i % 2 ? -10.5 : 10.5) });
    }

    return {
      scene, colliders, buildings, signs,
      counts: { buildings: buildings.length, streetlights: lamps.length, cars: carSpawns.length, peds: pedSpawns.length },
      carSpawns, pedSpawns, gtSpawn,
      H_ROADS, V_ROADS, ROAD_HALF, BOUNDS, WATER_Z,
      odileBooth: { x: 24, z: 30 },
      hospital: { x: -252, z: 36 },
      vaultDrop: { x: 150, z: 255 },
      heightsDrop: { x: 150, z: -120 },
      marketPickup: { x: -158, z: -66 },
      dockNine: { x: 232, z: 190 },
    };
  }

  return { generate, districtAt, H_ROADS, V_ROADS, BOUNDS };
})();
