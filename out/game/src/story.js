// story.js — six story missions with dialogue, plus checkpoint races & courier runs
window.VN = window.VN || {};
VN.MISSIONS = [
  { id: 1, name: 'First Parcel', banner: 'FIRST PARCEL', pay: 250, rep: 10,
    steps: [
      { kind: 'goto', x: -172, z: -44, label: 'Pick up the parcel at the Old Market stalls', r: 6 },
      { kind: 'goto', x: 60, z: 128, label: 'Deliver the parcel to the Neon Mile drop', r: 6 }],
    intro: [['Odile', 'Jax. One parcel, no questions. Old Market stalls — the blue canopy. Bring it back to the Mile.'], ['Jax', 'On it. Keep the engine warm, Odile.']] },
  { id: 2, name: 'Nine Minutes to Dock Nine', banner: 'NINE MINUTES TO DOCK NINE', pay: 400, rep: 14, timed: 540,
    steps: [
      { kind: 'goto', x: 132, z: 238, label: 'Reach the Dockmaster Pickup at the harbor', r: 7 },
      { kind: 'goto', x: 186, z: 282, label: 'Deliver to Dock Nine before the clock dies', r: 7 }],
    intro: [['Odile', 'Harbor run. Nine minutes, Dock Nine. The tide — and my buyer — will not wait.'], ['Jax', 'Then I drive like the rain is chasing me.']] },
  { id: 3, name: 'Indigo Theft', banner: 'STEAL THE ORPHEE GT', pay: 650, rep: 20,
    steps: [
      { kind: 'steal', model: 0, x: 26, z: -14, label: 'Steal the indigo Orphee GT', r: 8 },
      { kind: 'goto', x: -60, z: -196, label: 'Hide the Orphee in the Heights garage row', r: 8 }],
    intro: [['Odile', 'An indigo Orphee GT is parked off the Mile. Its owner owes me. Take it.'], ['Jax', 'Stealing in this rain? My favourite weather.']] },
  { id: 4, name: 'Dock Crew', banner: 'CLEAR THE DOCK CREW', pay: 800, rep: 24,
    steps: [{ kind: 'clear', x: 196, z: 276, label: 'Clear the dock crew at the container yard', r: 30, count: 4 }],
    intro: [['Odile', 'The dock crew jumped my courier. Four of them, container yard. Settle it.'], ['Jax', 'Consider the yard cleaned.']] },
  { id: 5, name: 'Harbor Vault', banner: 'THE HARBOR VAULT', pay: 1200, rep: 32, hold: 12,
    steps: [
      { kind: 'hold', x: 150, z: 255, label: 'Hold the vault quay while the crew cracks it', r: 9 },
      { kind: 'escape', label: 'Lose the police', r: 0 }],
    intro: [['Odile', 'The harbor vault. Hold the quay, then lose every badge in Velmara.'], ['Jax', 'Big night. Big rain. Lets go.']] },
  { id: 6, name: 'City Limits', banner: 'CITY LIMITS GETAWAY', pay: 2000, rep: 50, timed: 300,
    steps: [{ kind: 'goto', x: 300, z: -300, label: 'Reach the city limits — north-east gate', r: 10 }],
    intro: [['Odile', 'Last run, Jax. City limits, north-east gate. After this, Velmara is yours.'], ['Jax', 'One last drive through the neon.']] }
];
VN.story = {
  idx: 0, step: 0, active: false, timer: null, holdT: 0, done: false,
  current: function () { return VN.MISSIONS[this.idx] || null; },
  stepDef: function () { var m = this.current(); return m ? m.steps[this.step] : null; },
  start: function () {
    var m = this.current(); if (!m) return;
    this.active = true; this.step = 0; this.holdT = 0;
    this.timer = m.timed || null;
    if (m.id === 4) VN.combat.spawnThugs(VN.game.scene, [[188, 270], [204, 272], [192, 284], [208, 282]]);
    VN.ui.showBanner(m.banner); VN.ui.setObjective(m.steps[0].label);
  },
  advance: function () {
    var m = this.current(); this.step++;
    VN.sound.cash();
    if (this.step >= m.steps.length) { this.complete(); return; }
    VN.ui.setObjective(m.steps[this.step].label);
  },
  complete: function () {
    var m = this.current();
    VN.game.addCash(m.pay, m.name); VN.game.addRep(m.rep);
    VN.ui.showBanner('MISSION PASSED — $' + m.pay);
    this.active = false; this.idx++; this.timer = null;
    if (this.idx >= VN.MISSIONS.length) { this.done = true; VN.ui.setObjective('Velmara is yours. Free roam — races & courier runs still pay.'); }
    else VN.ui.setObjective('Return to Odile on the Neon Mile for: ' + VN.MISSIONS[this.idx].name);
    VN.game.save();
  },
  update: function (dt, heroPos, inCar) {
    if (!this.active) return;
    var s = this.stepDef(); if (!s) return;
    if (this.timer != null) { this.timer -= dt; if (this.timer <= 0) { this.active = false; VN.ui.showBanner('MISSION FAILED — out of time'); VN.ui.setObjective('Return to Odile to retry: ' + this.current().name); this.step = 0; return; } }
    if (s.kind === 'goto' || s.kind === 'steal') {
      if (Math.hypot(heroPos.x - s.x, heroPos.z - s.z) < s.r) {
        if (s.kind === 'steal' && !inCar) return;
        this.advance();
      }
    } else if (s.kind === 'clear') {
      var alive = VN.combat.thugs.filter(function (t) { return t.health > 0; }).length;
      VN.ui.setObjective(s.label + ' — ' + alive + ' left');
      if (alive === 0) this.advance();
    } else if (s.kind === 'hold') {
      if (Math.hypot(heroPos.x - s.x, heroPos.z - s.z) < s.r) {
        this.holdT += dt; VN.ui.setObjective(s.label + ' — ' + Math.ceil((VN.MISSIONS[this.idx].hold || 12) - this.holdT) + 's');
        if (this.holdT === dt || this.holdT < dt * 2) VN.law.reportCrime(55, VN.game.scene, heroPos);
        if (this.holdT >= (VN.MISSIONS[this.idx].hold || 12)) { VN.law.reportCrime(40, VN.game.scene, heroPos); this.advance(); }
      }
    } else if (s.kind === 'escape') {
      VN.ui.setObjective('Lose the police — break their sight line');
      if (VN.law.wanted === 0) this.advance();
    }
  }
};
VN.sideJobs = {
  race: { active: false, cp: 0, points: [[120, 120], [240, 0], [120, -120], [0, -240], [-120, -120], [-60, 60]], timer: 0 },
  startRace: function () { this.race.active = true; this.race.cp = 0; this.race.timer = 150; VN.ui.showBanner('CHECKPOINT RACE'); },
  courier: { active: false, x: 0, z: 0 },
  startCourier: function (rnd) { this.courier.active = true; this.courier.x = Math.floor(rnd() * 10 - 5) * 48; this.courier.z = Math.floor(rnd() * 10 - 5) * 48; VN.ui.showBanner('COURIER RUN — $180'); },
  update: function (dt, pos) {
    if (this.race.active) {
      this.race.timer -= dt;
      var p = this.race.points[this.race.cp];
      VN.ui.setObjective('Race checkpoint ' + (this.race.cp + 1) + '/6 — ' + Math.ceil(this.race.timer) + 's');
      if (Math.hypot(pos.x - p[0], pos.z - p[1]) < 12) { this.race.cp++; VN.sound.pickup(); if (this.race.cp >= 6) { this.race.active = false; VN.game.addCash(350, 'Checkpoint race'); VN.ui.showBanner('RACE WON — $350'); } }
      if (this.race.timer <= 0) { this.race.active = false; VN.ui.showBanner('RACE LOST'); }
    }
    if (this.courier.active && Math.hypot(pos.x - this.courier.x, pos.z - this.courier.z) < 8) { this.courier.active = false; VN.game.addCash(180, 'Courier run'); VN.ui.showBanner('DELIVERED — $180'); }
  },
  marker: function () {
    if (this.race.active) { var p = this.race.points[this.race.cp]; return { x: p[0], z: p[1] }; }
    if (this.courier.active) return { x: this.courier.x, z: this.courier.z };
    return null;
  }
};
