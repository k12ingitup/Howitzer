import { CFG } from './config';
import { Terrain } from './engine/terrain';
import { launchVelocity } from './engine/physics';
import { collidesWithTerrain } from './engine/collision';
import { WEAPONS } from './weapons/registry';
import { ActiveProjectile } from './weapons/types';
import { Tank, applyExplosion, spawnClusterChildren, spawnExplosionParticles } from './weapons/behaviors';
import { createMatch, advanceTurn, isMatchOver, winner, recordShotResult, consumeWeapon } from './game/match';
import { MatchState, MatchConfig } from './game/state';
import { aiChooseShot } from './ai/opponent';
import { Renderer, ScorePopup } from './render/renderer';
import { Particle } from './render/particles';
import { syncHUD } from './ui/hud';
import { renderArsenal } from './ui/arsenal';
import { setupAimInput } from './input/aim';

// DOM refs
const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const angleEl = document.getElementById('angle') as HTMLInputElement;
const powerEl = document.getElementById('power') as HTMLInputElement;
const angleR = document.getElementById('angleR')!;
const powerR = document.getElementById('powerR')!;
const fireBtn = document.getElementById('fire') as HTMLButtonElement;
const overlay = document.getElementById('overlay')!;
const draftEl = document.getElementById('draft')!;
const wepsEl = document.getElementById('weps')!;

// Game vars
let W = 0, H = 0;
let terrain: Terrain;
let tanks: Tank[] = [];
let match: MatchState;
let particles: Particle[] = [];
let proj: ActiveProjectile | null = null;
let clusterProjs: ActiveProjectile[] = [];
let tracerProjs: ActiveProjectile[] = [];
let assist = true;
let devMode = true;
export interface TracerMarker { x: number; y: number; offset: number; }
let tracerMarkers: TracerMarker[] = [];
let tracerTimeout: ReturnType<typeof setTimeout> | null = null;
let popups: ScorePopup[] = [];
let turnBanner = { text: '', alpha: 0, timer: 0 };
const renderer = new Renderer(ctx, () => W, () => H);

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const newW = Math.max(320, Math.floor(r.width));
  const newH = Math.max(240, Math.floor(r.height));
  if (terrain && (newW !== W || newH !== H)) {
    terrain.resize(newW, newH, H);
    for (const t of tanks) {
      t.x = Math.min(newW - 20, Math.max(20, Math.round(t.x * newW / W)));
      t.y = terrain.surfaceY(t.x);
    }
  }
  W = newW; H = newH;
  cv.width = Math.floor(W * dpr);
  cv.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

type MenuMode = 'cpu-easy' | 'cpu-hard' | 'pvp';
type GameModeChoice = 'score' | 'annihilation';

function newGame(menuMode: MenuMode, gameMode: GameModeChoice): void {
  const cpu = menuMode.startsWith('cpu');
  const difficulty = menuMode === 'cpu-hard' ? 'hard' : 'easy';
  const config: MatchConfig = {
    mode: gameMode,
    shotsPerPlayer: CFG.SHOTS_PER_PLAYER,
    p2IsAI: cpu,
    aiDifficulty: difficulty,
  };
  match = createMatch(config);
  particles = [];
  proj = null;
  clusterProjs = [];
  tracerMarkers = [];
  popups = [];
  turnBanner = { text: '', alpha: 0, timer: 0 };
  renderer.shake = 0;
  renderer.flashAlpha = 0;

  terrain = new Terrain(W, H);
  terrain.generate();

  const lx = Math.round(W * (0.10 + Math.random() * 0.06));
  const rx = Math.round(W * (0.84 + Math.random() * 0.06));
  terrain.flattenAt(lx, 32);
  terrain.flattenAt(rx, 32);

  tanks = [
    { x: lx, y: terrain.surfaceY(lx), hp: 100, score: 0, color: CFG.P1_COLOR, name: 'Player 1', ai: false, skill: 1, dir: 1 },
    {
      x: rx, y: terrain.surfaceY(rx), hp: 100, score: 0,
      color: CFG.P2_COLOR,
      name: cpu ? (difficulty === 'hard' ? 'Veteran' : 'Cadet') : 'Player 2',
      ai: cpu, skill: difficulty === 'hard' ? 0.85 : 0.45, dir: -1,
    },
  ];

  overlay.classList.add('hidden');
  showDraft();
}

