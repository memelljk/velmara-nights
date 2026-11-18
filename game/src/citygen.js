// citygen.js — Velmara itself: a seeded, rain-slick neon port city.
// A grid of avenues, five districts with their own palettes and heights, canvas-
// painted road and building textures, neon signs, streetlights, market stalls,
// container yards, cranes, a working harbor edge and falling rain. Everything is
// generated from one seed, so a given seed always builds the same city.

export const AVENUES = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const ROAD_WIDTH = 15;
export const CITY_EXTENT = 234; // buildings stop here; the ring road is the limit
export const WATER_Z = 246;     // harbor water starts at this z

export function makeSeededRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = [
  { name: 'Neon Mile', test: (x, z) => Math.abs(x) < 30 && z > -130 && z < 90 },
  { name: 'Harbor', test: (x, z) => z >= 168 },
  { name: 'Old Market', test: (x, z) => x > 30 && x < 168 && z > -60 && z < 110 },
  { name: 'The Heights', test: (x, z) => z <= -110 },
  { name: 'Dockyards', test: (x, z) => x <= -78 && z > 40 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Midtown Velmara';
}

const DISTRICT_STYLE = {
  'Neon Mile': { base: ['#241a3e', '#2c1440', '#1c2440'], minH: 16, maxH: 38, neon: 0.85 },
  'Harbor': { base: ['#1d2733', '#232d26', '#2a2f38'], minH: 7, maxH: 16, neon: 0.15 },
  'Old Market': { base: ['#33231c', '#2e2118', '#3a2a1e'], minH: 8, maxH: 18, neon: 0.3 },
  'The Heights': { base: ['#1c2030', '#232838', '#191d2c'], minH: 30, maxH: 62, neon: 0.25 },
  'Dockyards': { base: ['#26221c', '#20242a', '#2b2620'], minH: 8, maxH: 20, neon: 0.1 },
  'Midtown Velmara': { base: ['#221e33', '#262038', '#1e2436'], minH: 14, maxH: 34, neon: 0.4 },
};

const NEON_COLORS = ['#ff3d8a', '#2ee6ff', '#ffc857', '#7b5cff', '#4dff9d', '#ff7847'];
const SIGN_WORDS = ['VELMARA', 'HOTEL SOLACE', 'NOODLE BAR', 'CLUB ORPHEE', 'PAWN & CO', 'BAR NINE',
  'KTV LUNA', 'RAMEN 24H', 'HOTEL MERIDIAN', 'CASINO RIALTO', 'GYM IRON', 'PHARMACY', 'TATTOO', 'CAFE MIRELLA'];

function makeGroundTexture(THREE, rng) {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const scale = S / (CITY_EXTENT * 2 + 60);
  const toPx = (v) => (v + CITY_EXTENT + 30) * scale;
  g.fillStyle = '#232030'; // sidewalk / block base
  g.fillRect(0, 0, S, S);
  // subtle block paving noise
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 900; i++) g.fillRect(rng() * S, rng() * S, 3, 3);
  const road = '#14121d';
  const half = (ROAD_WIDTH / 2) * scale;
  g.fillStyle = road;
  for (const a of AVENUES) {
    g.fillRect(toPx(a) - half, 0, half * 2, S);
    g.fillRect(0, toPx(a) - half, S, half * 2);
  }
  // wet sheen streaks on the asphalt
  g.fillStyle = 'rgba(120,140,255,0.05)';
  for (const a of AVENUES) {
    for (let i = 0; i < 26; i++) {
      g.fillRect(toPx(a) - half + rng() * half * 2, rng() * S, 2, 30 + rng() * 60);
    }
  }
  // lane dashes
  g.fillStyle = '#c8b25a';
  const dash = 14, gap = 12;
  for (const a of AVENUES) {
    for (let p = 0; p < S; p += dash + gap) {
      g.fillRect(toPx(a) - 1, p, 2, dash);
      g.fillRect(p, toPx(a) - 1, dash, 2);
    }
  }
  // crosswalks at intersections
  g.fillStyle = 'rgba(230,230,240,0.5)';
  for (const ax of AVENUES) for (const az of AVENUES) {
    for (let s = -3; s <= 3; s++) {
      g.fillRect(toPx(ax) + s * 4 * scale / 2 - 2, toPx(az) - half - 4, 3, 3);
      g.fillRect(toPx(ax) + s * 4 * scale / 2 - 2, toPx(az) + half + 1, 3, 3);
    }
  }
  // harbor apron
  g.fillStyle = '#1a2027';
  g.fillRect(0, toPx(232), S, S - toPx(232));
  g.fillStyle = '#ffc857';
  for (let p = 0; p < S; p += 46) g.fillRect(p, toPx(238), 26, 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function makeBuildingTexture(THREE, rng, baseColor, neonChance) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 10);
  const lit = ['#ffd98a', '#bfe9ff', '#ffb3d1', '#d8ffe9'];
  for (let y = 16; y < 244; y += 16) {
    for (let x = 10; x < 118; x += 18) {
      const on = rng() < 0.42;
      g.fillStyle = on ? lit[Math.floor(rng() * lit.length)] : 'rgba(10,10,20,0.65)';
      g.globalAlpha = on ? 0.55 + rng() * 0.45 : 1;
      g.fillRect(x, y, 11, 9);
    }
  }
  g.globalAlpha = 1;
  if (rng() < neonChance) {
    const color = NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)];
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillRect(52 + rng() * 10, 20, 9, 120 + rng() * 80);
    g.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function makeSignTexture(THREE, word, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(5,2,12,0.92)';
  g.fillRect(0, 0, 256, 64);
  g.font = '900 30px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(word, 128, 34);
  g.shadowBlur = 6;
  g.fillText(word, 128, 34);
  return new THREE.CanvasTexture(cv);
}

