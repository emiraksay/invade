// Shared contracts for Invade. Pure data, no UI or network code.
// Changing anything here affects every workstream: announce in chat before merging.

export type TeamId = 'white' | 'black';
export const TEAMS: readonly TeamId[] = ['white', 'black'];

/** Calendar day in the game's timezone, `YYYY-MM-DD`. Steps reset every day. */
export type GameDay = string;

// ---------- Map ----------

export type Point = readonly [x: number, y: number];

export interface Territory {
  id: string;
  name: string;
  /** Team that holds the territory at the start of the campaign. */
  team: TeamId;
  /** The team's headquarters (crown in the Figma). One per team. */
  isHq: boolean;
  /** Closed polygon in map units, counter-clockwise, first point not repeated. */
  polygon: Point[];
  center: Point;
  /** Ids of territories sharing a border. Symmetric. */
  neighbors: string[];
}

export interface MapDef {
  id: string;
  seed: number;
  /** Map bounds in map units; territories tile [0, width] x [0, height]. */
  width: number;
  height: number;
  territories: Territory[];
}

// ---------- Game ----------

export interface GameSettings {
  campaignDays: number;     // default 7 (a season is one week, decision 19)
  /** First day of the season (YYYY-MM-DD, game timezone). Day N = days since it + 1. */
  seasonStart?: string;
  winThreshold: number;     // share of territories, default 0.51
  walkPhaseHours: number;   // default 24
  timezone: string;         // IANA, decides when a GameDay starts
  teamNames: Record<TeamId, string>;
}

export interface Player {
  id: string;
  name: string;
  team: TeamId;
}

// ---------- Steps ----------

export type StepSource = 'apple_health' | 'demo';

/**
 * A player's cumulative step total for one day, as read from Apple Health.
 * Reports are idempotent: the stored value for (player, day) is the max ever reported.
 */
export interface StepReport {
  playerId: string;
  day: GameDay;
  steps: number;
  source: StepSource;
  reportedAt: string; // ISO timestamp
}

export interface Milestone {
  /** Daily steps needed. */
  steps: number;
  /** Total soldiers a player has for the day once this milestone is reached. */
  soldiers: number;
}

export interface NextMilestone {
  milestone: Milestone;
  stepsToGo: number;
  /** Soldiers gained when it is reached. */
  gain: number;
}

export interface PlayerDay {
  player: Player;
  steps: number;
  soldiers: number;
  next: NextMilestone | null; // null once the daily cap is reached
}

export interface TeamDay {
  team: TeamId;
  members: PlayerDay[];
  steps: number;
  /** Sum of members' soldiers, excluding the bonus. */
  memberSoldiers: number;
  bonus: number;
  soldiers: number;
  /** Most soldiers this team could earn today (everyone at the cap, full bonus). */
  maxSoldiers: number;
}
