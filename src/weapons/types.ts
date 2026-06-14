export type WeaponKind = 'single' | 'cluster' | 'roller' | 'addDirt' | 'tracer';

export interface Weapon {
  id: string;
  name: string;
  sub: string;
  kind: WeaponKind;
  blastRadius: number;
  damage: number;
  clusterCount?: number;
  clusterSpread?: number;
  rollerDistance?: number;
  dirtRadius?: number;
  consumesShot: boolean;
  shakeAmount: number;
}

export interface ActiveProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: Weapon;
  owner: number;
  trail: Array<{ x: number; y: number }>;
  dead: boolean;
  off: boolean;
  childrenSpawned?: boolean;
}
