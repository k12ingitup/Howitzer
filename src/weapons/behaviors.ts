import { Terrain } from '../engine/terrain';
import { ActiveProjectile, Weapon } from './types';
import { Particle } from '../render/particles';

export interface Tank {
  x: number;
  y: number;
  hp: number;
  score: number;
  color: string;
  name: string;
  ai: boolean;
  skill: number;
  dir: number;
}

export function applyExplosion(
  x: number, y: number,
  weapon: Weapon,
  terrain: Terrain,
  tanks: Tank[],
  particles: Particle[],
  _owner: number
): number[] {
  if (weapon.kind === 'addDirt') {
    terrain.addDirt(x, y, weapon.dirtRadius ?? weapon.blastRadius);
    spawnSmokePuff(x, y, particles, weapon.blastRadius);
    return tanks.map(() => 0);
  }

  if (weapon.kind === 'dirtWall') {
    const r = weapon.dirtRadius ?? weapon.blastRadius;
    // vertical column of dirt
    for (let dy = -r * 2; dy <= r; dy += 4) {
      terrain.addDirt(x, y + dy, r * 0.7);
    }
    spawnSmokePuff(x, y, particles, weapon.blastRadius * 2);
    return tanks.map(() => 0);
  }

  if (weapon.kind === 'earthquake') {
    const count = weapon.quakeCount ?? 6;
    const spread = weapon.quakeSpread ?? 150;
    for (let i = 0; i < count; i++) {
      const ex = x + (Math.random() * 2 - 1) * spread;
      const ey = terrain.surfaceY(ex);
      terrain.destroy(ex, ey, weapon.blastRadius);
      spawnExplosionParticles(ex, ey, weapon.blastRadius * 0.6, particles);
    }
    const damages: number[] = [];
    for (const t of tanks) {
      const d = Math.hypot(t.x - x, (t.y - 10) - y);
      const range = (weapon.quakeSpread ?? 150) + weapon.blastRadius;
      if (d < range) {
        damages.push(Math.round(weapon.damage * (1 - d / range)));
      } else {
        damages.push(0);
      }
    }
    return damages;
  }

  if (weapon.kind === 'napalm') {
    terrain.destroy(x, y, weapon.blastRadius * 0.6);
    spawnFireParticles(x, y, weapon.blastRadius, particles);
    const damages: number[] = [];
    for (const t of tanks) {
      const d = Math.hypot(t.x - x, (t.y - 10) - y);
      if (d < weapon.blastRadius + 6) {
        damages.push(Math.round(weapon.damage * (1 - d / (weapon.blastRadius + 6))));
      } else {
        damages.push(0);
      }
    }
    return damages;
  }

  terrain.destroy(x, y, weapon.blastRadius);
  const damages: number[] = [];
  for (const t of tanks) {
    const d = Math.hypot(t.x - x, (t.y - 10) - y);
    if (d < weapon.blastRadius + 6) {
      damages.push(Math.round(weapon.damage * (1 - d / (weapon.blastRadius + 6))));
    } else {
      damages.push(0);
    }
  }
  spawnWeaponExplosion(x, y, weapon.kind, weapon.blastRadius, particles);
  return damages;
}

export function spawnExplosionParticles(
  x: number, y: number, radius: number, particles: Particle[]
): void {
  const n = 18 + Math.floor(radius / 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 0.28 + 0.05;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 0.05,
      life: 1,
      r: Math.random() * 3 + 1,
      hue: Math.random() < 0.5 ? '#ffce6b' : '#ff7a3c',
    });
  }
}

export function spawnFireParticles(
  x: number, y: number, radius: number, particles: Particle[]
): void {
  const n = 40 + Math.floor(radius);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 0.35 + 0.04;
    const spread = Math.random() * radius * 0.8;
    const px = x + Math.cos(a) * spread;
    const py = y + Math.sin(a) * spread * 0.4;
    const hues = ['#ff4500', '#ff7a3c', '#ffce6b', '#ff2200', '#ffaa00'];
    particles.push({
      x: px, y: py,
      vx: Math.cos(a) * s * 0.3,
      vy: -(Math.random() * 0.25 + 0.08),
      life: 0.7 + Math.random() * 0.6,
      r: Math.random() * 5 + 2,
      hue: hues[Math.floor(Math.random() * hues.length)],
    });
  }
}

