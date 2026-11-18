// story.js - the six-mission Velmara Nights storyline plus repeatable
// checkpoint races and courier runs. Odile Vane hands out every job from her
// Neon Mile booth. Objectives are a small state machine: go / pickup /
// deliver / timed / fight / hold / escape / getaway, with a world marker,
// a distance readout and, for timed legs, a countdown.
window.VN = window.VN || {};

VN.MISSIONS = [
  {
    id: 'parcel', title: 'FIRST PARCEL', pay: 350, rep: 10,
    intro: [
      ['Odile', 'Jax Rook. You drive, you do not ask what is in the box. That is the whole job description.'],
      ['Jax', 'And the pay?'],
      ['Odile', 'Market stalls, Old Market. Pick up the parcel, bring it back to my booth. The rain is free.'],
    ],
    legs: [
      { kind: 'go', at: 'marketPickup', label: 'Pick up the parcel at the Old Market stalls' },
      { kind: 'deliver', at: 'odileBooth', label: 'Deliver the parcel to Odile' },
    ],
    outro: [['Odile', 'Dry enough. You might be worth the trouble, Rook.']],
  },
  {
    id: 'docknine', title: 'NINE MINUTES TO DOCK NINE', pay: 600, rep: 16,
    intro: [
      ['Odile', 'A buyer at Dock Nine pays double if the case lands before his ship sails.'],
      ['Jax', 'And if it lands after?'],
      ['Odile', 'Then I never heard your name. Take any car. Clock is already running.'],
    ],
    legs: [
      { kind: 'timed', at: 'dockNine', label: 'Reach Dock Nine before the ship sails', seconds: 540 },
    ],
    outro: [['Odile', 'The harbormaster sends his regards. And his money.']],
  },
  {
    id: 'orphee', title: 'THE INDIGO ORPHEE', pay: 900, rep: 22,
    intro: [
      ['Odile', 'An Orphee GT, indigo, parked behind Club Orphee. The owner owes people.'],
      ['Jax', 'You want me to be the collection agency.'],
      ['Odile', 'Steal it, lose anyone who objects, park it at my Heights garage.'],
    ],
    legs: [
      { kind: 'stealgt', at: 'gtSpawn', label: 'Steal the indigo Orphee GT behind Club Orphee' },
      { kind: 'delivercar', at: 'heightsDrop', label: 'Park the Orphee GT at the Heights garage', needGT: true },
    ],
    outro: [['Odile', 'Indigo suits the garage. The owner sends his regards too. Eventually.']],
  },
  {
    id: 'dockcrew', title: 'DOCK CREW TROUBLE', pay: 1100, rep: 26,
    intro: [
      ['Odile', 'The dock crew shook down my couriers twice this week. Four of them, by the containers.'],
      ['Jax', 'You want a conversation.'],
      ['Odile', 'I want them horizontal. There is a difference, and it pays better.'],
    ],
    legs: [
      { kind: 'fight', at: 'dockNine', label: 'Clear the dock crew by the containers', count: 4 },
    ],
    outro: [['Odile', 'The docks are quiet tonight. My couriers thank you.']],
  },
  {
    id: 'vault', title: 'THE HARBOR VAULT', pay: 2000, rep: 40,
    intro: [
      ['Odile', 'The vault annex on the quay. Hold the apron while my crew works the door.'],
      ['Jax', 'And when the door opens?'],
      ['Odile', 'Take the take to the quay drop, then lose the police. In that order, Rook.'],
    ],
    legs: [
      { kind: 'hold', at: 'vaultAnnex', label: 'Hold the vault apron while the crew works', seconds: 30 },
      { kind: 'deliver', at: 'vaultDrop', label: 'Carry the take to the quay drop point' },
      { kind: 'escape', label: 'Lose the police' },
    ],
    outro: [['Odile', 'Half the harbor in one bag. You are officially expensive now.']],
  },
  {
    id: 'getaway', title: 'VELMARA LIMITS', pay: 3000, rep: 60,
    intro: [
      ['Odile', 'Last job, Rook. Every badge in the city will light up when you roll.'],
      ['Jax', 'City limits, north road. Then I am a ghost.'],
      ['Odile', 'Then you are a legend. Drive like one.'],
    ],
    legs: [
      { kind: 'getaway', at: 'cityLimits', label: 'Reach the city limits on the north road', heat: 300 },
    ],
    outro: [['Odile', 'Velmara Nights, and you owned every one of them. Come back rich, Rook.']],
  },
];

