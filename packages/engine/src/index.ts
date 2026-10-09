// Public API of the engine. Signatures are the contract; bodies are filled in by the engine workstream.
import type {
  BattleOdds,
  CheatAssessment,
  GameAction,
  GameEvent,
  GameSettings,
  GameState,
  Handicap,
  MapDef,
  Player,
  Rng,
  SeasonOdds,
  StepReport,
  TeamId,
} from './types';

export * from './types';
export { DEFAULT_MAP } from './map';

const todo = (name: string): never => {
  throw new Error(`engine: ${name} not implemented yet`);
};

/** New game in the lobby. Territories are assigned at START_GAME. */
export function createGame(_args: {
  id: string;
  code: string;
  settings: GameSettings;
  map: MapDef;
  players: Player[];
}): GameState {
  return todo('createGame');
}

/**
 * The only way state changes. Pure: same input + rng gives the same output.
 * Throws GameRuleError on illegal actions (wrong team, not adjacent, etc.).
 */
export function applyAction(
  _state: GameState,
  _action: GameAction,
  _ctx: { map: MapDef; rng: Rng; now: Date },
): { state: GameState; events: GameEvent[] } {
  return todo('applyAction');
}

/** Exact capture odds for attacking until win or 1 soldier left (dynamic programming over Risk dice). */
export function battleOdds(_attackers: number, _defenders: number, _opts?: { rerolls?: number }): BattleOdds {
  return todo('battleOdds');
}

/** Monte Carlo estimate of who takes the pot, plus steps needed tonight to flip it. */
export function seasonOdds(_state: GameState, _map: MapDef, _opts?: { simulations?: number; rng?: Rng }): SeasonOdds {
  return todo('seasonOdds');
}

/** Personal conversion rate from walking history: effort relative to your own normal. */
export function computeHandicap(_history: number[], _baseStepsPerSoldier: number): Handicap {
  return todo('computeHandicap');
}

/** Heuristic anti-cheat: implausible cadence, perfectly regular shaking, steps with no time span. */
export function assessSteps(_report: StepReport): CheatAssessment {
  return todo('assessSteps');
}

/** soldiers = floor(adjustedSteps / player.handicap.stepsPerSoldier) */
export function stepsToSoldiers(_steps: number, _handicap: Handicap): number {
  return todo('stepsToSoldiers');
}

export function territoryShare(_state: GameState, _team: TeamId): number {
  return todo('territoryShare');
}
export * from './api';
export { GRID_POSITIONS } from './map';
