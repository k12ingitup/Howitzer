import { Terrain } from './terrain';

export function collidesWithTerrain(
  x: number, y: number,
  terrain: Terrain,
  W: number, H: number
): boolean {
  if (x < -60 || x > W + 60) return true;
  if (y > H + 60) return true;
  return terrain.collisionAt(x, y);
}