// ---- Draft screen ----
function showDraft(): void {
  match.phase = 'draft';
  const p1Name = document.getElementById('draft-p1-name')!;
  const p2Name = document.getElementById('draft-p2-name')!;
  const w1El = document.getElementById('draft-p1-weapons')!;
  const w2El = document.getElementById('draft-p2-weapons')!;
  p1Name.textContent = tanks[0].name;
  p2Name.textContent = tanks[1].name;
  p1Name.style.color = CFG.P1_COLOR;
  p2Name.style.color = CFG.P2_COLOR;

  function weaponListHTML(weapons: typeof match.arsenals[0]): string {
    return weapons.map(w =>
      `<li data-rarity="${w.rarity}">
        <span class="di">${w.icon}</span>
        <span class="dn">${w.name}</span>
        <span class="ds">${w.sub}</span>
       </li>`
    ).join('');
  }
  w1El.innerHTML = weaponListHTML(match.arsenals[0]);
  w2El.innerHTML = weaponListHTML(match.arsenals[1]);
  draftEl.classList.remove('hidden');
}

document.getElementById('draft-start')!.addEventListener('click', () => {
  draftEl.classList.add('hidden');
  // Set sensible defaults only at game start (not between turns)
  setAngle(50); setPower(55);
  doRenderArsenal();
  syncMatchHUD();
  beginTurn();
});

// ---- Arsenal ----
function doRenderArsenal(): void {
  const hand = match.arsenals[match.turn];
  renderArsenal(wepsEl, hand, match.selectedWeapon[match.turn], i => {
    match.selectedWeapon[match.turn] = i;
    doRenderArsenal();
    // Update accent color to match selected weapon
    const w = hand[i];
    if (w) document.documentElement.style.setProperty('--accent', w.color);
  });
}

// ---- Turn flow ----
function beginTurn(): void {
  match.phase = 'aim';
  // Do NOT reset angle/power — player adjusts from last shot
  doRenderArsenal();
  syncMatchHUD();
  fireBtn.disabled = false;
  const t = tanks[match.turn];
  if (t.ai) { fireBtn.disabled = true; setTimeout(doAITurn, 800); }
}

function showTurnTransition(nextName: string, cb: () => void): void {
  match.phase = 'transition';
  turnBanner.text = nextName + "'s turn";
  turnBanner.alpha = 1;
  turnBanner.timer = 1100;
  syncMatchHUD();
  setTimeout(() => { turnBanner.alpha = 0; cb(); }, 1100);
}

function endTurn(consumedShot: boolean): void {
  if (consumedShot && !devMode) consumeWeapon(match);
  if (isMatchOver(match)) return doGameOver();
  advanceTurn(match);
  if (isMatchOver(match)) return doGameOver();
  showTurnTransition(tanks[match.turn].name, beginTurn);
}

function doGameOver(): void {
  match.phase = 'over';
  const w = winner(match);
  const winnerName = w === -1 ? 'Draw' : (w === 0 ? tanks[0].name : tanks[1].name);
  overlay.querySelector('.sub')!.textContent = 'Battle over';
  (overlay.querySelector('h1') as HTMLElement).textContent =
    winnerName === 'Draw' ? 'DRAW!' : (winnerName + ' WINS').toUpperCase();
  overlay.querySelector('p')!.textContent =
    match.config.mode === 'score'
      ? `Final score: ${match.scores[0]} – ${match.scores[1]}`
      : (w === -1 ? 'Mutual destruction!' : 'Want a rematch?');
  overlay.classList.remove('hidden');
  fireBtn.disabled = true;
}

