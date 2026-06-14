export type GameMode = 'score' | 'annihilation';
export type GamePhase = 'menu' | 'aim' | 'flight' | 'flight-cluster' | 'settle' | 'over';
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
  selectedWeapon: [number, number];
}
