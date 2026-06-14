import { CFG } from './config';
import { Terrain } from './engine/terrain';
import { launchVelocity } from './engine/physics';
import { collidesWithTerrain } from './engine/collision';
import { WEAPONS } from './weapons/registry';
import { ActiveProjectile } from './weapons/types';
import { Tank, applyExplosion, spawnClusterChildren } from './weapons/behaviors';
import { createMatch, advanceTurn, isMatchOver, winner, recordShotResult } from './game/match';
import { MatchState, MatchConfig } from './game/state';
import { aiChooseShot } from './ai/opponent';
import { Renderer } from './render/renderer';
import { Particle } from './render/particles';
import { syncHUD } from './ui/hud';
import { renderArsenal } from './ui/arsenal';
import { setupAimInput } from './input/aim';
import type { MenuMode } from './ui/menus';
import type { GameModeChoice } from './ui/menus';

// ---- DOM refs ----
const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const angleEl = document.getElementById('angle') as HTMLInputElement;
const powerEl = document.getElementById('power') as HTMLInputElement;
const angleR = document.getElementById('angleR')!;
const powerR = document.getElementById('powerR')!;
const fireBtn = document.getElementById('fire') as HTMLButtonElement;
const overlay = document.getElementById('overlay')!;
const wepsEl = document.getElementById('weps')!;

// ---- Game vars ----
let W = 0, H = 0;
let terrain: Terrain;
let tanks: Tank[] = [];
let match: MatchState;
let particles: Particle[] = [];
let proj: ActiveProjectile | null = null;
let clusterProjs: ActiveProjectile[] = [];
let assist = true;
let tracerMarker: { x: number; y: number } | null = null;
let tracerTimeout: ReturnType<typeof setTimeout> | null = null;
const renderer = new Renderer(ctx, () => W, () => H);

// ---- Resize ----
function resize(): void {
  const r = cv.getBoundingClientRect();
  const newW = Math.max(320, Math.floor(r.width));
  const newH = Math.max(240, Math.floor(r.height));
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  if (terrain && (newW !== W || newH !== H)) {
    terrain.resize(newW, newH, H);
    for (const t of tanks) {
      t.x = Math.min(newW - 20, Math.max(20, t.x * newW / W));
      t.y = terrain.surfaceY(t.x);
    }
  }
  W = newW; H = newH;
  cv.width = Math.floor(W * DPR);
  cv.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);

// ---- Arsenal ----
function doRenderArsenal(): void {
  renderArsenal(wepsEl, match.selectedWeapon[match.turn], (i: number) => {
    match.selectedWeapon[match.turn] = i;
    doRenderArsenal();
  });
}

// ---- New game ----
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
  tracerMarker = null;
  renderer.shake = 0;

  terrain = new Terrain(W, H);
  terrain.generate();

  const lx = Math.round(W * (0.10 + Math.random() * 0.06));
  const rx = Math.round(W * (0.84 + Math.random() * 0.06));
  tanks = [
    { x: lx, y: terrain.surfaceY(lx), hp: 100, score: 0, color: '#ff7a3c', name: 'Player 1', ai: false, skill: 1, dir: 1 },
    {
      x: rx, y: terrain.surfaceY(rx), hp: 100, score: 0,
      color: '#3ad9c4',
      name: cpu ? (difficulty === 'hard' ? 'Veteran' : 'Cadet') : 'Player 2',
      ai: cpu,
      skill: difficulty === 'hard' ? 0.85 : 0.45,
      dir: -1,
    },
  ];

  overlay.classList.add('hidden');
  setAngle(50); setPower(55);
  match.selectedWeapon = [0, 0];
  doRenderArsenal();
  syncMatchHUD();
  beginTurn();
}

// ---- Turn flow ----
function beginTurn(): void {
  match.phase = 'aim';
  const t = tanks[match.turn];
  setAngle(t.dir > 0 ? 50 : 130);
  doRenderArsenal();
  syncMatchHUD();
  fireBtn.disabled = false;
  if (t.ai) {
    fireBtn.disabled = true;
    setTimeout(doAITurn, 650);
  }
}

function endTurn(consumedShot: boolean): void {
  if (isMatchOver(match)) {
    return doGameOver();
  }
  advanceTurn(match, consumedShot);
  if (isMatchOver(match)) {
    return doGameOver();
  }
  beginTurn();
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
      : (w === -1 ? 'Mutual destruction!' : 'Direct hit. Want a rematch?');
  overlay.classList.remove('hidden');
  fireBtn.disabled = true;
}

