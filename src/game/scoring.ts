import { Weapon } from '../weapons/types';

export function shotScore(distance: number, weapon: Weapon): number {
  if (weapon.damage === 0) return 0;
  const maxRange = weapon.blastRadius + 6;
  if (distance >= maxRange) return 0;
  return Math.round(weapon.damage * (1 - distance / maxRange));
}
