// story.js — Odile Vane's six jobs for Jax Rook, told as data: go/fetch/steal/
// clear/hold/escape steps with dialogue at both ends, cash and rep rewards,
// plus two repeatable earners (a checkpoint race and courier runs) that stay
// open between jobs and after the story ends.

import { createThug } from './combat.js';
import { CAR_MODELS, createCar } from './drive.js';

const V3 = (G, x, z) => new G.THREE.Vector3(x, 0, z);

const MISSIONS = [
  {
    title: 'First Parcel',
    pay: 180, rep: 10,
    intro: [
      ['Odile Vane', 'Jax Rook. The new wheel in Velmara. I run jobs out of this booth — you drive, I pay, nobody asks what is in the parcel.'],
      ['Jax Rook', 'Simple enough. What is in the parcel?'],
      ['Odile Vane', 'Nobody asks, love. Take it to the Old Market, stall row. My cousin Sef will sign for it. Then bring the chit to the harbor gate.'],
    ],
    outro: [
      ['Odile Vane', 'Clean and quick. The city noticed you a little. That is good — Velmara pays drivers it notices.'],
    ],
    steps: [
      { type: 'goto', text: 'Pick up the parcel at the Old Market stalls', target: (G) => G.city.marketPos, radius: 5 },
      { type: 'goto', text: 'Deliver the signed chit to the harbor gate', target: () => null, fixed: [30, 208], radius: 6 },
    ],
  },
  {
    title: 'Nine Minutes to Dock Nine',
    pay: 260, rep: 14,
    intro: [
      ['Odile Vane', 'A chef in the Heights ordered fish that is not, legally, fish. It lands at Dock Nine in nine minutes and spoils faster.'],
      ['Jax Rook', 'Nine minutes across the whole city?'],
      ['Odile Vane', 'You said you were fast. The clock starts when the crate is in your hands — get to the Heights drop first.'],
    ],
    outro: [
      ['Odile Vane', 'The chef sends his regards and something that smells expensive. You are becoming reliable, Rook.'],
    ],
    steps: [
      { type: 'goto', text: 'Reach the Heights pickup before it is moved', target: () => null, fixed: [-150, -98], radius: 6 },
      { type: 'goto', text: 'Deliver to Dock Nine — hurry!', target: () => null, fixed: [-30, 210], radius: 7, timer: 150 },
    ],
  },
  {
    title: 'The Indigo Coupe',
    pay: 340, rep: 18,
    intro: [
      ['Odile Vane', 'An Orphee GT, indigo, parked by the market like it owns the street. Its owner owes people. Tonight it changes hands.'],
      ['Jax Rook', 'You want me to steal a bright purple GT in the middle of the Mile?'],
      ['Odile Vane', 'Indigo, darling. And yes. Bring it to the lockup behind my booth — gently. It is the payment, not the message.'],
    ],
    outro: [
      ['Odile Vane', 'Not a scratch that matters. The owner cried, I am told. Debts are emotional things.'],
    ],
    steps: [
      { type: 'steal', text: 'Steal the indigo Orphee GT near the Old Market', spawn: spawnCoupe },
      { type: 'goto', text: 'Deliver the coupe to the lockup behind the booth', target: () => null, fixed: [26, 62], radius: 6, needsMissionCar: true },
    ],
  },
  {
    title: 'Dockyard Diplomacy',
    pay: 420, rep: 22,
    intro: [
      ['Odile Vane', 'The dock crew has been taxing my trucks. Five of them, armed, very proud of their containers.'],
      ['Jax Rook', 'Diplomacy, you said.'],
      ['Odile Vane', 'Velmara diplomacy. Clear the yard by the west containers and my trucks roll again tonight.'],
    ],
    outro: [
      ['Odile Vane', 'The trucks are rolling and the crew is reconsidering its career. You have a gift for negotiation.'],
    ],
    steps: [
      { type: 'clear', text: 'Clear the dock crew in the Dockyards', target: (G) => G.city.dockCrewPos, radius: 30, spawn: spawnDockCrew, count: 5 },
    ],
  },
  {
    title: 'The Harbor Vault',
    pay: 900, rep: 30,
    intro: [
      ['Odile Vane', 'The big one. The harbor stronghouse — the vault — holds a bond ledger that ruins the wrong people. My people cut the door; you hold the yard while it opens.'],
      ['Jax Rook', 'And when the alarm goes?'],
      ['Odile Vane', 'It goes the moment you start. Hold six breaths, take the ledger, and then — Jax — disappear. No ledger matters if you are in a cell. Shake the stars off.'],
    ],
    outro: [
      ['Odile Vane', 'The ledger is ash and the right people are sweating. One job left, and it is the loudest. Rest while you can.'],
    ],
    steps: [
      { type: 'goto', text: 'Go to the Harbor Vault', target: (G) => G.city.vaultPos, radius: 7 },
      { type: 'hold', text: 'Hold the vault yard while the door is cut!', target: (G) => G.city.vaultPos, radius: 9, holdTime: 6, alarm: true },
      { type: 'loseCops', text: 'Lose the police — break sight and lie low!' },
    ],
  },
  {
    title: 'City Limits',
    pay: 1500, rep: 50,
    intro: [
      ['Odile Vane', 'Every crew in Velmara wants that ledger case in your boot, and the PD has your jacket photo now. Take the north-west gate road and do not stop.'],
      ['Jax Rook', 'And after the limits?'],
      ['Odile Vane', 'After the limits, darling, you are a legend with options. Drive.'],
    ],
    outro: [
      ['Odile Vane', 'You made it. Velmara is yours now — every street, every job, every neon mile. I will keep the booth warm. — O.'],
    ],
    steps: [
      { type: 'goto', text: 'RUN — reach the north-west city limits!', target: () => null, fixed: [-224, -224], radius: 9, alarm: true, heat: 105 },
    ],
  },
];

