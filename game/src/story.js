// story.js — the story of Jax Rook and Odile Vane: six missions with
// dialogue, plus checkpoint races and courier runs as repeatable earners.
// A mission is a list of steps (go somewhere, pick up, steal, clear, hold,
// escape); the active step drives the HUD objective banner, the world
// marker beacon and the minimap blip.
window.V = window.V || {};
(function () {
  'use strict';

  var rng = V.makeRng(5150);
  var story = {
    nextMission: 0,       // index into MISSIONS
    active: null,         // live mission instance
    storyDone: false,
    dialogue: null,       // {lines, idx, onDone}
    race: null,
    rep: 0
  };
  var marker = null, markerRing = null;
  var objective = { label: '', x: 0, z: 0, dist: 0, timer: null, visible: false };

  var RANKS = [
    [0, 'Runner'], [30, 'Wheelman'], [70, 'Smuggler'],
    [120, "Fixer's Hand"], [200, 'Ghost of Velmara'], [320, 'Harbour Kingpin']
  ];
  function rankFor(rep) {
    var name = RANKS[0][1];
    for (var i = 0; i < RANKS.length; i++) if (rep >= RANKS[i][0]) name = RANKS[i][1];
    return name;
  }

  // --- dialogue -------------------------------------------------------------
  function say(lines, onDone) {
    story.dialogue = { lines: lines, idx: 0, onDone: onDone || null };
    if (V.onDialogue) V.onDialogue(story.dialogue);
  }
  function advanceDialogue() {
    var d = story.dialogue;
    if (!d) return false;
    d.idx++;
    if (d.idx >= d.lines.length) {
      story.dialogue = null;
      if (V.onDialogue) V.onDialogue(null);
      if (d.onDone) d.onDone();
    } else if (V.onDialogue) V.onDialogue(d);
    return true;
  }

  // --- mission definitions ----------------------------------------------------
  function MISSIONS(city) {
    return [
      {
        title: 'FIRST PARCEL',
        intro: [
          { who: 'Odile Vane', text: 'Jax Rook. Still breathing, still owing me. Good — I have work that pays better than regret.' },
          { who: 'Jax Rook', text: 'Name it, Odile. Wheels are warm.' },
          { who: 'Odile Vane', text: 'Marek at the Old Market holds a parcel that was never meant to clear customs. Fetch it. Take it to Pawn & Co on the Mile. Quiet hands, quick feet.' }
        ],
        steps: [
          { type: 'goto', x: city.marketPickup.x, z: city.marketPickup.z, r: 6, label: 'Pick up the parcel at the Old Market' },
          { type: 'goto', x: -219, z: 40, r: 7, label: 'Deliver to Pawn & Co' }
        ],
        outro: [
          { who: 'Odile Vane', text: 'Clean. The pawnbroker sweats a little less tonight. There may be more where that came from.' }
        ],
        cash: 350, rep: 10
      },
      {
        title: 'NINE MINUTES TO DOCK NINE',
        intro: [
          { who: 'Odile Vane', text: 'A courier missed his boat and his nerve. The parcel at the market has to reach Dock Nine before the tide turns.' },
          { who: 'Jax Rook', text: 'Nine minutes, rain like this? You always did love me, Odile.' },
          { who: 'Odile Vane', text: 'Drive like the harbour owes you money, Jax.' }
        ],
        steps: [
          { type: 'goto', x: city.marketPickup.x, z: city.marketPickup.z, r: 6, label: 'Collect the Dock Nine parcel' },
          { type: 'goto', x: city.dockNine.x, z: city.dockNine.z, r: 8, label: 'Deliver to Dock Nine', time: 150 }
        ],
        outro: [
          { who: 'Odile Vane', text: 'The dockmaster sends his regards and something heavier than regards. Well driven.' }
        ],
        cash: 600, rep: 14
      },
      {
        title: 'INDIGO',
        intro: [
          { who: 'Odile Vane', text: 'Orphee Motors keeps an indigo GT on its lot — a showroom queen with a buyer waiting in the Heights.' },
          { who: 'Jax Rook', text: 'Steal the poster car. In the rain. Under the cameras.' },
          { who: 'Odile Vane', text: 'You say that like it is a problem, cheri. Bring it to the Heights drop, and do not scratch the indigo.' }
        ],
        steps: [
          { type: 'stealOrphee', label: 'Steal the indigo Orphee GT' },
          { type: 'goto', x: 150, z: -120, r: 9, label: 'Deliver the GT to the Heights drop', inCarKind: 'orphee' }
        ],
        outro: [
          { who: 'Odile Vane', text: 'Not a scratch. The buyer cried a little. Happy tears pay full price.' }
        ],
        cash: 900, rep: 18
      },
      {
        title: 'DOCK CREW',
        intro: [
          { who: 'Odile Vane', text: 'A crew of dock toughs decided my shipments are their pension plan. Five of them, by the container yard.' },
          { who: 'Jax Rook', text: 'You want them persuaded.' },
          { who: 'Odile Vane', text: 'I want them retired, Jax. Permanently persuaded. Take the pistol. Come back breathing.' }
        ],
        steps: [
          { type: 'goto', x: 150, z: 138, r: 16, label: 'Reach the container yard' },
          { type: 'clear', label: 'Clear the dock crew', count: 5, cx: 158, cz: 152 }
        ],
        outro: [
          { who: 'Odile Vane', text: 'The docks remember who they work for now. So will everyone else, by morning.' }
        ],
        cash: 1100, rep: 22
      },
      {
        title: 'THE HARBOUR VAULT',
        intro: [
          { who: 'Odile Vane', text: 'The harbour vault holds a strongbox with my name misspelled on it. Hold the door while my man works the lock.' },
          { who: 'Jax Rook', text: 'And when the law arrives?' },
          { who: 'Odile Vane', text: 'Then you do the thing you were born doing, Jax. You disappear.' }
        ],
        steps: [
          { type: 'goto', x: city.vault.x, z: city.vault.z, r: 9, label: 'Reach the harbour vault' },
          { type: 'hold', x: city.vault.x, z: city.vault.z, r: 11, secs: 12, label: 'Hold the vault door', guards: 2 },
          { type: 'escape', label: 'Lose the police' }
        ],
        outro: [
          { who: 'Odile Vane', text: 'The strongbox sings a lovely song. You are becoming expensive to lose, Jax Rook.' }
        ],
        cash: 1800, rep: 28
      },
      {
        title: 'CITY LIMITS',
        intro: [
          { who: 'Odile Vane', text: 'Last job, and it is a loud one. Every badge in Velmara will know your plates by the second corner.' },
          { who: 'Jax Rook', text: 'And the finish line?' },
          { who: 'Odile Vane', text: 'The north gate, city limits. Cross it clean and the night is yours. Cross it at all, and it is still a story.' }
        ],
        steps: [
          { type: 'goto', x: -48, z: -120, r: 12, label: 'Hit the north checkpoint', time: 75, hot: true },
          { type: 'goto', x: -48, z: -296, r: 12, label: 'Reach the city limits', time: 60 }
        ],
        outro: [
          { who: 'Odile Vane', text: 'City limits. Behind you: every light in Velmara. Ahead: whatever you want, Jax. We are square — and then some.' }
        ],
        cash: 2500, rep: 40
      }
    ];
  }

  var missionDefs = null;

  function startMission(idx, city) {
    var def = missionDefs[idx];
    story.active = {
      def: def, idx: idx, stepIdx: 0, step: null,
      timer: null, holdT: 0, thugs: [], startedAt: V.law.time
    };
    enterStep(city);
    if (V.toast) V.toast('MISSION — ' + def.title);
    if (V.sound) V.sound.missionStart();
  }

  function enterStep(city) {
    var m = story.active;
    var step = m.def.steps[m.stepIdx];
    m.step = step;
    m.timer = step.time || null;
    m.holdT = 0;
    if (step.type === 'clear') {
      m.thugs = [];
      for (var i = 0; i < step.count; i++) {
        var a = (i / step.count) * Math.PI * 2;
        var th = V.spawnThug(V.sceneRef, step.cx + Math.cos(a) * 9, step.cz + Math.sin(a) * 9, {});
        m.thugs.push(th);
      }
    }
    if (step.type === 'hold' && step.guards) {
      m.thugs = [];
      for (var g = 0; g < step.guards; g++) {
        m.thugs.push(V.spawnThug(V.sceneRef, step.x + 14 + g * 5, step.z - 10 + g * 8, { guard: true }));
      }
      V.law.heat = Math.max(V.law.heat, 70);
    }
    if (step.hot) V.law.heat = Math.max(V.law.heat, 62);
    if (step.type === 'escape') V.law.heat = Math.max(V.law.heat, 55);
  }

  function completeMission(city) {
    var m = story.active;
    var def = m.def;
    story.active = null;
    story.nextMission = m.idx + 1;
    if (story.nextMission >= missionDefs.length) story.storyDone = true;
    story.rep += def.rep;
    if (V.onMissionComplete) V.onMissionComplete(def);
    say(def.outro, null);
  }

  function failMission(reason) {
    if (!story.active) return;
    var title = story.active.def.title;
    story.active = null;
    objective.visible = false;
    if (V.toast) V.toast('MISSION FAILED — ' + title + ' (' + reason + '). See Odile to retry.');
    if (V.sound) V.sound.missionFail();
  }

  // --- talking to Odile -------------------------------------------------------
  function talk(city) {
    if (story.dialogue || story.active) return;
    if (story.nextMission < missionDefs.length) {
      var def = missionDefs[story.nextMission];
      var idx = story.nextMission;
      say(def.intro, function () { startMission(idx, city); });
    } else {
      // story done: Odile offers courier work
      say([
        { who: 'Odile Vane', text: 'The big work is done, but Velmara never stops needing fast hands. I have a courier run for you.' },
        { who: 'Jax Rook', text: 'Point me at it.' }
      ], function () { startCourier(city); });
    }
  }

  // --- courier runs -----------------------------------------------------------
  function startCourier(city) {
    var spots = [
      { x: city.marketPickup.x, z: city.marketPickup.z, name: 'the Old Market' },
      { x: -219, z: 40, name: 'Pawn & Co' },
      { x: 96, z: 250, name: 'the quay' },
      { x: 150, z: -138, name: 'St. Mirella' },
      { x: -233, z: 60, name: 'the Neon Mile' },
      { x: 150, z: -120, name: 'the Heights drop' }
    ];
    var a = spots[(rng() * spots.length) | 0];
    var b = spots[(rng() * spots.length) | 0];
    if (b === a) b = spots[(spots.indexOf(a) + 2) % spots.length];
    var pay = 120 + ((V.dist2d(a.x, a.z, b.x, b.z) * 0.9) | 0);
    story.active = {
      def: { title: 'COURIER RUN', cash: pay, rep: 4, outro: [{ who: 'Odile Vane', text: 'Signed, sealed, paid. The city turns on runs like that.' }] },
      idx: -1, stepIdx: 0, timer: null, holdT: 0, thugs: [],
      step: null, courier: true
    };
    story.active.def.steps = [
      { type: 'goto', x: a.x, z: a.z, r: 7, label: 'Pick up at ' + a.name },
      { type: 'goto', x: b.x, z: b.z, r: 8, label: 'Deliver to ' + b.name, time: 45 + (V.dist2d(a.x, a.z, b.x, b.z) / 6 | 0) }
    ];
    enterStep(city);
    if (V.toast) V.toast('COURIER RUN — $' + pay + ' on delivery');
  }

  // --- races ------------------------------------------------------------------
  function startRace(city, px, pz) {
    if (story.active || story.race) return false;
    if (V.dist2d(px, pz, city.raceStart.x, city.raceStart.z) > 10) return false;
    var pts = [
      { x: -240, z: 48 }, { x: -144, z: 48 }, { x: -144, z: -96 },
      { x: 48, z: -96 }, { x: 48, z: 48 }, { x: -48, z: 168 }, { x: -240, z: 168 }
    ];
    story.race = { pts: pts, idx: 0, t: 0, best: story.raceBest || 0 };
    if (V.toast) V.toast('NEON MILE TIME TRIAL — follow the beacons!');
    if (V.sound) V.sound.missionStart();
    return true;
  }

  // --- per-frame update ---------------------------------------------------------
  function updateStory(dt, ctx) {
    // marker follows the objective
    var m = story.active;
    objective.visible = false;
    if (story.race) {
      var rp = story.race.pts[story.race.idx];
      story.race.t += dt;
      objective.label = 'TIME TRIAL — checkpoint ' + (story.race.idx + 1) + '/' + story.race.pts.length +
        ' · ' + story.race.t.toFixed(1) + 's';
      objective.x = rp.x; objective.z = rp.z;
      objective.dist = V.dist2d(ctx.px, ctx.pz, rp.x, rp.z);
      objective.timer = null;
      objective.visible = true;
      if (objective.dist < 11) {
        story.race.idx++;
        if (V.sound) V.sound.checkpoint();
        if (story.race.idx >= story.race.pts.length) {
          var t = story.race.t;
          var pay = Math.max(150, 700 - ((t * 4) | 0));
          story.rep += 6;
          if (!story.raceBest || t < story.raceBest) story.raceBest = t;
          story.race = null;
          if (V.onRaceComplete) V.onRaceComplete(t, pay);
        }
      }
    }
    if (!m) { placeMarker(); return; }
    var step = m.step;
    if (!step) { placeMarker(); return; }
    objective.label = step.label;
    objective.timer = m.timer;
    objective.visible = true;
    if (step.type === 'goto' || step.type === 'pickup' || step.type === 'hold') {
      objective.x = step.x; objective.z = step.z;
      objective.dist = V.dist2d(ctx.px, ctx.pz, step.x, step.z);
    } else if (step.type === 'stealOrphee') {
      var gt = null;
      for (var i = 0; i < V.cars.length; i++) if (V.cars[i].isOrphee) gt = V.cars[i];
      if (gt) {
        objective.x = gt.x; objective.z = gt.z;
        objective.dist = V.dist2d(ctx.px, ctx.pz, gt.x, gt.z);
        if (ctx.playerCar === gt) advanceStep(ctx.city);
      }
    } else if (step.type === 'clear') {
      var alive = m.thugs.filter(function (t) { return !t.dead; });
      objective.label = step.label + ' — ' + alive.length + ' left';
      if (alive.length) {
        objective.x = alive[0].x; objective.z = alive[0].z;
        objective.dist = V.dist2d(ctx.px, ctx.pz, alive[0].x, alive[0].z);
      } else advanceStep(ctx.city);
    } else if (step.type === 'escape') {
      objective.label = step.label + ' — ' + V.law.stars + ' stars';
      objective.x = ctx.px; objective.z = ctx.pz;
      objective.dist = 0;
      if (V.law.stars === 0) {
        m.escapeT = (m.escapeT || 0) + dt;
        if (m.escapeT > 1.2) advanceStep(ctx.city);
      } else m.escapeT = 0;
    }
    if (step.type === 'goto' || step.type === 'pickup') {
      var okDist = objective.dist < step.r;
      var okCar = !step.inCarKind || (ctx.playerCar && ctx.playerCar.kind === step.inCarKind);
      if (okDist && okCar) advanceStep(ctx.city);
    }
    if (step.type === 'hold') {
      if (objective.dist < step.r) {
        m.holdT += dt;
        objective.label = step.label + ' — ' + Math.ceil(step.secs - m.holdT) + 's';
        if (m.holdT >= step.secs) advanceStep(ctx.city);
      }
    }
    if (m.timer !== null && m.timer !== undefined) {
      m.timer -= dt;
      objective.timer = m.timer;
      if (m.timer <= 0) failMission('out of time');
    }
    placeMarker();
  }

  function advanceStep(city) {
    var m = story.active;
    if (!m) return;
    if (V.sound) V.sound.checkpoint();
    m.stepIdx++;
    if (m.stepIdx >= m.def.steps.length) {
      if (m.courier) {
        var def = m.def;
        story.active = null;
        story.rep += def.rep;
        objective.visible = false;
        if (V.onMissionComplete) V.onMissionComplete(def);
        say(def.outro, null);
      } else completeMission(city);
    } else enterStep(city);
  }

  function placeMarker() {
    if (!marker) return;
    if (objective.visible && (objective.x || objective.z)) {
      marker.visible = true;
      markerRing.visible = true;
      marker.position.set(objective.x, 15, objective.z);
      markerRing.position.set(objective.x, 0.25, objective.z);
      var s = 1 + Math.sin(V.law.time * 3) * 0.12;
      markerRing.scale.set(s, 1, s);
    } else {
      marker.visible = false;
      markerRing.visible = false;
    }
  }

  function initStory(scene, city) {
    missionDefs = MISSIONS(city);
    var geo = new THREE.CylinderGeometry(1.7, 1.7, 30, 18, 1, true);
    marker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffd34d, transparent: true, opacity: 0.33,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    marker.visible = false;
    scene.add(marker);
    markerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.9, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.visible = false;
    scene.add(markerRing);
  }

  V.story = story;
  V.objective = objective;
  V.initStory = initStory;
  V.talkToOdile = talk;
  V.advanceDialogue = advanceDialogue;
  V.updateStory = updateStory;
  V.failMission = failMission;
  V.startRace = startRace;
  V.rankFor = rankFor;
})();
