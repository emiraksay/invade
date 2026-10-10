import { DEFAULT_MAP, type BattleRecord, type MapDef, type Player } from '@invade/engine';
import { describeEvent, type MilestoneEvent } from './events';

/** One row of the Figma LOG screen: a sync that earned soldiers, or a battle. Newest first. */
export type LogLine =
  | { kind: 'sync'; id: string; at: string; time: string; name: string; steps: string; gained: string }
  | { kind: 'battle'; id: string; at: string; time: string; name: string; team: BattleRecord['team']; territory: string; attackers: number; defenders: number; won: boolean };

const time = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso));

/** Today's milestones and battles in one list, newest first. Pure. */
export function logLines(
  events: readonly MilestoneEvent[],
  battles: readonly BattleRecord[],
  players: readonly Player[],
  timezone: string,
  today?: string,
  map: MapDef = DEFAULT_MAP,
): LogLine[] {
  const syncs: LogLine[] = events.map((ev) => ({ kind: 'sync', id: `m${ev.id}`, at: ev.at, ...describeEvent(ev, players, timezone) }));
  const fights: LogLine[] = battles
    .filter((b) => !today || b.day === today)
    .map((b) => ({
      kind: 'battle',
      id: `b${b.id}`,
      at: b.at,
      time: time(b.at, timezone),
      name: players.find((p) => p.id === b.playerId)?.name ?? 'Someone',
      team: b.team,
      territory: map.territories.find((t) => t.id === b.to)?.name ?? b.to,
      attackers: b.attackers,
      defenders: b.defenders,
      won: b.won,
    }));
  return [...syncs, ...fights].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