function spawnCoupe(G) {
  const model = CAR_MODELS.find((m) => m.name === 'Orphee GT');
  const car = createCar(G.THREE, G.scene, model, 0x3b2bd8, 118, 84, Math.PI / 2, 'parked');
  car.stolen = false;
  G.cars.push(car);
  G.missionCar = car;
}

function spawnDockCrew(G) {
  const c = G.city.dockCrewPos;
  const spots = [[0, 0], [9, 5], [-8, 7], [5, -9], [-6, -6]];
  for (const [dx, dz] of spots) {
    G.thugs.push(createThug(G.THREE, G.scene, c.x + dx, c.z + dz, 'dockcrew'));
  }
}

export function initStory(G) {
  G.story = {
    idx: 0,
    phase: 'meet',       // meet | active | free
    step: 0,
    stepTimer: null,
    holdProgress: 0,
    stepSpawned: false,
    thugsLeft: 0,
    activity: null,      // {kind:'race'|'courier', ...}
    finished: false,
  };
  G.missionCar = null;
}

function currentMission(G) {
  return MISSIONS[G.story.idx] || null;
}

function stepTarget(G, step) {
  if (!step) return null;
  if (step.fixed) return V3(G, step.fixed[0], step.fixed[1]);
  if (step.type === 'steal' && G.missionCar) return G.missionCar.mesh.position;
  if (step.target) return step.target(G);
  return null;
}

function beginStep(G) {
  const st = G.story;
  const mission = currentMission(G);
  const step = mission.steps[st.step];
  st.stepSpawned = false;
  st.holdProgress = 0;
  st.stepTimer = step.timer || null;
  if (step.heat) G.wanted.heat = Math.max(G.wanted.heat, step.heat), G.wanted.lastCrimeAt = G.time;
  if (step.spawn && !st.stepSpawned) {
    step.spawn(G);
    st.stepSpawned = true;
    if (step.type === 'clear') st.thugsLeft = step.count;
  }
  if (step.type === 'hold' && step.alarm) {
    G.reportCrime('vaultAlarm', G.playerPos());
    G.toast('ALARM! The vault crew is cutting — hold the yard!');
  }
}

