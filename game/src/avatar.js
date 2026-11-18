// avatar.js — Jax Rook, the getaway driver, and the shared low-poly
// humanoid rig that pedestrians, officers, thugs and Odile are built from.
// On-foot movement is third-person: WASD relative to the camera yaw, Shift
// to run, limbs swinging with the stride, collisions against the city's
// building boxes.
window.V = window.V || {};
(function () {
  'use strict';

  function limb(w, h, d, colour, px, py) {
    var pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    var geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, -h / 2, 0);
    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colour }));
    pivot.add(mesh);
    return pivot;
  }

  // A ~1.85 m figure: legs and arms pivot at hip and shoulder so the walk
  // cycle is just two sine waves. Torso, head, cap and skirt never move
  // relative to each other, so they are baked into ONE vertex-coloured
  // mesh; only the four limbs and the pistol stay separate. The right
  // hand can carry a pistol.
  function buildHumanoid(opts) {
    var g = new THREE.Group();
    var skin = opts.skin || 0xc89878;
    var legColour = opts.pants || opts.dress || 0x23242e;
    var legL = limb(0.24, 0.86, 0.27, legColour, -0.15, 0.88);
    var legR = limb(0.24, 0.86, 0.27, legColour, 0.15, 0.88);
    var upper = new V.Builder();
    upper.box(0.64, 0.74, 0.36, 0, 1.26, 0, 0, opts.shirt, null);       // torso
    upper.box(0.35, 0.4, 0.35, 0, 1.84, 0, 0, skin, null);              // head
    if (opts.cap) {
      upper.box(0.4, 0.12, 0.42, 0, 2.06, 0, 0, opts.cap, null);
      upper.box(0.38, 0.05, 0.24, 0, 2.0, 0.3, 0, opts.cap, null);      // brim
    }
    if (opts.dress) upper.box(0.58, 0.5, 0.44, 0, 0.82, 0, 0, opts.dress, null);
    var torso = upper.build(new THREE.MeshLambertMaterial({ vertexColors: true }));
    var armL = limb(0.19, 0.7, 0.21, opts.shirt, -0.42, 1.56);
    var armR = limb(0.19, 0.7, 0.21, opts.shirt, 0.42, 1.56);
    var head = torso;
    g.add(legL); g.add(legR); g.add(torso); g.add(armL); g.add(armR);
    var pistol = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.16, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x17181c })
    );
    pistol.position.set(0, -0.68, 0.14);
    pistol.visible = false;
    armR.add(pistol);
    return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, head: head, pistol: pistol };
  }

  function animateHumanoid(h, phase, amount) {
    var s = Math.sin(phase) * 0.62 * amount;
    h.legL.rotation.x = s;
    h.legR.rotation.x = -s;
    h.armL.rotation.x = -s * 0.8;
    if (!h.aiming) h.armR.rotation.x = s * 0.8;
    h.group.position.y = Math.abs(Math.cos(phase)) * 0.05 * amount;
  }

  // --- the hero -----------------------------------------------------------
  var hero = null;

  function createHero(scene, start) {
    var rig = buildHumanoid({ shirt: 0x1f7a78, pants: 0x23242e, skin: 0xb98a64, cap: 0x14202c });
    rig.group.position.set(start.x, 0, start.z);
    scene.add(rig.group);
    hero = {
      rig: rig,
      group: rig.group,
      x: start.x, z: start.z,
      ry: Math.PI,               // facing the Neon Mile road
      walkPhase: 0,
      moving: false,
      inCar: null,
      health: 100,
      speedNow: 0
    };
    return hero;
  }

  // moveInput: {x: strafe -1..1, z: forward -1..1} in camera space.
  function updateHero(dt, moveInput, camYaw, running, city) {
    if (!hero || hero.inCar) return;
    var mx = moveInput.x, mz = moveInput.z;
    var len = Math.sqrt(mx * mx + mz * mz);
    hero.moving = len > 0.05;
    if (hero.moving) {
      mx /= Math.max(1, len); mz /= Math.max(1, len);
      var speed = running ? 8.8 : 5.0;
      hero.speedNow = speed;
      // camera-space input to world space
      var sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      var wx = (mx * cos - mz * sin);
      var wz = (-mz * cos - mx * sin);
      // note: forward on screen is -z of the camera frame
      var targetRy = Math.atan2(wx, wz);
      hero.ry += V.angleDelta(hero.ry, targetRy) * Math.min(1, dt * 14);
      hero.x += Math.sin(hero.ry) * speed * dt * Math.min(1, len + 0.3);
      hero.z += Math.cos(hero.ry) * speed * dt * Math.min(1, len + 0.3);
      var fixed = V.collideCircle(city, hero.x, hero.z, 0.55);
      hero.x = fixed.x; hero.z = fixed.z;
      hero.walkPhase += dt * speed * 1.55;
    } else {
      hero.speedNow = 0;
      hero.walkPhase += dt * 1.4; // idle breathing sway
    }
    hero.group.position.set(hero.x, 0, hero.z);
    hero.group.rotation.y = hero.ry;
    animateHumanoid(hero.rig, hero.walkPhase, hero.moving ? 1 : 0.08);
    hero.rig.aiming = !!hero.aiming;
    if (hero.rig.aiming) hero.rig.armR.rotation.x = -1.35;
  }

  V.buildHumanoid = buildHumanoid;
  V.animateHumanoid = animateHumanoid;
  V.createHero = createHero;
  V.updateHero = updateHero;
  V.hero = function () { return hero; };
})();