// ---- Controls ----
function setAngle(v: number): void {
  v = Math.max(0, Math.min(180, Math.round(v)));
  angleEl.value = String(v); angleR.textContent = v + '°';
}
function setPower(v: number): void {
  v = Math.max(5, Math.min(100, Math.round(v)));
  powerEl.value = String(v); powerR.textContent = String(v);
}
angleEl.addEventListener('input', () => setAngle(+angleEl.value));
powerEl.addEventListener('input', () => setPower(+powerEl.value));

function currentWeapon() {
  return match.arsenals[match.turn][match.selectedWeapon[match.turn]];
}

const TRACER_OFFSETS = [-16, -8, 0, +8, +16];

function makeProjectile(t: Tank, weapon: import('./weapons/types').Weapon, angleDeg: number, power: number, offsetDeg = 0): ActiveProjectile {
  const a = angleDeg + offsetDeg;
  const rad = a * Math.PI / 180;
  const speed = weapon.speedMult ?? 1;
  return {
    x: t.x + Math.cos(rad) * 22,
    y: t.y - 14 - Math.sin(rad) * 22,
    vx: Math.cos(rad) * power * CFG.POWER_SCALE * 0.06 * speed,
    vy: -Math.sin(rad) * power * CFG.POWER_SCALE * 0.06 * speed,
    weapon, owner: match.turn,
    trail: [], dead: false, off: false, childrenSpawned: false,
    tracerOffset: offsetDeg,
  };
}

function doFire(): void {
  if (match.phase !== 'aim') return;
  const weapon = currentWeapon();
  if (!weapon) return;
  const angleDeg = +angleEl.value;
  const power = +powerEl.value;
  const t = tanks[match.turn];

  if (weapon.kind === 'hailstorm') {
    const foe = tanks[1 - match.turn];
    const count = weapon.clusterCount ?? 12;
    clusterProjs = Array.from({ length: count }, () => ({
      x: foe.x + (Math.random() * 240 - 120),
      y: -20,
      vx: Math.random() * 0.03 - 0.015,
      vy: 0.08,
      weapon,
      owner: match.turn,
      trail: [],
      dead: false,
      off: false,
      childrenSpawned: false,
    }));
    match.phase = 'flight-cluster';
    fireBtn.disabled = true;
    syncMatchHUD();
    return;
  }

  if (weapon.kind === 'tracer') {
    tracerMarkers = [];
    tracerProjs = TRACER_OFFSETS.map(off => makeProjectile(t, weapon, angleDeg, power, off));
    match.phase = 'flight-tracer';
    fireBtn.disabled = true;
    syncMatchHUD();
    return;
  }

  proj = makeProjectile(t, weapon, angleDeg, power);
  match.phase = 'flight';
  fireBtn.disabled = true;
  syncMatchHUD();
}
fireBtn.addEventListener('click', doFire);

// ---- Physics ----
function hitTest(p: ActiveProjectile): boolean {
  if (p.x < -60 || p.x > W + 60 || p.y > H + 60) { p.off = true; return true; }
  if (p.tunneling) {
    for (const t of tanks) if (Math.hypot(t.x - p.x, (t.y - 12) - p.y) < 15) return true;
    return false;
  }
  if (collidesWithTerrain(p.x, p.y, terrain, W, H)) return true;
  for (const t of tanks) if (Math.hypot(t.x - p.x, (t.y - 12) - p.y) < 15) return true;
  return false;
}

function hitTestTerrain(p: ActiveProjectile): boolean {
  return collidesWithTerrain(p.x, p.y, terrain, W, H);
}

