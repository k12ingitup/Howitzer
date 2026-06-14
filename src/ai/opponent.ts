import { simulateLanding, launchVelocity } from '../engine/physics';

export interface TankLike { x: number; y: number; }

export function aiChooseShot(
  me: TankLike,
  foe: TankLike,
  wind: number,
  skill: number,
  _weaponIndex: number,
  W: number,
  H: number,
  surfaceY: (x: number) => number
): { angleDeg: number; power: number } {
  const dirRight = foe.x > me.x;
  let best: { ang: number; pw: number; err: number } | null = null;

  for (let a = 20; a <= 75; a += 3) {
    const ang = dirRight ? a : 180 - a;
    for (let pw = 30; pw <= 100; pw += 4) {
      const vel = launchVelocity(ang, pw);
      const rad = ang * Math.PI / 180;
      const startX = me.x + Math.cos(rad) * 22;
      const startY = me.y - 14 - Math.sin(rad) * 22;
      const r = simulateLanding(startX, startY, vel, wind, W, H, surfaceY);
      const err = Math.abs(r.x - foe.x) + (r.miss ? 260 : 0);
      if (!best || err < best.err) best = { ang, pw, err };
    }
  }

  const scatter = 1 - skill;
  const ang = (best?.ang ?? 45) + (Math.random() * 2 - 1) * 16 * scatter;
  const pw = Math.max(10, Math.min(100, (best?.pw ?? 55) + (Math.random() * 2 - 1) * 22 * scatter));
  return { angleDeg: ang, power: pw };
}