// ---- Firing ----
function setAngle(v: number): void {
  v = Math.max(0, Math.min(180, Math.round(v)));
  angleEl.value = String(v);
  angleR.textContent = v + '°';
}
function setPower(v: number): void {
  v = Math.max(5, Math.min(100, Math.round(v)));
  powerEl.value = String(v);
  powerR.textContent = String(v);
}

angleEl.addEventListener('input', () => setAngle(+angleEl.value));
powerEl.addEventListener('input', () => setPower(+powerEl.value));

function doFire(): void {
  if (match.phase !== 'aim') return;
  const angleDeg = +angleEl.value;
  const power = +powerEl.value;
  const weaponIdx = match.selectedWeapon[match.turn];
  const weapon = WEAPONS[weaponIdx];
  const t = tanks[match.turn];
  const rad = angleDeg * Math.PI / 180;
  const vel = launchVelocity(angleDeg, power);
  proj = {
    x: t.x + Math.cos(rad) * 22,
    y: t.y - 14 - Math.sin(rad) * 22,
    vx: vel.vx,
    vy: vel.vy,
    weapon,
    owner: match.turn,
    trail: [],
    dead: false,
    off: false,
    childrenSpawned: false,
  };
  match.phase = 'flight';
  fireBtn.disabled = true;
  syncMatchHUD();
}

fireBtn.addEventListener('click', doFire);

// ---- Physics per-frame ----
function stepFlight(dt: number): void {
  if (!proj) return;
  const p = proj;
  const h = dt / CFG.SUBSTEPS;
  for (let s = 0; s < CFG.SUBSTEPS; s++) {
    p.vy += CFG.GRAV * h;
    p.vx += match.wind * h;
    p.x += p.vx * h;
    p.y += p.vy * h;

    if (p.weapon.kind === 'cluster' && !p.childrenSpawned && p.vy > 0 && p.y < H * 0.5) {
      p.childrenSpawned = true;
      clusterProjs = spawnClusterChildren(p);
      p.dead = true;
      break;
    }

    if (hitTest(p)) { p.dead = true; break; }
  }
  if (p.trail.length > 26) p.trail.shift();
  p.trail.push({ x: p.x, y: p.y });

  if (p.dead) {
    if (clusterProjs.length > 0) {
      proj = null;
      match.phase = 'flight-cluster';
    } else {
      finishShot(p);
    }
  }
}

function stepClusters(dt: number): void {
  const h = dt / CFG.SUBSTEPS;
  for (const p of clusterProjs) {
    if (p.dead) continue;
    for (let s = 0; s < CFG.SUBSTEPS; s++) {
      p.vy += CFG.GRAV * h;
      p.vx += match.wind * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (hitTest(p)) {
        p.dead = true;
        if (!p.off) onImpact(p.x, p.y, p);
        break;
      }
    }
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 16) p.trail.shift();
  }
  if (clusterProjs.every(p => p.dead)) {
    clusterProjs = [];
    afterImpact(true);
  }
}

function hitTest(p: ActiveProjectile): boolean {
  if (p.x < -60 || p.x > W + 60 || p.y > H + 60) { p.off = true; return true; }
  if (collidesWithTerrain(p.x, p.y, terrain, W, H)) return true;
  for (const t of tanks) {
    if (Math.hypot(t.x - p.x, (t.y - 12) - p.y) < 15) return true;
  }
  return false;
}

function onImpact(x: number, y: number, p: ActiveProjectile): void {
  const foeIdx = 1 - p.owner;
  const foe = tanks[foeIdx];
  const dist = Math.hypot(foe.x - x, (foe.y - 10) - y);
  const damages = applyExplosion(x, y, p.weapon, terrain, tanks, particles, p.owner);
  const dmg = damages[foeIdx] ?? 0;
  recordShotResult(match, dist, dmg, p.weapon, foeIdx);
  renderer.shake = Math.min(16, p.weapon.shakeAmount);
  for (const t of tanks) {
    t.y = terrain.surfaceY(t.x);
  }
  syncMatchHUD();
}

function finishShot(p: ActiveProjectile): void {
  if (!p.off) {
    if (p.weapon.kind === 'tracer') {
      tracerMarker = { x: p.x, y: p.y };
      if (tracerTimeout) clearTimeout(tracerTimeout);
      tracerTimeout = setTimeout(() => { tracerMarker = null; }, 3000);
      proj = null;
      match.phase = 'aim';
      fireBtn.disabled = false;
      syncMatchHUD();
      return;
    }
    onImpact(p.x, p.y, p);
  }
  proj = null;
  afterImpact(p.weapon.consumesShot);
}