function onImpact(x: number, y: number, p: ActiveProjectile): void {
  const foeIdx = 1 - p.owner;
  const foe = tanks[foeIdx];
  const dist = Math.hypot(foe.x - x, (foe.y - 10) - y);
  const damages = applyExplosion(x, y, p.weapon, terrain, tanks, particles, p.owner);
  const dmg = damages[foeIdx] ?? 0;
  const pts = recordShotResult(match, dist, dmg, p.weapon, foeIdx);

  renderer.shake = Math.min(16, p.weapon.shakeAmount);
  // Flash brightness proportional to damage
  renderer.flashAlpha = Math.min(0.45, (p.weapon.blastRadius / 64) * 0.45);

  for (const t of tanks) t.y = terrain.surfaceY(t.x);

  // Score popup
  const popX = x + (Math.random() * 16 - 8);
  if (pts > 0) {
    popups.push({ x: popX, y: y - 50, text: '+' + pts + ' pts', life: 1,
      color: p.owner === 0 ? CFG.P1_COLOR : CFG.P2_COLOR });
  }
  // Hit data popup (always show in dev mode, or when scoring)
  if (devMode || pts > 0 || dmg > 0) {
    const distLabel = Math.round(dist) + 'px away';
    const dmgLabel = dmg > 0 ? ' · -' + dmg + 'hp' : '';
    popups.push({ x: popX, y: y - 24, text: distLabel + dmgLabel, life: 0.85,
      color: 'rgba(244,236,223,0.7)', small: true });
  }
  syncMatchHUD();
}

function finishShot(p: ActiveProjectile): void {
  if (!p.off) {
    if (p.weapon.kind === 'tunneler') spawnTunnelEruption(p.x, p.y);
    onImpact(p.x, p.y, p);
  }
  proj = null;
  afterImpact(p.weapon.consumesShot);
}

function spawnTunnelEruption(x: number, y: number): void {
  // Upward debris burst — heavy rocks + dirt
  for (let i = 0; i < 32; i++) {
    const a = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.85;
    const s = Math.random() * 0.38 + 0.1;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1.2 + Math.random() * 0.5, r: Math.random() * 5 + 2,
      hue: Math.random() < 0.5 ? '#b9853f' : '#ffce6b' });
  }
  // Dirt clods
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI;
    const s = Math.random() * 0.55 + 0.2;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1.5 + Math.random() * 0.4, r: Math.random() * 8 + 4,
      hue: '#8B5E3C' });
  }
}

function stepTracers(dt: number): void {
  const h = dt / CFG.SUBSTEPS;
  for (const p of tracerProjs) {
    if (p.dead) continue;
    for (let s = 0; s < CFG.SUBSTEPS; s++) {
      p.vy += CFG.GRAV * h;
      p.vx += match.wind * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (p.x < -60 || p.x > W + 60 || p.y > H + 60) { p.dead = true; p.off = true; break; }
      if (collidesWithTerrain(p.x, p.y, terrain, W, H)) { p.dead = true; break; }
    }
    if (!p.off && !p.tunneling) {
      if (p.trail.length > 18) p.trail.shift();
      p.trail.push({ x: p.x, y: p.y });
    }
    if (p.dead && !p.off) {
      tracerMarkers.push({ x: p.x, y: p.y, offset: p.tracerOffset ?? 0 });
    }
  }
  if (tracerProjs.every(p => p.dead)) {
    tracerProjs = [];
    if (tracerTimeout) clearTimeout(tracerTimeout);
    tracerTimeout = setTimeout(() => { tracerMarkers = []; }, 5000);
    match.phase = 'aim';
    fireBtn.disabled = false;
    syncMatchHUD();
  }
}

function afterImpact(consumedShot: boolean): void {
  match.phase = 'settle';
  syncMatchHUD();
  setTimeout(() => endTurn(consumedShot), 600);
}

