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
  spawnExplosionParticles(x, y, weapon.blastRadius, particles);
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
