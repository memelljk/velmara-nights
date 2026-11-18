// avatar.js — low-poly people built from boxes: Jax Rook (the player),
// pedestrians in district-flavoured outfits, dock thugs and police officers.
// One shared builder, walk-cycle limb swing, simple hit/death poses.
window.VN = window.VN || {};

VN.avatar = (function () {
  'use strict';

  var skinTones = [0xc98d64, 0x8a5a3b, 0xe8b48c, 0x6e4226, 0xd9a066];
  var shirts = [0xb03a5b, 0x2e6fb0, 0x3fa065, 0xc7a23a, 0x7050b8, 0xcccccc, 0x384048, 0xd06030];
  var pants = [0x23283a, 0x3a2e22, 0x1e3038, 0x4a4a52, 0x5c2430];

  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color })
    );
    m.position.set(x, y, z);
    return m;
  }

  // opts: {skin, shirt, pants, hat, hatColor, officer, thug}
  function buildPerson(opts) {
    var g = new THREE.Group();
    var skin = opts.skin, shirt = opts.shirt, pantsC = opts.pants;
    var torso = box(0.62, 0.72, 0.34, shirt, 0, 1.08, 0);
    var head = box(0.34, 0.38, 0.34, skin, 0, 1.66, 0);
    g.add(torso); g.add(head);
    if (opts.officer) {
      g.add(box(0.4, 0.1, 0.4, 0x1c2f66, 0, 1.9, 0));       // cap
      g.add(box(0.4, 0.06, 0.22, 0x1c2f66, 0, 1.84, 0.2));   // brim
      g.add(box(0.64, 0.14, 0.36, 0xd8b83a, 0, 1.32, 0));    // hi-vis band
    } else if (opts.hat) {
      g.add(box(0.42, 0.12, 0.42, opts.hatColor || 0x222222, 0, 1.9, 0));
    } else {
      g.add(box(0.36, 0.12, 0.36, 0x1a1410, 0, 1.9, 0));      // hair
    }
    if (opts.thug) g.add(box(0.36, 0.16, 0.36, 0x14141c, 0, 1.62, 0)); // mask band
    var armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.4, 1.38, 0); armR.position.set(0.4, 1.38, 0);
    armL.add(box(0.18, 0.66, 0.2, shirt, 0, -0.3, 0));
    armR.add(box(0.18, 0.66, 0.2, shirt, 0, -0.3, 0));
    g.add(armL); g.add(armR);
    var legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.16, 0.74, 0); legR.position.set(0.16, 0.74, 0);
    legL.add(box(0.22, 0.72, 0.24, pantsC, 0, -0.36, 0));
    legR.add(box(0.22, 0.72, 0.24, pantsC, 0, -0.36, 0));
    g.add(legL); g.add(legR);
    // gun (hidden unless aiming / armed role)
    var gun = box(0.08, 0.14, 0.42, 0x111116, 0, -0.58, 0.16);
    gun.visible = false;
    armR.add(gun);
    return { group: g, armL: armL, armR: armR, legL: legL, legR: legR, gun: gun, head: head };
  }

  function makeJax() {
    var p = buildPerson({ skin: 0xc98d64, shirt: 0x24304d, pants: 0x1c1c22, hat: false });
    // Jax's magenta jacket stripe — his silhouette in every screenshot.
    var stripe = box(0.64, 0.16, 0.36, 0xff2e88, 0, 1.22, 0);
    p.group.add(stripe);
    return p;
  }
  function makePed(rng) {
    return buildPerson({
      skin: skinTones[(rng() * skinTones.length) | 0],
      shirt: shirts[(rng() * shirts.length) | 0],
      pants: pants[(rng() * pants.length) | 0],
      hat: rng() < 0.3, hatColor: shirts[(rng() * shirts.length) | 0]
    });
  }
  function makeOfficer() {
    return buildPerson({ skin: 0xd9a066, shirt: 0x24407c, pants: 0x182238, officer: true });
  }
  function makeThug(rng) {
    return buildPerson({
      skin: skinTones[(rng() * skinTones.length) | 0],
      shirt: 0x30281e, pants: 0x22201c, thug: true
    });
  }

  // Walk cycle: swing limbs by phase; aim pose raises the right arm.
  function pose(p, phase, speed, aiming) {
    var s = Math.sin(phase) * Math.min(1, speed) * 0.75;
    p.legL.rotation.x = s;
    p.legR.rotation.x = -s;
    if (aiming) {
      p.armR.rotation.x = -Math.PI / 2 + 0.08;
      p.armL.rotation.x = -Math.PI / 2 + 0.3;
    } else {
      p.armL.rotation.x = -s * 0.8;
      p.armR.rotation.x = s * 0.8;
    }
  }
  function fall(p) { // death pose: flat on the back
    p.group.rotation.x = -Math.PI / 2;
    p.group.position.y = 0.25;
  }

  return { buildPerson: buildPerson, makeJax: makeJax, makePed: makePed, makeOfficer: makeOfficer, makeThug: makeThug, pose: pose, fall: fall };
})();