function makeWaterTexture(THREE, rng) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a2436';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,200,255,0.25)';
  for (let i = 0; i < 22; i++) {
    g.beginPath();
    const y = rng() * 128;
    g.moveTo(rng() * 60, y);
    g.lineTo(40 + rng() * 80, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 3);
  return tex;
}

export function buildCity(THREE, scene, rng) {
  const city = {
    colliders: [],       // {minX,maxX,minZ,maxZ} for buildings & big props
    parkedSpots: [],     // places parked cars may sit {x,z,heading}
    signs: [],           // flickering sign materials
    waterMat: null,
    rain: null,
    rainVel: null,
    boothPos: new THREE.Vector3(14, 0, 34),
    hospitalPos: new THREE.Vector3(-140, 0, -140),
    vaultPos: new THREE.Vector3(64, 0, 224),
    raceStartPos: new THREE.Vector3(-44, 0, -44),
    courierPos: new THREE.Vector3(84, 0, 30),
    marketPos: new THREE.Vector3(104, 0, 26),
    dockCrewPos: new THREE.Vector3(-150, 0, 120),
    update: null,
  };

  // ---- ground & water
  const groundSize = CITY_EXTENT * 2 + 60;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(THREE, rng) })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  city.waterMat = new THREE.MeshLambertMaterial({
    map: makeWaterTexture(THREE, rng), transparent: true, opacity: 0.92, color: 0x9fd8ff,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, 90), city.waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, WATER_Z + 44);
  scene.add(water);

  // ---- buildings
  const geoCache = new Map();
  const boxGeo = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  };
  const texPool = [];
  for (const style of Object.values(DISTRICT_STYLE)) {
    for (const base of style.base) {
      for (let v = 0; v < 2; v++) texPool.push(makeBuildingTexture(THREE, rng, base, style.neon));
    }
  }
  const matPool = texPool.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x11101a });

  const signMats = SIGN_WORDS.map((w, i) => {
    const color = NEON_COLORS[i % NEON_COLORS.length];
    const mat = new THREE.MeshBasicMaterial({ map: makeSignTexture(THREE, w, color), side: THREE.DoubleSide });
    city.signs.push(mat);
    return mat;
  });
  let signIdx = 0;
  const addSign = (x, y, z, rotY, w = 13) => {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), signMats[signIdx++ % signMats.length]);
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    scene.add(sign);
  };

  const halfRoad = ROAD_WIDTH / 2;
  let buildingCount = 0;
  for (let bi = 0; bi < AVENUES.length - 1; bi++) {
    for (let bj = 0; bj < AVENUES.length - 1; bj++) {
      const x0 = AVENUES[bi] + halfRoad, x1 = AVENUES[bi + 1] - halfRoad;
      const z0 = AVENUES[bj] + halfRoad, z1 = AVENUES[bj + 1] - halfRoad;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      const style = DISTRICT_STYLE[district];
      // a few open lots: market plaza, booth plaza, parking, container yard floor
      const isMarketPlaza = Math.abs(cx - 104) < 4 && Math.abs(cz - 26) < 4;
      const isBoothPlaza = Math.abs(cx - 26) < 4 && Math.abs(cz - 26) < 4;
      const isParking = rng() < 0.1 && district !== 'The Heights';
      if (isMarketPlaza || isBoothPlaza) continue;
      if (isParking) {
        for (let s = 0; s < 3; s++) {
          city.parkedSpots.push({
            x: x0 + 7 + s * 11, z: cz + (rng() < 0.5 ? -8 : 8),
            heading: rng() < 0.5 ? 0 : Math.PI,
          });
        }
        continue;
      }
      const sub = 2;
      const cellW = (x1 - x0) / sub, cellD = (z1 - z0) / sub;
      for (let si = 0; si < sub; si++) {
        for (let sj = 0; sj < sub; sj++) {
          if (rng() < 0.12) { // alley gap with a parked car sometimes
            if (rng() < 0.5) city.parkedSpots.push({ x: x0 + cellW * (si + 0.5), z: z0 + cellD * (sj + 0.5), heading: rng() * Math.PI });
            continue;
          }
          const w = cellW * (0.72 + rng() * 0.2);
          const d = cellD * (0.72 + rng() * 0.2);
          const h = style.minH + rng() * (style.maxH - style.minH);
          const bx = x0 + cellW * (si + 0.5), bz = z0 + cellD * (sj + 0.5);
          const mat = matPool[Math.floor(rng() * matPool.length)];
          const mesh = new THREE.Mesh(boxGeo(Math.round(w), Math.round(h), Math.round(d)),
            [roofMat, roofMat, roofMat, roofMat, mat, mat]);
          mesh.position.set(bx, h / 2, bz);
          scene.add(mesh);
          buildingCount++;
          city.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
          // rooftop box detail
          if (rng() < 0.5) {
            const hut = new THREE.Mesh(boxGeo(4, 2, 4), roofMat);
            hut.position.set(bx + (rng() - 0.5) * w * 0.4, h + 1, bz + (rng() - 0.5) * d * 0.4);
            scene.add(hut);
          }
          // street-facing neon sign on the Mile and scattered elsewhere
          const nearMile = Math.abs(bx) < 44;
          if ((nearMile && rng() < 0.75) || rng() < style.neon * 0.3) {
            const sy = 4 + rng() * Math.min(10, h - 5);
            if (rng() < 0.5) {
              const side = rng() < 0.5 ? -1 : 1;
              addSign(bx + side * (w / 2 + 0.15), sy, bz, side > 0 ? Math.PI / 2 : -Math.PI / 2);
            } else {
              const side = rng() < 0.5 ? -1 : 1;
              addSign(bx, sy, bz + side * (d / 2 + 0.15), side > 0 ? 0 : Math.PI);
            }
          }
          // curb parking along the street edge
          if (rng() < 0.34) {
            city.parkedSpots.push({
              x: bx + (rng() < 0.5 ? -(w / 2 + 4.6) : w / 2 + 4.6), z: bz,
              heading: Math.PI / 2,
            });
          }
        }
      }
    }
  }
  city.buildingCount = buildingCount;

  buildSpecialPlaces(THREE, scene, rng, city, boxGeo);
  buildStreetlights(THREE, scene, city);
  buildRain(THREE, scene, city);
  city.update = makeCityUpdater(city);
  return city;
}

