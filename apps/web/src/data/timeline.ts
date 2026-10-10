import { summarizeTeamDay, type BattleRecord, type GameDay, type Player, type StepReport, type TeamDay, type TeamId } from '@invade/engine';
import type { MilestoneEvent } from './events';

/** One thing that happened today, in time order: a sync that earned soldiers, or a battle. */
export interface Moment {
  at: string;
  kind: 'sync' | 'battle';
  id: number;
}

/** Today's moments, oldest first. Pure. */
export function timeline(events: readonly MilestoneEvent[], battles: readonly BattleRecord[], today: GameDay): Moment[] {
  const syncs: Moment[] = events.map((e) => ({ at: e.at, kind: 'sync', id: e.id }));
  const fights: Moment[] = battles.filter((b) => b.day === today).map((b) => ({ at: b.at, kind: 'battle', id: b.id }));
  return [...syncs, ...fights].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id);
}

export interface DayState {
  events: MilestoneEvent[];
  battles: BattleRecord[];
  teams: Record<TeamId, TeamDay>;
}

/**
 * The game as it stood at `at`: only the events and battles up to that moment, and the teams rebuilt
 * from each player's latest milestone sync through the engine (summarizeTeamDay), so soldiers and
 * the team bonus are exactly what the rules gave at that time. Players with no sync yet show 0.
 */
export function stateAt(
  events: readonly MilestoneEvent[],
  battles: readonly BattleRecord[],
  players: readonly Player[],
  today: GameDay,
  at: string,
): DayState {
  const t = Date.parse(at);
  const evs = events.filter((e) => Date.parse(e.at) <= t);
  const bts = battles.filter((b) => b.day !== today || Date.parse(b.at) <= t);
  const latest = new Map<string, MilestoneEvent>();
  for (const e of [...evs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) latest.set(e.playerId, e);
  const reports: StepReport[] = [...latest.values()].map((e) => ({ playerId: e.playerId, day: today, steps: e.steps, source: 'demo', reportedAt: e.at }));
  return {
    events: evs,
    battles: bts,
    teams: {
      white: summarizeTeamDay('white', players, reports, today),
      black: summarizeTeamDay('black', players, reports, today),
    },
  };
}
