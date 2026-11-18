// story.js — Odile Vane's six jobs for Jax Rook, plus repeatable checkpoint
// races and courier runs. A small stage machine: talk → objective stages
// (reach / deliver timed / steal a named car / clear thugs / hold the vault /
// escape) → payout, reputation rank, next job unlocked.
window.VN = window.VN || {};

VN.story = (function () {
  'use strict';

  var RANKS = [
    { rep: 0, name: 'Nobody' }, { rep: 120, name: 'Errand Runner' },
    { rep: 320, name: 'Wheelman' }, { rep: 620, name: 'Fixer’s Favourite' },
    { rep: 1000, name: 'Velmara Ghost' }, { rep: 1500, name: 'King of the Mile' }
  ];
  function rankFor(rep) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (rep >= RANKS[i].rep) r = RANKS[i];
    return r.name;
  }

  // Stage kinds: talk, reach, timed, steal, clear, hold, escape, deliver
  var MISSIONS = [
    {
      id: 'parcel', title: 'First Parcel', pay: 240, rep: 60,
      intro: [
        ['Odile Vane', 'Jax Rook. Still the fastest hands in Velmara, or did prison slow you down?'],
        ['Jax Rook', 'Name the job, Odile.'],
        ['Odile Vane', 'A parcel waits at the Old Market stalls. Pick it up, bring it to Pier 9. Quietly.']
      ],
      stages: [
        { kind: 'reach', label: 'Pick up the parcel at the Old Market stalls', at: 'plaza', radius: 7 },
        { kind: 'reach', label: 'Deliver the parcel to Pier 9', at: 'pier9', radius: 8 }
      ],
      done: 'Clean work. The harbour remembers a careful driver.'
    },
    {
      id: 'nine', title: 'Nine Minutes to Dock Nine', pay: 380, rep: 90,
      intro: [
        ['Odile Vane', 'A buyer at Dock Nine, and his boat leaves in nine minutes. The clock is the job.'],
        ['Jax Rook', 'Then I drive like the rain is chasing me.']
      ],
      stages: [
        { kind: 'reach', label: 'Collect the case at the Rialto casino kerb', at: 'casino', radius: 7 },
        { kind: 'timed', label: 'Reach Dock Nine before the boat leaves', at: 'dock9', radius: 9, time: 150 }
      ],
      done: 'Ninety-six seconds to spare on a wet night. Noted.'
    },
    {
      id: 'orphee', title: 'The Indigo Orphee', pay: 520, rep: 120,
      intro: [
        ['Odile Vane', 'An indigo Orphee GT sleeps behind the Rialto. Its owner owes me a car.'],
        ['Jax Rook', 'Steal it, lose anyone who objects, park it at the Heights garage.'],
        ['Odile Vane', 'You always did listen beautifully.']
      ],
      stages: [
        { kind: 'steal', label: 'Steal the indigo Orphee GT behind the casino', car: 'orphee', radius: 6 },
        { kind: 'escape', label: 'Lose the police', afterSteal: true },
        { kind: 'reach', label: 'Park the Orphee at the Heights garage', at: 'garage', radius: 8, needCar: 'orphee' }
      ],
      done: 'The Orphee purrs in its new home. So does my bank account.'
    },
    {
      id: 'dockcrew', title: 'Dock Crew Diplomacy', pay: 640, rep: 150,
      intro: [
        ['Odile Vane', 'The dock crew took my cut and my courier. Go to the container yard. Be… diplomatic.'],
        ['Jax Rook', 'Diplomacy with a pistol. Understood.']
      ],
      stages: [
        { kind: 'reach', label: 'Enter the Dockyards container yard', at: 'yard', radius: 12 },
        { kind: 'clear', label: 'Clear the dock crew', count: 4, at: 'yard' }
      ],
      done: 'The yard is quiet again. The crew sends its regards — from the floor.'
    },
    {
      id: 'vault', title: 'The Harbor Vault', pay: 950, rep: 220,
      intro: [
        ['Odile Vane', 'Tonight we empty the harbor vault. Hold the pier while my people load. Then run.'],
        ['Jax Rook', 'Hold, then lose every badge in Velmara. A Tuesday, then.']
      ],
      stages: [
        { kind: 'reach', label: 'Reach the harbor vault on Pier 9', at: 'pier9', radius: 9 },
        { kind: 'hold', label: 'Hold the pier while the vault is loaded', at: 'pier9', radius: 16, time: 45 },
        { kind: 'escape', label: 'Lose the police' }
      ],
      done: 'The vault is empty and so is the rear-view mirror. Perfect.'
    },
    {
      id: 'getaway', title: 'City Limits', pay: 1400, rep: 320,
      intro: [
        ['Odile Vane', 'Last job, Jax. Every crew in Velmara wants this case. Drive it past the city limits.'],
        ['Jax Rook', 'And if the whole city gives chase?'],
        ['Odile Vane', 'Then give them a show they will retell for years.']
      ],
      stages: [
        { kind: 'reach', label: 'Take the case from Odile’s booth', at: 'booth', radius: 6 },
        { kind: 'timed', label: 'Reach the city limits checkpoint', at: 'limits', radius: 10, time: 170, heat: 3 }
      ],
      done: 'City limits. Velmara shrinks in the mirror. You are a legend now, Jax Rook.'
    }
  ];

  function locations(city) {
    return {
      plaza: city.plaza,
      pier9: { x: 2, z: 188 },
      dock9: { x: -76, z: 188 },
      casino: { x: -20, z: -100 },
      garage: { x: -150, z: -150 },
      yard: { x: 158, z: 100 },
      booth: city.booth,
      limits: { x: 208, z: -196 },
      hospital: city.hospital
    };
  }

  function init(city) {
    return {
      missionIndex: 0, active: null, stage: 0, timer: 0, thugsDown: 0,
      locs: locations(city), side: null, sideStage: 0, completed: []
    };
  }

  function currentObjective(state) {
    var st = state.story;
    if (st.active) {
      var stage = st.active.stages[st.stage];
      return { label: stage.label, stage: stage, mission: st.active };
    }
    if (st.side) return { label: st.side.label, stage: st.side, side: true };
    if (st.missionIndex < MISSIONS.length) {
      return { label: 'See Odile Vane at her Neon Mile booth', stage: { kind: 'talk', at: 'booth', radius: 5 }, mission: null };
    }
    return { label: 'Free roam — races (R) and courier runs (C) pay cash', stage: null };
  }

  function startMission(state, idx) {
    var st = state.story;
    st.active = MISSIONS[idx];
    st.stage = 0;
    st.thugsDown = 0;
    applyStage(state);
    if (VN.ui) VN.ui.banner(state, st.active.title);
  }
  function applyStage(state) {
    var st = state.story;
    var stage = st.active.stages[st.stage];
    if (stage.time) st.timer = stage.time;
    if (stage.heat) VN.law.report(state.law, stage.heat, state);
    if (stage.kind === 'clear') spawnThugs(state, stage);
    if (stage.kind === 'hold') VN.law.report(state.law, 2, state);
  }
  function spawnThugs(state, stage) {
    var at = state.story.locs[stage.at];
    state.thugs = [];
    for (var i = 0; i < (stage.count || 4); i++) {
      var fig = VN.avatar.makeThug(state.rng);
      var th = {
        fig: fig, x: at.x + (state.rng() - 0.5) * 22, z: at.z + (state.rng() - 0.5) * 22,
        ry: 0, phase: 0, health: 100, dead: false, shootCd: 1.4 + state.rng() * 1.4
      };
      fig.group.position.set(th.x, 0, th.z);
      state.scene.add(fig.group);
      state.thugs.push(th);
    }
  }
  function onThugDown(state) {
    state.story.thugsDown++;
  }

  function completeStage(state) {
    var st = state.story;
    st.stage++;
    if (st.stage >= st.active.stages.length) {
      var m = st.active;
      state.player.cash += m.pay;
      state.player.rep += m.rep;
      st.completed.push(m.id);
      st.missionIndex++;
      st.active = null; st.stage = 0;
      state.stats.missionsDone++;
      if (VN.sound) { VN.sound.cash(); VN.sound.missionDone(); }
      if (VN.ui) {
        VN.ui.banner(state, 'MISSION COMPLETE — $' + m.pay);
        VN.ui.dialogue(state, [['Odile Vane', m.done]], null);
      }
      saveGame(state);
    } else {
      applyStage(state);
      if (VN.sound) VN.sound.cash();
    }
  }

  function failMission(state, why) {
    var st = state.story;
    if (VN.ui) VN.ui.toast(state, 'Job failed: ' + why + ' — see Odile to retry.');
    st.active = null; st.stage = 0; st.timer = 0;
    clearThugs(state);
  }
  function clearThugs(state) {
    for (var i = 0; i < state.thugs.length; i++) state.scene.remove(state.thugs[i].fig.group);
    state.thugs = [];
  }

  function step(state, dt) {
    var st = state.story;
    // thugs act
    for (var i = 0; i < state.thugs.length; i++) {
      var th = state.thugs[i];
      if (th.dead) continue;
      var dx = state.player.x - th.x, dz = state.player.z - th.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      th.ry = Math.atan2(dx, dz);
      if (d > 15) {
        th.x += Math.sin(th.ry) * 3.4 * dt;
        th.z += Math.cos(th.ry) * 3.4 * dt;
        th.phase += dt * 8;
        VN.avatar.pose(th.fig, th.phase, 1, false);
      } else {
        VN.avatar.pose(th.fig, 0, 0, true);
        th.fig.gun.visible = true;
        th.shootCd -= dt;
        if (th.shootCd <= 0) {
          th.shootCd = 1.2 + Math.random() * 1.1;
          VN.combat.enemyShoot(state, th);
        }
      }
      th.fig.group.position.set(th.x, 0, th.z);
      th.fig.group.rotation.y = th.ry;
    }

    var obj = currentObjective(state);
    if (!obj.stage) return;
    var stage = obj.stage;
    var target = stage.at ? st.locs[stage.at] : null;
    if (stage.kind === 'timed') {
      st.timer -= dt;
      if (st.timer <= 0) { failMission(state, 'the clock ran out'); return; }
    }
    if (stage.kind === 'escape') {
      if (state.law.wanted === 0) advanceObjective(state, obj);
      return;
    }
    if (stage.kind === 'hold') {
      st.timer -= dt;
      var hp = target ? dist(state.player, target) : 99;
      if (hp > stage.radius + 8) { failMission(state, 'you abandoned the pier'); return; }
      if (st.timer <= 0) advanceObjective(state, obj);
      return;
    }
    if (stage.kind === 'clear') {
      if (st.thugsDown >= (stage.count || 4)) advanceObjective(state, obj);
      return;
    }
    if (!target) return;
    var dd = dist(state.player, target);
    if (stage.kind === 'steal') {
      if (state.player.car && state.player.car.special === stage.car) advanceObjective(state, obj);
      return;
    }
    if (dd <= (stage.radius || 7)) {
      if (stage.needCar && !(state.player.car && state.player.car.special === stage.needCar)) return;
      if (stage.kind === 'talk') return; // talk handled by interaction key
      advanceObjective(state, obj);
    }
  }
  function advanceObjective(state, obj) {
    if (obj.side) completeSide(state);
    else completeStage(state);
  }
  function dist(a, b) { var dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }

  // --- Side work: checkpoint races + courier runs -------------------------
  var RACE_POINTS = [
    { x: 24, z: -24 }, { x: 120, z: -96 }, { x: 48, z: -168 }, { x: -72, z: -120 },
    { x: -144, z: -24 }, { x: -48, z: 72 }, { x: 96, z: 48 }, { x: 168, z: 144 }, { x: 24, z: 120 }
  ];
  function startRace(state) {
    var st = state.story;
    if (st.side || st.active) return;
    st.side = { kind: 'race', label: 'Checkpoint race — hit every gate', points: RACE_POINTS.slice(), idx: 0, time: 150, pay: 300 };
    st.timer = 150;
    if (VN.ui) VN.ui.toast(state, 'Race started! Follow the markers.');
  }
  function startCourier(state) {
    var st = state.story;
    if (st.side || st.active) return;
    var spots = ['plaza', 'dock9', 'garage', 'yard', 'limits', 'casino'];
    var pick = spots[(Math.random() * spots.length) | 0];
    st.side = { kind: 'courier', label: 'Courier run — deliver across town', at: pick, radius: 8, time: 120, pay: 180 };
    st.timer = 120;
    if (VN.ui) VN.ui.toast(state, 'Courier run: fast hands, faster wheels.');
  }
  function stepSide(state, dt) {
    var st = state.story;
    if (!st.side) return;
    st.timer -= dt;
    if (st.timer <= 0) { if (VN.ui) VN.ui.toast(state, 'Side job timed out.'); st.side = null; return; }
    var s = st.side;
    if (s.kind === 'race') {
      var pt = s.points[s.idx];
      if (dist(state.player, pt) < 10) {
        s.idx++; st.timer += 12;
        if (VN.sound) VN.sound.cash();
        if (s.idx >= s.points.length) completeSide(state);
      }
    } else if (s.kind === 'courier') {
      var t = st.locs[s.at];
      if (dist(state.player, t) < s.radius) completeSide(state);
    }
  }
  function completeSide(state) {
    var st = state.story;
    var pay = st.side.pay;
    state.player.cash += pay;
    state.player.rep += 25;
    state.stats.sideDone++;
    st.side = null;
    if (VN.sound) { VN.sound.cash(); VN.sound.missionDone(); }
    if (VN.ui) VN.ui.banner(state, 'SIDE JOB COMPLETE — $' + pay);
    saveGame(state);
  }

  // --- Save / load ----------------------------------------------------------
  var SAVE_KEY = 'velmara-nights-save-v1';
  function saveGame(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.player.cash, rep: state.player.rep,
        missionIndex: state.story.missionIndex, completed: state.story.completed,
        x: state.player.x, z: state.player.z
      }));
    } catch (e) { /* private mode: play on unsaved */ }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  return {
    MISSIONS: MISSIONS, RANKS: RANKS, rankFor: rankFor, init: init,
    currentObjective: currentObjective, startMission: startMission,
    step: step, stepSide: stepSide, onThugDown: onThugDown,
    startRace: startRace, startCourier: startCourier,
    saveGame: saveGame, loadSave: loadSave, clearSave: clearSave,
    failMission: failMission, locations: locations
  };
})();