function stepFlight(dt: number): void {
  if (!proj) return;
  const p = proj;
  const h = dt / CFG.SUBSTEPS;
  const foe = tanks[1 - p.owner];

  for (let s = 0; s < CFG.SUBSTEPS; s++) {
    p.vy += CFG.GRAV * h;
    p.vx += match.wind * h;

    if (p.weapon.kind === 'homing') {
      const dx = foe.x - p.x;
      const dy = (foe.y - 12) - p.y;
      const dist = Math.hypot(dx, dy) + 1;
      const str = 0.0018 * h;
      p.vx += (dx / dist) * str;
      p.vy += (dy / dist) * str;
    }

    p.x += p.vx * h;
    p.y += p.vy * h;

    if ((p.weapon.kind === 'cluster' || p.weapon.kind === 'mirv') && !p.childrenSpawned && p.vy > 0 && p.y < H * 0.55) {
      p.childrenSpawned = true;
      clusterProjs = spawnClusterChildren(p);
      p.dead = true; break;
    }

    if (p.weapon.kind === 'tunneler' && !p.tunneling && hitTestTerrain(p)) {
      p.tunneling = true;
      p.tunnelSteps = 70;
      p.tunnelEntryX = p.x;
      p.tunnelEntryY = terrain.surfaceY(p.x);
      p.vy = Math.abs(p.vy) * 0.5 + 0.04;
      p.vx *= 0.2;
      continue;
    }
    if (p.tunneling) {
      p.tunnelSteps = (p.tunnelSteps ?? 0) - 1;
      if (p.tunnelSteps <= 0) { p.dead = true; break; }
      continue;
    }

    if (p.weapon.kind === 'bouncer' && hitTestTerrain(p)) {
      if ((p.bounceCount ?? 0) < 4) {
        p.vy *= -0.65;
        p.vx *= 0.85;
        p.bounceCount = (p.bounceCount ?? 0) + 1;
        p.y -= 3;
        continue;
      } else {
        p.dead = true;
        break;
      }
    }

    if (!p.rolling && p.weapon.kind === 'roller' && hitTestTerrain(p)) {
      p.rolling = true;
      p.rollDir = p.vx >= 0 ? 1 : -1;
      p.rollDist = 0;
      p.y = terrain.surfaceY(p.x);
      p.vx = 0; p.vy = 0;
    }

    if (!p.dead && !p.tunneling) {
      if (p.rolling) {
        p.x += (p.rollDir ?? 1) * 1.2;
        p.y = terrain.surfaceY(p.x);
        p.rollDist = (p.rollDist ?? 0) + 1.2;
        for (const t of tanks) if (Math.hypot(t.x - p.x, (t.y - 12) - p.y) < 18) { p.dead = true; break; }
        if (!p.dead && ((p.rollDist ?? 0) > 130 || p.x < 10 || p.x > W - 10)) p.dead = true;
      } else {
        if (hitTest(p)) { p.dead = true; break; }
      }
    }
  }

  if (!p.tunneling && !p.rolling) {
    if (p.trail.length > 26) p.trail.shift();
    p.trail.push({ x: p.x, y: p.y });
  }

  if (p.dead) {
    if (clusterProjs.length > 0) { proj = null; match.phase = 'flight-cluster'; }
    else finishShot(p);
  }
}

function stepClusters(dt: number): void {
  const h = dt / CFG.SUBSTEPS;
  for (const p of clusterProjs) {
    if (p.dead) continue;
    for (let s = 0; s < CFG.SUBSTEPS; s++) {
      p.vy += CFG.GRAV * h; p.vx += match.wind * h;
      p.x += p.vx * h; p.y += p.vy * h;
      if (hitTest(p)) { p.dead = true; if (!p.off) onImpact(p.x, p.y, p); break; }
    }
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 16) p.trail.shift();
  }
  if (clusterProjs.every(p => p.dead)) {
    clusterProjs = [];
    afterImpact(true);
  }
}

// ---- AI ----
function doAITurn(): void {
  const me = tanks[match.turn];
  const foe = tanks[1 - match.turn];
  const hand = match.arsenals[match.turn];
  // Pick weapon with highest damage
  const bestWepIdx = hand.reduce((bi, w, i) => w.damage > hand[bi].damage ? i : bi, 0);
  match.selectedWeapon[match.turn] = bestWepIdx;
  doRenderArsenal();
  const { angleDeg, power } = aiChooseShot(me, foe, match.wind, me.skill, W, H, x => terrain.surfaceY(x));
  setAngle(angleDeg); setPower(power); syncMatchHUD();
  setTimeout(() => {
    const weapon = currentWeapon();
    if (!weapon) return;
    const rad = angleDeg * Math.PI / 180;
    proj = {
      x: me.x + Math.cos(rad) * 22,
      y: me.y - 14 - Math.sin(rad) * 22,
      vx: Math.cos(rad) * (power * CFG.POWER_SCALE * 0.06),
      vy: -Math.sin(rad) * (power * CFG.POWER_SCALE * 0.06),
      weapon, owner: match.turn,
      trail: [], dead: false, off: false, childrenSpawned: false,
    };
    match.phase = 'flight'; syncMatchHUD();
  }, 500);
}