function completeMission(G) {
  const st = G.story;
  const mission = currentMission(G);
  G.earnCash(mission.pay);
  G.rep += mission.rep;
  G.sound.missionDone();
  G.showBanner(`MISSION COMPLETE`, `${mission.title} · +$${mission.pay} · +${mission.rep} REP`);
  G.showDialogue(mission.outro, () => {});
  st.idx++;
  st.step = 0;
  if (G.missionCar && G.missionCar !== G.player.car) {
    G.removeCar(G.missionCar);
  }
  G.missionCar = null;
  if (st.idx >= MISSIONS.length) {
    st.phase = 'free';
    st.finished = true;
    G.showBanner('STORY COMPLETE', 'Velmara is yours — races and courier work stay open.');
  } else {
    st.phase = 'meet';
  }
  G.saveGame();
}

function failMission(G, why) {
  const st = G.story;
  G.toast(`Job blown: ${why}. Odile is waiting at the booth.`);
  if (G.missionCar && G.missionCar !== G.player.car) G.removeCar(G.missionCar);
  G.missionCar = null;
  st.phase = 'meet';
  st.step = 0;
}

export function storyEvent(G, evt) {
  const st = G.story;
  if (!st || st.phase !== 'active') return;
  const mission = currentMission(G);
  const step = mission.steps[st.step];
  if (evt === 'enteredMissionCar' && step.type === 'steal') {
    advanceStep(G);
  }
  if (evt === 'thugDown' && step.type === 'clear') {
    st.thugsLeft = G.thugs.filter((t) => t.turf === 'dockcrew' && !t.dead).length;
    if (st.thugsLeft <= 0) advanceStep(G);
  }
}

function advanceStep(G) {
  const st = G.story;
  st.step++;
  const mission = currentMission(G);
  if (st.step >= mission.steps.length) completeMission(G);
  else beginStep(G);
}

/** The per-frame story brain: objectives, markers, timers, activities. */
export function updateStory(G, dt) {
  const st = G.story;
  if (!st) return;
  const playerPos = G.playerPos();
  let beaconTarget = null;
  let objective = '';

  if (st.activity) {
    updateActivity(G, dt);
    return;
  }

  if (st.phase === 'meet') {
    const mission = currentMission(G);
    beaconTarget = G.city.boothPos;
    objective = mission
      ? `Meet Odile Vane at her booth — next job: “${mission.title}”`
      : 'Free roam — the city is yours.';
    if (!G.player.car && playerPos.distanceTo(G.city.boothPos) < 4.2 && !G.dialogueActive) {
      st.phase = 'active';
      st.step = 0;
      G.showDialogue(mission.intro, () => beginStep(G));
    }
  } else if (st.phase === 'active') {
    const mission = currentMission(G);
    const step = mission.steps[st.step];
    const target = stepTarget(G, step);
    beaconTarget = target;
    objective = `${mission.title} — ${step.text}`;
    if (st.stepTimer !== null) {
      st.stepTimer -= dt;
      objective += ` · ${Math.max(0, Math.ceil(st.stepTimer))}s`;
      if (st.stepTimer <= 0) { failMission(G, 'out of time'); G.setObjective(''); return; }
    }
    if (step.type === 'goto' && target) {
      if (step.needsMissionCar && G.player.car !== G.missionCar) {
        objective += ' (in the coupe!)';
      } else if (playerPos.distanceTo(target) < step.radius) {
        advanceStep(G);
        G.setObjective('');
        return;
      }
    } else if (step.type === 'hold' && target) {
      if (playerPos.distanceTo(target) < step.radius) {
        st.holdProgress += dt;
        objective += ` · cutting… ${Math.min(100, Math.floor((st.holdProgress / step.holdTime) * 100))}%`;
        if (st.holdProgress >= step.holdTime) {
          G.toast('The vault is open — ledger secured! Now vanish.');
          advanceStep(G);
          G.setObjective('');
          return;
        }
      } else {
        objective += ' — get back to the vault!';
      }
    } else if (step.type === 'loseCops') {
      objective += ` · wanted ${'★'.repeat(G.wanted.stars)}`;
      if (G.wanted.stars === 0) {
        advanceStep(G);
        G.setObjective('');
        return;
      }
    } else if (step.type === 'clear') {
      objective += ` · crew left: ${st.thugsLeft}`;
    }
  } else if (st.phase === 'free') {
    objective = 'Free roam — race pad on the Mile, courier pad at the Market. Or just enjoy the rain.';
  }

  // activity pads invite when no mission is mid-step
  if ((st.phase === 'meet' || st.phase === 'free') && !G.dialogueActive) {
    if (playerPos.distanceTo(G.city.raceStartPos) < 5) {
      G.setPrompt('RACE', 'start the checkpoint race');
      if (G.consumeKey('KeyE')) startRace(G);
    } else if (playerPos.distanceTo(G.city.courierPos) < 5) {
      G.setPrompt('COURIER', 'take a courier run');
      if (G.consumeKey('KeyE')) startCourier(G);
    }
  }

  if (beaconTarget) {
    G.city.beacon.visible = true;
    G.city.beacon.position.set(beaconTarget.x, 30, beaconTarget.z);
  } else {
    G.city.beacon.visible = false;
  }
  G.setObjective(objective, beaconTarget);
}