export function spawnSmokePuff(
  x: number, y: number, particles: Particle[], radius: number
): void {
  const n = 8 + Math.floor(radius / 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 0.12 + 0.02;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 0.08,
      life: 1,
      r: Math.random() * 5 + 2,
      hue: 'rgba(180,160,130,0.6)',
    });
  }
}

export function spawnWeaponExplosion(
  x: number, y: number,
  kind: string, radius: number,
  particles: Particle[]
): void {
  const push = (...ps: Particle[]) => particles.push(...ps);
  switch (kind) {
    case 'single':
      push(...spawnBurst(x,y,radius,['#ff9d63','#ffce6b','#ff4500','#fff'],22,0.32));
      push(...spawnDebris(x,y,radius,'#b9853f',10)); break;
    case 'cluster': case 'mirv':
      push(...spawnBurst(x,y,radius,['#ffce6b','#fff','#ffaa00'],14,0.28)); break;
    case 'napalm':
      spawnFireParticles(x,y,radius,particles); return;
    case 'homing':
      spawnEnergyParticles(x,y,radius,particles); return;
    case 'tunneler':
      push(...spawnBurst(x,y,radius,['#8B5E3C','#b9853f','#ffce6b'],24,0.38));
      push(...spawnDebris(x,y,radius,'#654321',14)); break;
    case 'roller':
      push(...spawnBurst(x,y,radius,['#86efac','#fff','#bbf7d0'],12,0.22));
      spawnSmokePuff(x,y,particles,radius); return;
    case 'bouncer':
      push(...spawnBurst(x,y,radius,['#60a5fa','#fff','#93c5fd','#dbeafe'],16,0.35)); break;
    case 'hailstorm':
      push(...spawnBurst(x,y,radius,['#93c5fd','#fff','#bfdbfe'],10,0.20)); break;
    case 'earthquake':
      push(...spawnBurst(x,y,radius,['#fbbf24','#f59e0b','#fff','#b9853f'],20,0.30));
      push(...spawnDebris(x,y,radius,'#8B5E3C',12)); break;
    default:
      push(...spawnBurst(x,y,radius,['#ffce6b','#ff7a3c','#fff'],18,0.28));
  }
}

function spawnBurst(
  x: number, y: number, radius: number,
  colors: string[], count: number, speed: number,
  particleArr?: Particle[]
): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count + Math.floor(radius * 0.4); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (Math.random() * 0.6 + 0.4) * speed;
    out.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 0.06,
      life: 0.9 + Math.random()*0.6, r: Math.random()*4+1.5,
      hue: colors[Math.floor(Math.random()*colors.length)] });
  }
  if (particleArr) particleArr.push(...out);
  return out;
}

function spawnDebris(
  x: number, y: number, radius: number, color: string, count: number
): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (Math.random() * 0.5 + 0.2) * (radius / 40);
    out.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 0.12,
      life: 1.2 + Math.random()*0.6, r: Math.random()*6+3,
      hue: color });
  }
  return out;
}

export function spawnEnergyParticles(
  x: number, y: number, radius: number, particles: Particle[]
): void {
  const cols = ['#f0abfc', '#c084fc', '#e879f9', '#fff', '#a855f7'];
  for (let i = 0; i < 28 + Math.floor(radius); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 0.32 + 0.06;
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.04,
      life: 0.8 + Math.random() * 0.5,
      r: Math.random() * 4 + 1,
      hue: cols[Math.floor(Math.random() * cols.length)],
    });
  }
}

export function spawnClusterChildren(parent: ActiveProjectile): ActiveProjectile[] {
  const count = parent.weapon.clusterCount ?? 3;
  const spread = parent.weapon.clusterSpread ?? 0.12;
  const children: ActiveProjectile[] = [];
  for (let k = -(count - 1) / 2; k <= (count - 1) / 2; k++) {
    children.push({
      x: parent.x, y: parent.y,
      vx: parent.vx + k * spread,
      vy: parent.vy * 0.6,
      weapon: parent.weapon,
      owner: parent.owner,
      trail: [],
      dead: false,
      off: false,
    });
  }
  return children;
}
