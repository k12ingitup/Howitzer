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

export type WeaponRarity = 'common' | 'rare' | 'legendary';

export interface Weapon {
  id: string;
  name: string;
  sub: string;
  icon: string;           // emoji icon
  color: string;          // weapon accent color
  rarity: WeaponRarity;
  kind: WeaponKind;
  blastRadius: number;
  damage: number;
  clusterCount?: number;
  clusterSpread?: number;
  dirtRadius?: number;
  consumesShot: boolean;
  shakeAmount: number;
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
  rolling?: boolean;
  rollDir?: number;
  rollDist?: number;
  tunneling?: boolean;
  tunnelSteps?: number;
}