VN.POINTS = function (city) {
  return {
    marketPickup: city.marketPickup,
    odileBooth: city.odileBooth,
    dockNine: city.dockNine,
    gtSpawn: city.gtSpawn,
    heightsDrop: city.heightsDrop,
    vaultAnnex: { x: 150, z: 222 },
    vaultDrop: city.vaultDrop,
    cityLimits: { x: 60, z: -268 },
  };
};

VN.Story = class Story {
  constructor(G) {
    this.G = G;
    this.missionIdx = 0;      // next story mission to offer
    this.active = null;       // {mission, legIdx, timer, holdT, thugs}
    this.sideJob = null;      // race / courier
    this.dialogue = null;     // {lines, idx, onDone}
    this.completed = 0;
  }

  get allDone() { return this.missionIdx >= VN.MISSIONS.length; }

  startDialogue(lines, onDone) {
    this.dialogue = { lines, idx: 0, onDone };
    this.G.state = 'dialogue';
    this.G.ui.showDialogue(lines[0][0], lines[0][1]);
  }
  advanceDialogue() {
    if (!this.dialogue) return;
    this.dialogue.idx++;
    if (this.dialogue.idx >= this.dialogue.lines.length) {
      const done = this.dialogue.onDone;
      this.dialogue = null;
      this.G.ui.hideDialogue();
      this.G.state = 'playing';
      if (done) done();
    } else {
      const ln = this.dialogue.lines[this.dialogue.idx];
      this.G.ui.showDialogue(ln[0], ln[1]);
    }
  }

  talkToOdile() {
    const G = this.G;
    if (this.active || this.sideJob) { G.ui.toast('Finish the current job first.'); return; }
    if (this.allDone) {
      this.startDialogue([
        ['Odile', 'No more jobs on the board, legend. Races and courier runs still pay, if your hands get restless.'],
      ], () => this.offerSide());
      return;
    }
    const m = VN.MISSIONS[this.missionIdx];
    this.startDialogue(m.intro, () => this.beginMission(m));
  }

  beginMission(m) {
    this.active = { mission: m, legIdx: 0, timer: null, holdT: 0, thugs: [] };
    this.setupLeg();
    this.G.ui.setObjective(m.title, this.currentLabel());
    if (VN.SFX) VN.SFX.ding();
  }

  currentLeg() { return this.active ? this.active.mission.legs[this.active.legIdx] : null; }
  currentLabel() {
    const leg = this.currentLeg();
    return leg ? leg.label : '';
  }

  setupLeg() {
    const leg = this.currentLeg();
    if (!leg) return;
    const G = this.G;
    if (leg.kind === 'timed') this.active.timer = leg.seconds;
    if (leg.kind === 'hold') { this.active.holdT = leg.seconds; G.law.reportCrime('vault', 150, 222, 1); }
    if (leg.kind === 'getaway' && leg.heat) G.law.heat = Math.max(G.law.heat, leg.heat);
    if (leg.kind === 'fight') this.spawnThugs(leg.count || 4);
    if (leg.kind === 'escape') G.law.reportCrime('vault', G.focusX(), G.focusZ(), 0.6);
  }

  spawnThugs(n) {
    const G = this.G;
    const base = VN.POINTS(G.city).dockNine;
    for (let i = 0; i < n; i++) {
      const ped = new VN.Ped({ x: base.x - 14 + i * 6, z: base.z - 12 + (i % 2) * 7 }, 40 + i);
      ped.isThug = true;
      ped.health = 60;
      ped.fig.setGun(true);
      ped.shootT = 1 + i * 0.4;
      G.scene.add(ped.group);
      G.peds.push(ped);
      this.active.thugs.push(ped);
    }
  }

  objectivePoint() {
    const leg = this.currentLeg();
    if (this.sideJob) return this.sideJob.at;
    if (!leg || leg.kind === 'escape') return null;
    return VN.POINTS(this.G.city)[leg.at] || null;
  }

  completeLeg() {
    const G = this.G;
    this.active.legIdx++;
    if (this.active.legIdx >= this.active.mission.legs.length) {
      const m = this.active.mission;
      this.active = null;
      this.missionIdx++;
      this.completed++;
      G.addCash(m.pay);
      G.addRep(m.rep);
      G.ui.clearObjective();
      G.ui.toast(m.title + ' complete  +$' + m.pay);
      if (VN.SFX) VN.SFX.cash();
      this.startDialogue(m.outro, null);
      G.saveGame();
    } else {
      this.setupLeg();
      G.ui.setObjective(this.active.mission.title, this.currentLabel());
    }
  }

  failMission(reason) {
    const G = this.G;
    this.active = null;
    G.ui.clearObjective();
    G.ui.toast('Job failed: ' + reason);
    if (VN.SFX) VN.SFX.fail();
  }

  offerSide() {
    // After the board is clear (or between missions via the booth menu keys),
    // races and courier runs are offered from the same booth interaction.
  }

  startRace() {
    const G = this.G;
    if (this.active || this.sideJob) return false;
    const pts = [{ x: 220, z: 20 }, { x: 60, z: -140 }, { x: -180, z: 100 }, { x: 140, z: 180 }];
    this.sideJob = { kind: 'race', step: 0, pts, at: pts[0], label: 'Checkpoint 1 of 4' };
    G.ui.setObjective('NEON CIRCUIT', this.sideJob.label);
    return true;
  }

  startCourier() {
    const G = this.G;
    if (this.active || this.sideJob) return false;
    const spots = [VN.POINTS(G.city).marketPickup, VN.POINTS(G.city).dockNine, VN.POINTS(G.city).heightsDrop, { x: -100, z: 180 }];
    const at = spots[Math.floor(Math.random() * spots.length)];
    this.sideJob = { kind: 'courier', at, label: 'Courier drop - hurry, it pays per minute', timer: 180 };
    G.ui.setObjective('COURIER RUN', this.sideJob.label);
    return true;
  }

  update(dt) {
    const G = this.G;
    // Thug behaviour for the dock-crew fight.
    if (this.active) {
      for (const t of this.active.thugs) {
        if (t.dead) continue;
        const d = VN.dist2d(t.x, t.z, G.focusX(), G.focusZ());
        t.heading = Math.atan2(G.focusX() - t.x, G.focusZ() - t.z);
        if (d > 16) {
          t.x += Math.sin(t.heading) * 2.8 * dt;
          t.z += Math.cos(t.heading) * 2.8 * dt;
        }
        t.syncMesh();
        t.fig.animate(dt, d > 16 ? 2.5 : 0);
        t.shootT -= dt;
        if (d < 36 && t.shootT <= 0) { t.shootT = 1.3 + Math.random() * 0.8; G.combat.enemyShoot(t, d); }
      }
    }
    if (this.sideJob && this.sideJob.kind === 'courier') {
      this.sideJob.timer -= dt;
      if (this.sideJob.timer <= 0) { this.sideJob = null; G.ui.clearObjective(); G.ui.toast('Courier run expired.'); }
    }
    if (!this.active) return;
    const leg = this.currentLeg();
    if (!leg) return;
    const px = G.focusX(), pz = G.focusZ();

    if (leg.kind === 'timed') {
      this.active.timer -= dt;
      if (this.active.timer <= 0) { this.failMission('the ship sailed'); return; }
    }
    if (leg.kind === 'hold') {
      const at = VN.POINTS(G.city)[leg.at];
      if (VN.dist2d(px, pz, at.x, at.z) < 16) {
        this.active.holdT -= dt;
        if (this.active.holdT <= 0) { this.completeLeg(); return; }
      }
    }
    if (leg.kind === 'escape') {
      if (G.law.stars === 0 && G.law.heat <= 0) { this.completeLeg(); return; }
      return; // escape legs end on heat, not position
    }
    if (leg.kind === 'fight') {
      const alive = this.active.thugs.filter(t => !t.dead).length;
      this.active.aliveCount = alive;
      if (alive === 0) { this.completeLeg(); return; }
      return;
    }
    const at = VN.POINTS(G.city)[leg.at];
    if (!at) return;
    const d = VN.dist2d(px, pz, at.x, at.z);
    const radius = leg.kind === 'delivercar' ? 7 : 5;
    if (d < radius) {
      if (leg.kind === 'stealgt') {
        if (G.mode === 'car' && G.playerCar && G.playerCar.isGT) this.completeLeg();
        return;
      }
      if (leg.kind === 'delivercar') {
        if (G.mode === 'car' && G.playerCar && G.playerCar.isGT) this.completeLeg();
        return;
      }
      this.completeLeg();
    }
  }
};
