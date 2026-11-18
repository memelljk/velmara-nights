// interface.js — everything the player reads: the HUD (cash, rep, clock,
// wanted stars, health, bust meter, speed, ammo), the live minimap and the
// full city map, objective text, prompts, toasts, banners, dialogue boxes
// and the title / pause / end screens.

const REP_RANKS = [
  [0, 'ROOK'], [40, 'DRIVER'], [100, 'WHEELMAN'], [180, 'OPERATOR'], [280, 'VELMARA LEGEND'],
];

export function rankForRep(rep) {
  let name = 'ROOK';
  for (const [need, label] of REP_RANKS) if (rep >= need) name = label;
  return name;
}

export function initInterface(G) {
  const $ = (id) => document.getElementById(id);
  G.ui = {
    hud: $('hud'), cash: $('hudCash'), rep: $('hudRep'), clock: $('hudClock'),
    stars: $('hudStars'), objective: $('hudObjective'), banner: $('hudBanner'),
    health: $('hudHealth'), bustWrap: $('hudBustWrap'), bust: $('hudBust'),
    speed: $('hudSpeed'), ammo: $('hudAmmo'), carName: $('hudCarName'),
    prompt: $('hudPrompt'), dialogue: $('hudDialogue'), dlgName: $('dlgName'),
    dlgText: $('dlgText'), toast: $('hudToast'), crosshair: $('crosshair'),
    vignette: $('damageVignette'),
    minimap: $('minimap').getContext('2d'),
    bigMap: $('bigMap'), bigMapCtx: $('bigMapCanvas').getContext('2d'),
    title: $('titleScreen'), pause: $('pauseScreen'), end: $('endScreen'),
    endWord: $('endWord'), endDetail: $('endDetail'), pauseStats: $('pauseStats'),
    srStatus: $('srStatus'),
    bannerUntil: 0, toastUntil: 0, dialogueQueue: [], dialogueDone: null,
    objectiveText: '', objectiveTarget: null, promptKey: null, promptAction: null,
  };
  const ui = G.ui;

  G.setObjective = (text, target = null) => {
    ui.objectiveText = text;
    ui.objectiveTarget = target;
  };
  G.setPrompt = (key, action) => {
    ui.promptKey = key;
    ui.promptAction = action;
  };
  G.clearPrompt = () => {
    ui.promptKey = null;
    ui.promptAction = null;
  };
  G.toast = (text) => {
    ui.toast.textContent = text;
    ui.toast.classList.remove('hidden');
    ui.toastUntil = G.time + 3.2;
    ui.srStatus.textContent = text;
  };
  G.showBanner = (big, small = '') => {
    ui.banner.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
    ui.banner.classList.remove('hidden');
    ui.bannerUntil = G.time + 2.8;
  };
  G.showDialogue = (lines, onDone) => {
    ui.dialogueQueue = [...lines];
    ui.dialogueDone = onDone || null;
    G.dialogueActive = true;
    renderDialogueLine(G);
  };
  G.advanceDialogue = () => {
    if (!G.dialogueActive) return;
    ui.dialogueQueue.shift();
    if (ui.dialogueQueue.length === 0) {
      G.dialogueActive = false;
      ui.dialogue.classList.add('hidden');
      const done = ui.dialogueDone;
      ui.dialogueDone = null;
      if (done) done();
    } else {
      renderDialogueLine(G);
    }
  };

  $('btnNewGame').addEventListener('click', () => { G.sound.start(); G.startGame(false); });
  $('btnContinue').addEventListener('click', () => { G.sound.start(); G.startGame(true); });
  $('btnHowTo').addEventListener('click', () => $('howTo').classList.toggle('hidden'));
  $('btnResume').addEventListener('click', () => G.togglePause(false));
  $('btnSaveQuit').addEventListener('click', () => { G.saveGame(); G.toTitle(); });
  if (!G.hasSave()) $('btnContinue').style.opacity = '0.45';

  return ui;
}

