export type WeaponKind =
  | 'single'
  | 'cluster'
  | 'mirv'
  | 'roller'
  | 'addDirt'
  | 'dirtWall'
  | 'tracer'
  | 'tunneler'
  | 'homing'
  | 'napalm'
  | 'earthquake';

export interface Weapon {
  id: string;
  name: string;
  sub: string;
  kind: WeaponKind;
  blastRadius: number;
  damage: number;
  clusterCount?: number;
  clusterSpread?: number;
  dirtRadius?: number;
  consumesShot: boolean;
  shakeAmount: number;
  // earthquake: number of craters
  quakeCount?: number;
  quakeSpread?: number;
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
  // roller
  rolling?: boolean;
  rollDir?: number;
  rollDist?: number;
  // tunneler
  tunneling?: boolean;
  tunnelSteps?: number;
}
