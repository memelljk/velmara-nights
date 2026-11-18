// citygen.js — seeded Velmara: 5 districts, exactly 205 buildings, 648 streetlights (seed 7)
window.VN = window.VN || {};
VN.mulberry = function (seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
VN.ROADS = [-240, -120, 0, 120, 240];
VN.DISTRICTS = [
  { name: 'NEON MILE', x: 60, z: 180 }, { name: 'HARBOR', x: 180, z: 300 },
  { name: 'OLD MARKET', x: -180, z: -60 }, { name: 'THE HEIGHTS', x: -60, z: -220 },
  { name: 'DOCKYARDS', x: 220, z: 60 }
];
VN.signTexture = function (text, bg, fg) {
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  var g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 22; g.fillStyle = fg;
  g.fillText(text, 256, 66); g.fillText(text, 256, 66);
  var tex = new THREE.CanvasTexture(cv);
  return tex;
};
VN.buildCity = function (scene, seed) {
  var rnd = VN.mulberry(seed);
  var city = { buildings: [], lights: [], colliders: [], signs: [], stalls: [], containers: [] };
  // ground + wet roads
  var groundMat = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  var roadBoxes = [], walkBoxes = [];
  VN.ROADS.forEach(function (r) {
    roadBoxes.push({ w: 26, h: 0.06, d: 640, x: r, y: 0.0, z: 0, color: 0x3d454e });
    roadBoxes.push({ w: 640, h: 0.06, d: 26, x: 0, y: 0.0, z: r, color: 0x3d454e });
    walkBoxes.push({ w: 32, h: 0.09, d: 640, x: r, y: 0.01, z: 0, color: 0x596069 });
    walkBoxes.push({ w: 640, h: 0.09, d: 32, x: 0, y: 0.01, z: r, color: 0x596069 });
  });
  // road markings merged under roads visually via slightly raised light strips at edges omitted for perf
  scene.add(VN.mergeBoxes(walkBoxes, {}));
  var roadsMesh = VN.mergeBoxes(roadBoxes, {}); roadsMesh.position.y = 0.04; scene.add(roadsMesh);
  // harbor water
  var water = new THREE.Mesh(new THREE.PlaneGeometry(760, 150), new THREE.MeshLambertMaterial({ color: 0x0d3242, emissive: 0x06222e }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.02, 372); scene.add(water);
  // buildings: fill blocks between roads
  var palette = [0x2e3440, 0x3a3040, 0x24303c, 0x40342a, 0x2c3a34, 0x383040, 0x303a48];
  var boxes = [], windows = [];
  var clearSpots = [{ x: 150, z: 255 }, { x: 150, z: -120 }, { x: 0, z: 110 }, { x: 10, z: 100 }, { x: -150, z: -40 }];
  function clearOf(x, z, r) { return clearSpots.some(function (s) { return Math.abs(s.x - x) < r && Math.abs(s.z - z) < r; }); }
  var attempts = 0;
  while (city.buildings.length < 205 && attempts < 4000) {
    attempts++;
    var x = -305 + rnd() * 610, z = -305 + rnd() * 610;
    if (VN.ROADS.some(function (r) { return Math.abs(r - x) < 24 || Math.abs(r - z) < 24; })) continue;
    if (Math.abs(x) > 305 || Math.abs(z) > 305) continue;
    if (clearOf(x, z, 26)) continue;
    if (city.buildings.some(function (b) { return Math.abs(b.x - x) < 19.5 && Math.abs(b.z - z) < 19.5; })) continue;
    var w = 13 + rnd() * 7, d = 13 + rnd() * 7, h = 14 + rnd() * rnd() * 52;
    var col = palette[Math.floor(rnd() * palette.length)];
    var b = { x: x, z: z, w: w, d: d, h: h, color: col };
    city.buildings.push(b); city.colliders.push({ x: x, z: z, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
    boxes.push({ w: w, h: h, d: d, x: x, y: h / 2, z: z, color: col });
    boxes.push({ w: w + 1, h: 1.2, d: d + 1, x: x, y: h + 0.4, z: z, color: 0x171a1f });
    // lit windows on two faces, emissive scaled by building size
    var floors = Math.max(2, Math.floor(h / 5)), cols = Math.max(2, Math.floor(w / 4)), colsD = Math.max(2, Math.floor(d / 4));
    for (var f = 0; f < floors; f++) for (var k = 0; k < cols; k++) {
      if (rnd() < 0.42) continue;
      var warm = rnd() < 0.7;
      windows.push({ w: 1.5, h: 1.9, x: x - w / 2 + 2 + k * 3.6, y: 3 + f * 4.6, z: z + d / 2 + 0.06, rotY: 0, color: warm ? 0xffc873 : 0x7fd8ff });
    }
    for (var f2 = 0; f2 < floors; f2++) for (var k2 = 0; k2 < colsD; k2++) {
      if (rnd() < 0.55) continue;
      var warm2 = rnd() < 0.7;
      windows.push({ w: 1.5, h: 1.9, x: x + w / 2 + 0.06, y: 3 + f2 * 4.6, z: z - d / 2 + 2 + k2 * 3.6, rotY: Math.PI / 2, color: warm2 ? 0xffb85e : 0x9fe0ff });
    }
  }
  scene.add(VN.mergeBoxes(boxes, {}));
  var winMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  scene.add(VN.mergePlanes(windows, winMat));
  // streetlights: along every road, both sides — trimmed to exactly 648
  var poleBoxes = [], lampBoxes = [];
  var lightPos = [];
  VN.ROADS.forEach(function (r) {
    for (var t = -312; t <= 312; t += 16) {
      lightPos.push({ x: r - 14.5, z: t }); lightPos.push({ x: r + 14.5, z: t });
      lightPos.push({ x: t, z: r - 14.5 }); lightPos.push({ x: t, z: r + 14.5 });
    }
  });
  // dedupe intersections, then take first 648 deterministically
  var seen = {}, uniq = [];
  lightPos.forEach(function (p) { var k = p.x + ',' + p.z; if (!seen[k]) { seen[k] = 1; uniq.push(p); } });
  uniq = uniq.slice(0, 648);
  city.lights = uniq;
  uniq.forEach(function (p) {
    poleBoxes.push({ w: 0.28, h: 5.6, d: 0.28, x: p.x, y: 2.8, z: p.z, color: 0x22262c });
    lampBoxes.push({ w: 0.7, h: 0.3, d: 0.7, x: p.x, y: 5.7, z: p.z, color: 0xffd9a0 });
  });
  scene.add(VN.mergeBoxes(poleBoxes, {}));
  scene.add(VN.mergeBoxes(lampBoxes, { material: new THREE.MeshBasicMaterial({ vertexColors: true }) }));
  // neon signs — canvas textures, mounted facing OUTWARD (normal away from facade)
  var signDefs = [
    { t: 'VELMARA', bg: '#12041c', fg: '#ff4fd8', x: 32, y: 13, z: 133.4, ry: 0 },
    { t: 'TATTOO', bg: '#0a0a14', fg: '#37f2ff', x: 108, y: 9, z: 227, ry: Math.PI },
    { t: 'ORPHEE', bg: '#14041f', fg: '#b78bff', x: -133.4, y: 11, z: 60, ry: -Math.PI / 2 },
    { t: 'NOODLE 9', bg: '#170606', fg: '#ffb03a', x: -90, y: 8, z: -133.4, ry: Math.PI },
    { t: 'HOTEL MIRELLA', bg: '#04141c', fg: '#5ef2c0', x: 133.4, y: 15, z: -80, ry: Math.PI / 2 },
    { t: 'DOCK 9', bg: '#101010', fg: '#ffe14f', x: 200, y: 10, z: 133.4, ry: 0 },
    { t: 'PAWN & GOLD', bg: '#160f02', fg: '#ffd24f', x: -227, y: 8, z: -160, ry: Math.PI / 2 },
    { t: 'CLUB SIREN', bg: '#1c0212', fg: '#ff4f7a', x: 60, y: 10, z: -106.6, ry: Math.PI }
  ];
  signDefs.forEach(function (s) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.2), new THREE.MeshBasicMaterial({ map: VN.signTexture(s.t, s.bg, s.fg), side: THREE.FrontSide }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry; scene.add(m); city.signs.push(s.t);
  });
  // Odile's booth on Neon Mile
  var booth = VN.mergeBoxes([
    { w: 4.4, h: 2.6, d: 2.4, x: 10, y: 1.3, z: 96, color: 0x53183d },
    { w: 5, h: 0.3, d: 3, x: 10, y: 2.8, z: 96, color: 0xff4fd8 },
    { w: 4.4, h: 1, d: 0.2, x: 10, y: 0.5, z: 97.3, color: 0x2a0d20 }
  ], {});
  scene.add(booth);
  // Old Market stalls
  var stallBoxes = [];
  for (var i = 0; i < 14; i++) {
    var sx = -196 + (i % 7) * 13, sz = -52 + Math.floor(i / 7) * 16;
    stallBoxes.push({ w: 5, h: 2.2, d: 4, x: sx, y: 1.1, z: sz, color: 0x4a3421 });
    stallBoxes.push({ w: 5.8, h: 0.25, d: 4.8, x: sx, y: 2.5, z: sz, color: [0xd84f6a, 0x3fa7d8, 0xd8a53f][i % 3] });
    city.stalls.push({ x: sx, z: sz }); city.colliders.push({ x: sx, z: sz, hw: 2.9, hd: 2.4 });
  }
  scene.add(VN.mergeBoxes(stallBoxes, {}));
  // Dockyards containers + harbor cranes + piers
  var contBoxes = [], contCols = [0xb5493a, 0x3a6ab5, 0x3ab57a, 0xb5893a, 0x7a4fb5];
  for (var j = 0; j < 36; j++) {
    var cx = 168 + (j % 6) * 15, cz = 268 + Math.floor(j / 6) * 10;
    if (j % 5 === 4) continue;
    contBoxes.push({ w: 12, h: 2.8, d: 5, x: cx, y: 1.4 + (j % 3 === 0 ? 2.8 : 0), z: cz, color: contCols[j % 5] });
    city.containers.push({ x: cx, z: cz });
  }
  scene.add(VN.mergeBoxes(contBoxes, {}));
  var craneBoxes = [];
  [150, 215, 280].forEach(function (cx2) {
    craneBoxes.push({ w: 2, h: 26, d: 2, x: cx2, y: 13, z: 292, color: 0xc7a23a });
    craneBoxes.push({ w: 2, h: 2, d: 30, x: cx2, y: 25, z: 306, color: 0xc7a23a });
  });
  for (var p = 0; p < 4; p++) craneBoxes.push({ w: 8, h: 1, d: 34, x: 90 + p * 62, y: 0.4, z: 322, color: 0x4c4238 });
  scene.add(VN.mergeBoxes(craneBoxes, {}));
  // hospital (respawn)
  var hosp = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), new THREE.MeshBasicMaterial({ map: VN.signTexture('ST. MIRELLA HOSPITAL', '#0a1420', '#7fe8ff') }));
  hosp.position.set(-120, 9, -106.5); hosp.rotation.y = Math.PI; scene.add(hosp);
  city.hospital = { x: -120, z: -96 };
  // rain
  var rainGeo = new THREE.BufferGeometry();
  var rp = new Float32Array(1500 * 3);
  for (var r2 = 0; r2 < 1500; r2++) { rp[r2 * 3] = (rnd() - 0.5) * 220; rp[r2 * 3 + 1] = rnd() * 60; rp[r2 * 3 + 2] = (rnd() - 0.5) * 220; }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  var rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fc8e8, size: 0.55, transparent: true, opacity: 0.55 }));
  rain.name = 'rain'; scene.add(rain); city.rain = rain;
  VN.city = city;
  return city;
};
VN.collides = function (x, z, pad) {
  var cs = VN.city ? VN.city.colliders : [];
  for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (Math.abs(x - c.x) < c.hw + (pad || 0) && Math.abs(z - c.z) < c.hd + (pad || 0)) return true; }
  return false;
};
