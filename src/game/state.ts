import { Weapon } from '../weapons/types';

export type GameMode = 'score' | 'annihilation';
export type GamePhase = 'menu' | 'draft' | 'aim' | 'flight' | 'flight-cluster' | 'flight-tracer' | 'settle' | 'transition' | 'over';
export type AIDifficulty = 'easy' | 'hard';

export interface MatchConfig {
  mode: GameMode;
  shotsPerPlayer: number;
  p2IsAI: boolean;
  aiDifficulty: AIDifficulty;
}

export interface MatchState {
  config: MatchConfig;
  phase: GamePhase;
  turn: number;
  shotsLeft: [number, number];
  scores: [number, number];
  hp: [number, number];
  wind: number;
  selectedWeapon: [number, number];  // index into arsenals[turn]
  arsenals: [Weapon[], Weapon[]];    // dealt weapon hands
}