// ---------- repeatable activities ----------

function startRace(G) {
  const ring = [[-52, -52], [52, -104], [156, -52], [104, 52], [156, 156], [0, 156], [-104, 104], [-156, -104]];
  G.story.activity = {
    kind: 'race', checkpoints: ring.map(([x, z]) => V3(G, x, z)),
    idx: 0, elapsed: 0, par: 150,
  };
  G.toast('RACE! Hit every checkpoint — gold pays $400.');
  G.sound.cash();
}

function startCourier(G) {
  const spots = [[-150, -40], [60, -150], [170, 60], [-60, 170], [120, -180], [-180, -120], [40, 90]];
  const [dx, dz] = spots[Math.floor(G.rng() * spots.length)];
  const dist = Math.hypot(dx - G.city.courierPos.x, dz - G.city.courierPos.z);
  G.story.activity = {
    kind: 'courier', target: V3(G, dx, dz),
    timeLeft: Math.max(45, dist * 0.55), pay: Math.round(90 + dist * 0.55),
  };
  G.toast('COURIER: package aboard — deliver across town.');
}

function updateActivity(G, dt) {
  const st = G.story;
  const a = st.activity;
  const playerPos = G.playerPos();
  if (a.kind === 'race') {
    a.elapsed += dt;
    const cp = a.checkpoints[a.idx];
    G.city.beacon.visible = true;
    G.city.beacon.position.set(cp.x, 30, cp.z);
    G.setObjective(`Checkpoint race — gate ${a.idx + 1}/${a.checkpoints.length} · ${a.elapsed.toFixed(1)}s`, cp);
    if (playerPos.distanceTo(cp) < 8) {
      a.idx++;
      G.sound.cash();
      if (a.idx >= a.checkpoints.length) {
        const pay = a.elapsed <= a.par ? 400 : a.elapsed <= a.par * 1.4 ? 250 : 150;
        G.earnCash(pay);
        G.rep += 6;
        G.showBanner('RACE FINISHED', `${a.elapsed.toFixed(1)}s · +$${pay}`);
        st.activity = null;
        G.saveGame();
      }
    }
    return;
  }
  // courier
  a.timeLeft -= dt;
  G.city.beacon.visible = true;
  G.city.beacon.position.set(a.target.x, 30, a.target.z);
  G.setObjective(`Courier delivery · $${a.pay} · ${Math.max(0, Math.ceil(a.timeLeft))}s`, a.target);
  if (a.timeLeft <= 0) {
    G.toast('Courier run expired — the client is furious.');
    st.activity = null;
    return;
  }
  if (playerPos.distanceTo(a.target) < 6) {
    G.earnCash(a.pay);
    G.rep += 4;
    G.sound.cash();
    G.showBanner('DELIVERED', `Courier run complete · +$${a.pay}`);
    st.activity = null;
    G.saveGame();
  }
}
