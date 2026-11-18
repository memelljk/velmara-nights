// avatar.js - low-poly humanoids for Velmara Nights. Torso, head and arms
// are baked into ONE vertex-coloured mesh per person; only the legs stay
// separate so they can swing. Every figure gets a leg colour: when a caller
// forgets `pants`, it is derived from the body colour (a missing field once
// produced a THREE colour warning - never again).
window.VN = window.VN || {};

VN.makeHuman = function (opts) {
  opts = opts || {};
  const skin = opts.skin != null ? opts.skin : 0xc89878;
  const body = opts.body != null ? opts.body : 0x3a6ad8;
  // Default pants: a darkened shade of the body colour.
  const pants = opts.pants != null ? opts.pants : new THREE.Color(body).multiplyScalar(0.45).getHex();
  const hair = opts.hair != null ? opts.hair : 0x1c1410;

  const batch = new VN.GeoBatch();
  batch.box(0.62, 0.78, 0.34, 0, 1.18, 0, body);          // torso
  batch.box(0.34, 0.38, 0.34, 0, 1.76, 0, skin);          // head
  batch.box(0.36, 0.12, 0.36, 0, 1.98, 0, hair);          // hair cap
  batch.box(0.16, 0.62, 0.18, -0.42, 1.2, 0, body);       // arms, merged in
  batch.box(0.16, 0.62, 0.18, 0.42, 1.2, 0, body);
  if (opts.dress) batch.box(0.7, 0.5, 0.42, 0, 0.82, 0, body); // dress skirt
  const core = batch.build(VN.MAT.solid);

  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  legGeo.translate(0, -0.36, 0);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.78, 0);
  const legR = new THREE.Mesh(legGeo, legMat.clone());
  legR.position.set(0.16, 0.78, 0);

  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.46),
    new THREE.MeshLambertMaterial({ color: 0x15171c })
  );
  gun.position.set(0.44, 1.28, 0.24);
  gun.visible = false;

  const group = new THREE.Group();
  group.add(core, legL, legR, gun);
  return {
    group, legL, legR, gun,
    walkPhase: Math.random() * 6,
    setGun(v) { gun.visible = !!v; },
    animate(dt, speed) {
      this.walkPhase += dt * (4 + speed * 2.2);
      const s = Math.sin(this.walkPhase) * Math.min(1, speed * 0.35);
      legL.rotation.x = s * 0.8;
      legR.rotation.x = -s * 0.8;
    },
  };
};

// The hero, Jax Rook: teal jacket, dark jeans.
VN.makeJax = function () {
  const h = VN.makeHuman({ skin: 0xb87f58, body: 0x1f7a72, pants: 0x23262e, hair: 0x0e0c0a });
  h.isJax = true;
  return h;
};

// Odile Vane, the fixer: magenta dress - pants derived from the dress colour.
VN.makeOdile = function () {
  const h = VN.makeHuman({ skin: 0xd8a878, body: 0xc23c7a, hair: 0x2a1616, dress: true });
  h.isOdile = true;
  return h;
};