function renderDialogueLine(G) {
  const ui = G.ui;
  const [who, text] = ui.dialogueQueue[0];
  ui.dlgName.textContent = who.toUpperCase();
  ui.dlgText.textContent = text;
  ui.dialogue.classList.remove('hidden');
}

export function showEndScreen(G, word, detail, busted) {
  const ui = G.ui;
  ui.endWord.textContent = word;
  ui.endDetail.textContent = detail;
  ui.end.classList.toggle('busted', !!busted);
  ui.end.classList.remove('hidden');
}

export function hideEndScreen(G) {
  G.ui.end.classList.add('hidden');
}

/** Per-frame HUD refresh + minimap. Big map redraws while open. */
export function updateHud(G, dt) {
  const ui = G.ui;
  const playing = G.mode === 'play' || G.mode === 'pause';
  ui.hud.classList.toggle('hidden', !playing && G.mode !== 'shot');
  if (!playing && G.mode !== 'shot') return;

  ui.cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
  ui.rep.textContent = `REP ${G.rep} · ${rankForRep(G.rep)}`;
  const mins = Math.floor(G.clockMinutes) % (24 * 60);
  ui.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  // wanted stars
  let starsHtml = '';
  for (let i = 0; i < 5; i++) {
    const lit = i < G.wanted.stars;
    const flash = G.bustMeter > 0.1 && lit && Math.sin(G.time * 10) > 0;
    starsHtml += `<span class="${flash ? 'flash' : lit ? 'lit' : ''}">★</span>`;
  }
  if (ui.stars.innerHTML !== starsHtml) ui.stars.innerHTML = starsHtml;

  // objective + live distance to its marker
  let obj = ui.objectiveText;
  if (obj && ui.objectiveTarget) {
    const d = Math.round(G.playerPos().distanceTo(ui.objectiveTarget));
    obj += ` <span class="objDist">◆ ${d}m</span>`;
  }
  if (ui.objective.innerHTML !== obj) ui.objective.innerHTML = obj;

  ui.health.style.width = `${Math.max(0, G.health)}%`;
  ui.health.style.background = G.health > 45
    ? 'linear-gradient(90deg,#38e08a,#a6ff6b)'
    : G.health > 22 ? 'linear-gradient(90deg,#e0a428,#ffc857)' : '#ff4545';
  ui.bustWrap.classList.toggle('hidden', G.bustMeter <= 0.05);
  ui.bust.style.width = `${(G.bustMeter / 3) * 100}%`;

  if (G.player.car) {
    const kmh = Math.round(Math.abs(G.player.car.speed) * 3.4);
    ui.speed.innerHTML = `${kmh} <small>KM/H</small>`;
    ui.carName.textContent = `${G.player.car.name} · ${Math.ceil(G.player.car.health)}%`;
    ui.ammo.textContent = '';
  } else {
    ui.speed.innerHTML = '';
    ui.carName.textContent = '';
    ui.ammo.textContent = G.reloading > 0 ? 'RELOADING…' : `PISTOL ${G.ammo} / ${G.reserveAmmo}`;
  }
  ui.crosshair.classList.toggle('hidden', !!G.player.car || G.dialogueActive);

  if (ui.promptKey) {
    ui.prompt.innerHTML = `<b>${ui.promptKey}</b>${ui.promptAction}`;
    ui.prompt.classList.remove('hidden');
  } else {
    ui.prompt.classList.add('hidden');
  }
  if (G.time > ui.bannerUntil) ui.banner.classList.add('hidden');
  if (G.time > ui.toastUntil) ui.toast.classList.add('hidden');
  ui.vignette.style.opacity = String(Math.max(0, G.damageFlash || 0));

  drawMinimap(G, ui.minimap, 196);
  if (G.bigMapOpen) drawBigMap(G, ui.bigMapCtx, 760);
}