// ---- HUD ----
function syncMatchHUD(): void {
  if (!match || !tanks[0]) return;
  syncHUD({
    p1Name: tanks[0].name, p2Name: tanks[1]?.name ?? 'CPU',
    p1Score: match.scores[0], p2Score: match.scores[1],
    p1ShotsLeft: match.arsenals[0].length, p2ShotsLeft: match.arsenals[1].length,
    p1HP: match.hp[0], p2HP: match.hp[1],
    wind: match.wind, turn: match.turn, phase: match.phase,
    p1AI: tanks[0].ai, p2AI: tanks[1]?.ai ?? false,
    mode: match.config.mode,
    accentColor: currentWeapon()?.color ?? tanks[match.turn]?.color ?? '#fff',
  });
}

// ---- Buttons ----
const assistBtn = document.getElementById('assistBtn')!;
assistBtn.classList.add('on');
assistBtn.addEventListener('click', e => {
  assist = !assist;
  (e.target as HTMLElement).classList.toggle('on', assist);
});
document.getElementById('devBtn')!.addEventListener('click', e => {
  devMode = !devMode;
  (e.target as HTMLElement).classList.toggle('on', devMode);
});
document.getElementById('menuBtn')!.addEventListener('click', () => {
  if (match) match.phase = 'menu';
  overlay.querySelector('.sub')!.textContent = 'Artillery Duel';
  (overlay.querySelector('h1') as HTMLElement).textContent = 'HOWITZER';
  overlay.querySelector('p')!.textContent = 'Earn points by landing shots near your opponent. Most points after 10 shots wins.';
  overlay.classList.remove('hidden');
});
overlay.querySelectorAll('[data-mode]').forEach(btn => {
  const b = btn as HTMLElement;
  b.addEventListener('click', () => {
    newGame(b.dataset.mode as MenuMode, (b.dataset.gamemode ?? 'score') as GameModeChoice);
  });
});

setupAimInput(
  cv,
  () => (match?.phase === 'aim' && !tanks[match.turn]?.ai)
    ? { x: tanks[match.turn].x, y: tanks[match.turn].y } : null,
  () => match?.phase === 'aim',
  (ang, power) => { setAngle(ang); setPower(power); }
);

// ---- Render loop ----
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(CFG.MAX_DT, now - last); last = now;
  ctx.save();
  renderer.applyShake();
  renderer.drawSky();

  if (match?.phase !== 'menu' && match?.phase !== 'draft' && terrain) {
    terrain.render(ctx);

    if (assist && match.phase === 'aim' && !tanks[match.turn]?.ai) {
      renderer.drawAimArc(tanks[match.turn], +angleEl.value, +powerEl.value, match.wind, terrain);
    }

    for (let i = 0; i < tanks.length; i++) {
      renderer.drawTank(tanks[i], i === match.turn, match.phase, +angleEl.value * Math.PI / 180);
    }

    if (match.phase === 'flight') stepFlight(dt);
    else if (match.phase === 'flight-cluster') stepClusters(dt);
    else if (match.phase === 'flight-tracer') stepTracers(dt);

    const allProjs: ActiveProjectile[] = [];
    if (proj) allProjs.push(proj);
    for (const p of clusterProjs) if (!p.dead) allProjs.push(p);
    for (const p of tracerProjs) if (!p.dead) allProjs.push(p);
    renderer.drawProjectiles(allProjs);
    renderer.updateParticles(particles, dt);
    renderer.drawFlash(dt);
    renderer.drawScorePopups(popups, dt);

    if (tracerMarkers.length > 0) renderer.drawTracerMarkers(tracerMarkers);

    if (turnBanner.alpha > 0) {
      turnBanner.timer -= dt;
      if (turnBanner.timer < 280) turnBanner.alpha = Math.max(0, turnBanner.timer / 280);
      renderer.drawTurnBanner(turnBanner.text, turnBanner.alpha);
    }
  }

  ctx.restore();
  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
