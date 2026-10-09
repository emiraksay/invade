// Shared contracts for Invade. Pure data, no UI or network code.
// Changing anything here breaks other workstreams: announce in chat before merging.

export type TeamId = 'white' | 'black';
export const TEAMS: readonly TeamId[] = ['white', 'black'] as const;

// ---------- Map ----------

export interface Region {
  id: string;
  name: string;
  /** Extra soldiers per reinforcement for the team holding every territory in the region. */
  bonus: number;
}

export interface Territory {
  id: string;
  name: string;
  regionId: string;
  /** Ids of territories this one can attack or fortify into. Symmetric. */
  neighbors: string[];
}

export interface MapDef {
  id: string;
  regions: Region[];
  territories: Territory[];
}

// ---------- Settings ----------

export interface GameSettings {
  seasonDays: number;          // real game: 14. Ignored in demo mode.
  walkPhaseMinutes: number;    // real game: hours (e.g. 720). Demo: 1–2.
  movePhaseMinutes: number;
  stepsPerSoldier: number;     // default 1000 (before handicap)
  majorityThreshold: number;   // 0..1, default 0.51
  buyIn: number;               // virtual coins per player
  feeRate: number;             // platform fee, default 0.1
  teamNames: Record<TeamId, string>;
  demoMode: boolean;           // minutes instead of hours + simulated steps allowed
}

export const DEFAULT_SETTINGS: GameSettings = {
  seasonDays: 14,
  walkPhaseMinutes: 2,
  movePhaseMinutes: 3,
  stepsPerSoldier: 1000,
  majorityThreshold: 0.51,
  buyIn: 100,
  feeRate: 0.1,
  teamNames: { white: 'White', black: 'Black' },
  demoMode: true,
};

// ---------- Players ----------

export interface Handicap {
  /** Player's normal steps per walk phase, from history (statistical baseline, not ML). */
  baselineSteps: number;
  /** Personal conversion rate: steps needed for one soldier. */
  stepsPerSoldier: number;
}

export interface Player {
  id: string;            // = players.id in DB
  name: string;
  color: string;         // hex
  teamId: TeamId;
  isHost: boolean;
  handicap: Handicap;
}

// ---------- Game state ----------

export type Phase = 'lobby' | 'walk' | 'move' | 'ended';
/** Sub-steps of a team's turn in the Move Phase. Figma labels: Place, Attack, Move (fortify). */
export type MoveStep = 'place' | 'attack' | 'fortify';

export interface TerritoryState {
  owner: TeamId;
  soldiers: number;
}

export interface GameState {
  id: string;
  code: string;
  settings: GameSettings;
  mapId: string;
  players: Player[];
  phase: Phase;
  round: number;                       // increments each Walk Phase
  phaseEndsAt: string | null;          // ISO timestamp
  /** Move Phase is turn-based: one team acts at a time to avoid race conditions. */
  activeTeam: TeamId | null;
  moveStep: MoveStep | null;
  territories: Record<string, TerritoryState>;
  /** Soldiers earned (walking + region bonus) and not yet placed. */
  reserves: Record<TeamId, number>;
  /** Rerolls available this Move Phase (effort bonus). */
  rerolls: Record<TeamId, number>;
  /** Steps per player in the current/last Walk Phase (adjusted, after anti-cheat). */
  roundSteps: Record<string, number>;
  pot: number;
  winner: TeamId | null;
  version: number;                     // optimistic concurrency, mirrors games.version
}

// ---------- Steps ----------

export type StepSource = 'device' | 'simulated' | 'health';

export interface StepReport {
  playerId: string;
  steps: number;
  startedAt: string;     // ISO
  endedAt: string;       // ISO
  source: StepSource;
  /** Optional per-second step counts from the device, used by anti-cheat. */
  cadence?: number[];
}

export interface CheatAssessment {
  suspicious: boolean;
  /** Steps we accept after discounting suspicious parts. */
  acceptedSteps: number;
  reasons: string[];
}

// ---------- Battles & odds ----------

export interface BattleResult {
  from: string;
  to: string;
  attackerDice: number[];   // sorted desc
  defenderDice: number[];   // sorted desc
  attackerLosses: number;
  defenderLosses: number;
  captured: boolean;
  rerollUsed: boolean;
}

export interface BattleOdds {
  /** Probability the attacker captures the territory if they keep attacking until win or 1 soldier left. */
  captureProbability: number;
  expectedAttackerLosses: number;
  expectedDefenderLosses: number;
}

export interface SeasonOdds {
  winProbability: Record<TeamId, number>;
  /** Extra steps tonight for the trailing team to reach ~50% (null if not reachable). */
  stepsToFlip: number | null;
}

// ---------- Actions (all game changes go through these) ----------

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'START_WALK' }
  | { type: 'END_WALK'; reports: StepReport[] }
  | { type: 'PLACE'; teamId: TeamId; territoryId: string; count: number }
  | { type: 'END_PLACE'; teamId: TeamId }
  | { type: 'ATTACK'; teamId: TeamId; from: string; to: string; dice?: 1 | 2 | 3; useReroll?: boolean }
  | { type: 'END_ATTACK'; teamId: TeamId }
  | { type: 'FORTIFY'; teamId: TeamId; from: string; to: string; count: number }
  | { type: 'END_TURN'; teamId: TeamId };

/** Things that happened, for the battle log, animations and the AI dealer. */
export type GameEvent =
  | { type: 'game_started' }
  | { type: 'walk_started'; round: number; endsAt: string }
  | { type: 'steps_converted'; perPlayer: Record<string, { steps: number; soldiers: number; flagged: boolean }>; reserves: Record<TeamId, number>; rerolls: Record<TeamId, number> }
  | { type: 'placed'; teamId: TeamId; territoryId: string; count: number }
  | { type: 'battle'; teamId: TeamId; result: BattleResult; oddsBefore: BattleOdds }
  | { type: 'captured'; teamId: TeamId; territoryId: string }
  | { type: 'fortified'; teamId: TeamId; from: string; to: string; count: number }
  | { type: 'turn_changed'; activeTeam: TeamId; moveStep: MoveStep }
  | { type: 'game_over'; winner: TeamId; payoutPerPlayer: number }
  | { type: 'dealer_line'; text: string; about?: string };

/** Random source, injectable so tests and replays are deterministic. Returns [0, 1). */
export type Rng = () => number;

export class GameRuleError extends Error {}