function worldToMap(v, size) {
  return (v + 250) / 500 * size;
}

function drawRoads(ctx, size) {
  ctx.strokeStyle = 'rgba(140,150,190,0.5)';
  ctx.lineWidth = Math.max(2, size * 0.016);
  const avenues = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
  for (const a of avenues) {
    const p = worldToMap(a, size);
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
}

function drawBlips(G, ctx, size, withPeds) {
  const t = G.time;
  // objective diamond
  if (G.ui.objectiveTarget) {
    const tx = worldToMap(G.ui.objectiveTarget.x, size);
    const ty = worldToMap(G.ui.objectiveTarget.z, size);
    ctx.fillStyle = '#ffc857';
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.PI / 4);
    const s = size * 0.016 + Math.sin(t * 5) * 1.2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  // traffic + parked cars
  ctx.fillStyle = 'rgba(200,205,220,0.75)';
  for (const car of G.cars) {
    if (car.kind === 'police') continue;
    ctx.fillRect(worldToMap(car.mesh.position.x, size) - 1.5, worldToMap(car.mesh.position.z, size) - 1.5, 3, 3);
  }
  if (withPeds) {
    ctx.fillStyle = 'rgba(240,220,255,0.5)';
    for (const ped of G.peds) {
      if (ped.dead) continue;
      ctx.fillRect(worldToMap(ped.mesh.position.x, size) - 1, worldToMap(ped.mesh.position.z, size) - 1, 2, 2);
    }
  }
  // police blips flash red/blue
  for (const cop of G.cops) {
    if (!cop.active) continue;
    ctx.fillStyle = Math.sin(t * 9 + cop.flashPhase) > 0 ? '#ff4545' : '#4d8dff';
    ctx.beginPath();
    ctx.arc(worldToMap(cop.mesh.position.x, size), worldToMap(cop.mesh.position.z, size), size * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const o of G.officers) {
    ctx.fillStyle = '#4d8dff';
    ctx.fillRect(worldToMap(o.mesh.position.x, size) - 2, worldToMap(o.mesh.position.z, size) - 2, 4, 4);
  }
  // player arrow
  const p = G.playerPos();
  const px = worldToMap(p.x, size), py = worldToMap(p.z, size);
  const heading = G.player.car ? G.player.car.heading : G.player.heading;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - heading); // canvas up (-y) is world -z; heading 0 faces +z
  ctx.fillStyle = '#2ee6ff';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.02);
  ctx.lineTo(size * 0.012, size * 0.014);
  ctx.lineTo(-size * 0.012, size * 0.014);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMinimap(G, ctx, size) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0d0a1c';
  ctx.fillRect(0, 0, size, size);
  // harbor water along the south edge
  ctx.fillStyle = 'rgba(30,110,160,0.65)';
  ctx.fillRect(0, worldToMap(246, size), size, size - worldToMap(246, size));
  drawRoads(ctx, size);
  drawBlips(G, ctx, size, false);
}

function drawBigMap(G, ctx, size) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0a0618';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(30,110,160,0.5)';
  ctx.fillRect(0, worldToMap(246, size), size, size - worldToMap(246, size));
  drawRoads(ctx, size);
  ctx.font = `700 ${Math.round(size * 0.026)}px "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(242,236,255,0.85)';
  ctx.textAlign = 'center';
  const labels = [
    ['NEON MILE', 0, -20], ['HARBOR', 30, 205], ['OLD MARKET', 104, 26],
    ['THE HEIGHTS', -60, -180], ['DOCKYARDS', -150, 110], ['ST. MIRELLA HOSPITAL', -150, -132],
    ['ODILE — JOBS', 22, 48], ['VAULT', 64, 214],
  ];
  for (const [name, x, z] of labels) ctx.fillText(name, worldToMap(x, size), worldToMap(z, size));
  drawBlips(G, ctx, size, true);
}
