import { CFG } from '../config';

export interface Vec2 { x: number; y: number; }
export interface Vel2 { vx: number; vy: number; }

export function stepProjectile(
  pos: Vec2,
  vel: Vel2,
  wind: number,
  dt: number
): void {
  const h = dt / CFG.SUBSTEPS;
  for (let s = 0; s < CFG.SUBSTEPS; s++) {
    vel.vy += CFG.GRAV * h;
    vel.vx += wind * h;
    pos.x += vel.vx * h;
    pos.y += vel.vy * h;
  }
}

export function launchVelocity(angleDeg: number, power: number): Vel2 {
  const rad = angleDeg * Math.PI / 180;
  const v = power * CFG.POWER_SCALE * 0.06;
  return { vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v };
}

export function simulateLanding(
  startX: number,
  startY: number,
  vel: Vel2,
  wind: number,
  W: number,
  H: number,
  surfaceY: (x: number) => number
): { x: number; y: number; miss: boolean } {
  let x = startX, y = startY;
  let vx = vel.vx, vy = vel.vy;
  for (let i = 0; i < 2400; i++) {
    vy += CFG.GRAV * 4; vx += wind * 4; x += vx * 4; y += vy * 4;
    if (x < -60 || x > W + 60 || y > H + 60) return { x, y, miss: true };
    if (y >= surfaceY(x)) return { x, y, miss: false };
  }
  return { x, y, miss: true };
}
