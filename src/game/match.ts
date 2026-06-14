import { MatchState, MatchConfig } from './state';
import { shotScore } from './scoring';
import { Weapon } from '../weapons/types';
import { WEAPONS } from '../weapons/registry';
import { CFG } from '../config';

function dealArsenal(size: number): Weapon[] {
  // Shuffle all weapons and pick `size`, wrapping if pool is small
  const pool = [...WEAPONS].filter(w => w.id !== 'tracer'); // tracer always available separately
  const hand: Weapon[] = [];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  for (let i = 0; i < size; i++) {
    hand.push(shuffled[i % shuffled.length]);
  }
  // always add one tracer
  hand.splice(Math.floor(Math.random() * (size + 1)), 0,
    WEAPONS.find(w => w.id === 'tracer')!);
  return hand;
}

export function createMatch(config: MatchConfig): MatchState {
  const size = config.shotsPerPlayer;
  return {
    config,
    phase: 'draft',
    turn: 0,
    shotsLeft: [size + 1, size + 1], // +1 for the tracer
    scores: [0, 0],
    hp: [100, 100],
    wind: rollWind(),
    selectedWeapon: [0, 0],
    arsenals: [dealArsenal(size), dealArsenal(size)],
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

export function consumeWeapon(state: MatchState): void {
  const idx = state.selectedWeapon[state.turn];
  state.arsenals[state.turn].splice(idx, 1);
  state.selectedWeapon[state.turn] = 0;
  state.shotsLeft[state.turn] = Math.max(0, state.shotsLeft[state.turn] - 1);
}

export function advanceTurn(state: MatchState): void {
  state.wind = rollWind();
  state.turn = 1 - state.turn;
  state.selectedWeapon[state.turn] = 0;
}

export function isMatchOver(state: MatchState): boolean {
  if (state.config.mode === 'annihilation') {
    return state.hp[0] <= 0 || state.hp[1] <= 0;
  }
  return state.arsenals[0].length === 0 && state.arsenals[1].length === 0;
}

export function winner(state: MatchState): number {
  if (state.config.mode === 'annihilation') {
    if (state.hp[0] <= 0 && state.hp[1] <= 0) return -1;
    return state.hp[0] > 0 ? 0 : 1;
  }
  if (state.scores[0] === state.scores[1]) return -1;
  return state.scores[0] > state.scores[1] ? 0 : 1;
}

// suppress unused import warning
void CFG;