function afterImpact(consumedShot: boolean): void {
  match.phase = 'settle';
  syncMatchHUD();
  setTimeout(() => {
    endTurn(consumedShot);
  }, 500);
}

// ---- AI ----
function doAITurn(): void {
  const me = tanks[match.turn];
  const foe = tanks[1 - match.turn];
  const weaponIdx = match.selectedWeapon[match.turn];
  const { angleDeg, power } = aiChooseShot(
    me, foe, match.wind,
    me.skill, weaponIdx,
    W, H,
    (x) => terrain.surfaceY(x)
  );
  setAngle(angleDeg); setPower(power);
  syncMatchHUD();
  setTimeout(() => {
    const rad = angleDeg * Math.PI / 180;
    const weapon = WEAPONS[match.selectedWeapon[match.turn]];
    proj = {
      x: me.x + Math.cos(rad) * 22,
      y: me.y - 14 - Math.sin(rad) * 22,
      vx: Math.cos(rad) * (power * CFG.POWER_SCALE * 0.06),
      vy: -Math.sin(rad) * (power * CFG.POWER_SCALE * 0.06),
      weapon,
      owner: match.turn,
      trail: [],
      dead: false,
      off: false,
      childrenSpawned: false,
    };
    match.phase = 'flight';
    syncMatchHUD();
  }, 500);
}

// ---- HUD sync ----
function syncMatchHUD(): void {
  if (!match) return;
  syncHUD({
    p1Name: tanks[0]?.name ?? 'Player 1',
    p2Name: tanks[1]?.name ?? 'CPU',
    p1Score: match.scores[0],
    p2Score: match.scores[1],
    p1ShotsLeft: match.shotsLeft[0],
    p2ShotsLeft: match.shotsLeft[1],
    p1HP: match.hp[0],
    p2HP: match.hp[1],
    wind: match.wind,
    turn: match.turn,
    phase: match.phase,
    p1AI: tanks[0]?.ai ?? false,
    p2AI: tanks[1]?.ai ?? false,
    mode: match.config.mode,
    accentColor: tanks[match.turn]?.color ?? '#fff',
  });
}

// ---- Controls ----
document.getElementById('assistBtn')!.addEventListener('click', e => {
  assist = !assist;
  (e.target as HTMLElement).classList.toggle('on', assist);
});
document.getElementById('menuBtn')!.addEventListener('click', () => {
  match.phase = 'menu';
  overlay.querySelector('.sub')!.textContent = 'Artillery Duel';
  (overlay.querySelector('h1') as HTMLElement).textContent = 'HOWITZER';
  overlay.querySelector('p')!.textContent = 'Earn points by landing shots near your opponent. Most points after 10 shots wins.';
  overlay.classList.remove('hidden');
});
overlay.querySelectorAll('[data-mode]').forEach(btn => {
  const b = btn as HTMLElement;
  b.addEventListener('click', () => {
    const menuMode = b.dataset.mode as MenuMode;
    const gameMode = (b.dataset.gamemode ?? 'score') as GameModeChoice;
    newGame(menuMode, gameMode);
  });
});

setupAimInput(
  cv,
  () => (match?.phase === 'aim' && !tanks[match.turn]?.ai) ? { x: tanks[match.turn].x, y: tanks[match.turn].y } : null,
  () => match?.phase === 'aim',
  (ang, power) => { setAngle(ang); setPower(power); }
);

// ---- Main render loop ----
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(CFG.MAX_DT, now - last);
  last = now;

  ctx.save();
  renderer.applyShake();
  renderer.drawSky();

  if (match?.phase !== 'menu' && terrain) {
    terrain.render(ctx);

    if (assist && match.phase === 'aim' && !tanks[match.turn]?.ai) {
      renderer.drawAimArc(tanks[match.turn], +angleEl.value, +powerEl.value, match.wind, terrain);
    }

    for (let i = 0; i < tanks.length; i++) {
      renderer.drawTank(tanks[i], i === match.turn, match.phase, +angleEl.value * Math.PI / 180);
    }

    if (match.phase === 'flight') stepFlight(dt);
    else if (match.phase === 'flight-cluster') stepClusters(dt);

    const allProjs: ActiveProjectile[] = [];
    if (proj) allProjs.push(proj);
    clusterProjs.forEach(p => { if (!p.dead) allProjs.push(p); });
    renderer.drawProjectiles(allProjs);
    renderer.updateParticles(particles, dt);

    if (tracerMarker) {
      renderer.drawTracerMarker(tracerMarker.x, tracerMarker.y);
    }
  }

  ctx.restore();
  requestAnimationFrame(frame);
}

// ---- Boot ----
resize();
requestAnimationFrame(frame);