function buildSpecialPlaces(THREE, scene, rng, city, boxGeo) {
  const addBox = (w, h, d, x, y, z, color, collide = true) => {
    const m = new THREE.Mesh(boxGeo(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    scene.add(m);
    if (collide) city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };

  // Odile's booth on the Neon Mile: a striped kiosk with a glowing counter.
  const booth = new THREE.Group();
  const kiosk = new THREE.Mesh(boxGeo(5, 3.2, 4), new THREE.MeshLambertMaterial({ color: 0x3a2358 }));
  kiosk.position.y = 1.6;
  booth.add(kiosk);
  const awning = new THREE.Mesh(boxGeo(6, 0.3, 5), new THREE.MeshBasicMaterial({ color: 0xff3d8a }));
  awning.position.y = 3.4;
  booth.add(awning);
  const counterGlow = new THREE.Mesh(boxGeo(4.4, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: 0x2ee6ff }));
  counterGlow.position.set(0, 1.15, -2.1);
  booth.add(counterGlow);
  booth.position.copy(city.boothPos);
  scene.add(booth);
  city.colliders.push({ minX: city.boothPos.x - 2.5, maxX: city.boothPos.x + 2.5, minZ: city.boothPos.z - 2, maxZ: city.boothPos.z + 2 });

  // St. Mirella Hospital — respawn point, pale block with a red cross sign.
  addBox(26, 14, 16, -156, 7, -156, 0xcfd4de);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff4545 });
  const c1 = new THREE.Mesh(boxGeo(5, 1.4, 0.3), crossMat); c1.position.set(-156, 11, -147.8); scene.add(c1);
  const c2 = new THREE.Mesh(boxGeo(1.4, 5, 0.3), crossMat); c2.position.set(-156, 11, -147.8); scene.add(c2);

  // The Harbor Vault — a squat stronghouse the finale robs.
  addBox(20, 10, 14, 64, 5, 224, 0x4a4438);
  const vaultDoor = new THREE.Mesh(boxGeo(6, 7, 0.4), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
  vaultDoor.position.set(64, 3.5, 216.8);
  scene.add(vaultDoor);

  // Old Market stalls in the plaza.
  const stallColors = [0xff3d8a, 0x2ee6ff, 0xffc857, 0x4dff9d, 0xff7847, 0x7b5cff];
  for (let i = 0; i < 10; i++) {
    const sx = 88 + (i % 5) * 8, sz = 14 + Math.floor(i / 5) * 16;
    addBox(4.4, 1.1, 2.6, sx, 0.55, sz, 0x5a4230);
    const canopy = new THREE.Mesh(boxGeo(5.2, 0.25, 3.4), new THREE.MeshLambertMaterial({ color: stallColors[i % stallColors.length] }));
    canopy.position.set(sx, 2.5, sz);
    scene.add(canopy);
  }

  // Dockyards: stacked shipping containers and two cranes.
  const contColors = [0xb84a39, 0x3968b8, 0x3f9e58, 0xc7a23a, 0x7450b8, 0x3aa6a0];
  for (let i = 0; i < 42; i++) {
    const cxp = -196 + rng() * 100, czp = 66 + rng() * 110;
    if (Math.abs(cxp - city.dockCrewPos.x) < 12 && Math.abs(czp - city.dockCrewPos.z) < 12) continue;
    const lvl = rng() < 0.4 ? 1 : 0;
    addBox(9, 2.8, 3.6, cxp, 1.4 + lvl * 2.8, czp, contColors[Math.floor(rng() * contColors.length)]);
  }
  for (const [cxp, czp] of [[-120, 210], [30, 214]]) {
    addBox(2.4, 26, 2.4, cxp, 13, czp, 0x8a6d2f);
    const jib = addBox(30, 2, 2, cxp + 10, 26, czp, 0x8a6d2f, false);
    jib.rotation.z = 0.06;
    addBox(0.4, 10, 0.4, cxp + 22, 20, czp, 0x555560, false);
  }

  // Harbor piers reaching into the water.
  for (const px of [-120, -30, 60, 150]) {
    addBox(8, 1, 34, px, 0.2, 258, 0x3a3f47, false);
  }

  // Glowing objective beacon column (moved around by the story module).
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.3, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 60, 12, 1, true), beaconMat);
  beacon.position.set(city.boothPos.x, 30, city.boothPos.z);
  scene.add(beacon);
  city.beacon = beacon;
  city.beaconMat = beaconMat;
}

