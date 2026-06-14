import { MatchState, MatchConfig } from './state';
import { shotScore } from './scoring';
import { Weapon } from '../weapons/types';

export function createMatch(config: MatchConfig): MatchState {
  return {
    config,
    phase: 'aim',
    turn: 0,
    shotsLeft: [config.shotsPerPlayer, config.shotsPerPlayer],
    scores: [0, 0],
    hp: [100, 100],
    wind: rollWind(),
    selectedWeapon: [0, 0],
  };
}

export function rollWind(): number {
  return +((Math.random() * 2 - 1) * 0.0009).toFixed(5);
}

export function recordShotResult(
  state: MatchState,
  distanceToFoe: number,
  damageDealt: number,
  weapon: Weapon,
  foeIndex: number
): void {
  const pts = shotScore(distanceToFoe, weapon);
  state.scores[state.turn] += pts;
  if (state.config.mode === 'annihilation') {
    state.hp[foeIndex] = Math.max(0, state.hp[foeIndex] - damageDealt);
  } else {
    state.hp[foeIndex] = Math.max(1, state.hp[foeIndex] - Math.floor(damageDealt * 0.4));
  }
}

export function advanceTurn(state: MatchState, consumedShot: boolean): void {
  if (consumedShot) {
    state.shotsLeft[state.turn] = Math.max(0, state.shotsLeft[state.turn] - 1);
  }
  state.wind = rollWind();
  state.turn = 1 - state.turn;
}

export function isMatchOver(state: MatchState): boolean {
  if (state.config.mode === 'annihilation') {
    return state.hp[0] <= 0 || state.hp[1] <= 0;
  }
  return state.shotsLeft[0] === 0 && state.shotsLeft[1] === 0;
}

export function winner(state: MatchState): number {
  if (state.config.mode === 'annihilation') {
    if (state.hp[0] <= 0 && state.hp[1] <= 0) return -1;
    return state.hp[0] > 0 ? 0 : 1;
  }
  if (state.scores[0] === state.scores[1]) return -1;
  return state.scores[0] > state.scores[1] ? 0 : 1;
}