function buildStreetlights(THREE, scene, city) {
  const positions = [];
  for (const a of AVENUES) {
    for (let p = -CITY_EXTENT + 8; p < CITY_EXTENT; p += 26) {
      positions.push([a - 9.4, p + 6], [a + 9.4, p - 6], [p + 6, a - 9.4], [p - 6, a + 9.4]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c38 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);
  const headGeo = new THREE.BoxGeometry(1.5, 0.22, 0.5);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach(([x, z], i) => {
    m.makeTranslation(x, 3.2, z);
    poles.setMatrixAt(i, m);
    m.makeTranslation(x, 6.5, z);
    heads.setMatrixAt(i, m);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  scene.add(poles);
  scene.add(heads);
  city.streetlightCount = positions.length;
}

function buildRain(THREE, scene, city) {
  const COUNT = 1700;
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 190;
    pos[i * 3 + 1] = Math.random() * 55;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 190;
    vel[i] = 34 + Math.random() * 22;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x9fc8ff, size: 0.55, transparent: true, opacity: 0.55 });
  const rain = new THREE.Points(geo, mat);
  rain.frustumCulled = false;
  scene.add(rain);
  city.rain = rain;
  city.rainVel = vel;
}

function makeCityUpdater(city) {
  let flicker = 0;
  return function updateCity(dt, t, focusPos) {
    // water shimmer
    if (city.waterMat) city.waterMat.map.offset.set(t * 0.013, Math.sin(t * 0.4) * 0.02);
    // neon signs occasionally buzz
    flicker -= dt;
    if (flicker <= 0) {
      flicker = 0.12 + Math.random() * 0.5;
      const mat = city.signs[Math.floor(Math.random() * city.signs.length)];
      if (mat) mat.color.setScalar(Math.random() < 0.22 ? 0.35 : 1);
    }
    // beacon pulse
    if (city.beaconMat) city.beaconMat.opacity = 0.22 + Math.sin(t * 3) * 0.1;
    if (city.beacon) city.beacon.rotation.y = t * 0.7;
    // rain falls around the camera focus and wraps
    if (city.rain && focusPos) {
      const arr = city.rain.geometry.attributes.position.array;
      const vel = city.rainVel;
      for (let i = 0; i < vel.length; i++) {
        let y = arr[i * 3 + 1] - vel[i] * dt;
        if (y < 0) {
          y = 50 + Math.random() * 6;
          arr[i * 3] = focusPos.x + (Math.random() - 0.5) * 190;
          arr[i * 3 + 2] = focusPos.z + (Math.random() - 0.5) * 190;
        }
        arr[i * 3 + 1] = y;
        arr[i * 3] += dt * 3.5; // wind slant
      }
      city.rain.geometry.attributes.position.needsUpdate = true;
    }
  };
}

/** Circle-vs-buildings collision: pushes (x,z) out of every AABB it overlaps. */
export function collideWithBuildings(city, pos, radius) {
  for (const c of city.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest exit
        const exits = [
          [pos.x - c.minX, -1, 0], [c.maxX - pos.x, 1, 0],
          [pos.z - c.minZ, 0, -1], [c.maxZ - pos.z, 0, 1],
        ].sort((a, b) => a[0] - b[0]);
        const [, ex, ez] = exits[0];
        if (ex !== 0) pos.x = ex < 0 ? c.minX - radius : c.maxX + radius;
        if (ez !== 0) pos.z = ez < 0 ? c.minZ - radius : c.maxZ + radius;
      }
      return true;
    }
  }
  return false;
}
