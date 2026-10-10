import type { Player, TeamId } from '@invade/engine';

/** A milestone crossed today: written by POST /api/steps (server/handlers.ts), read live by the screens. */
export interface MilestoneEvent {
  id: number;
  at: string; // ISO timestamp
  playerId: string;
  team: TeamId;
  steps: number;
  soldiers: number;
  gained: number;
}

/** Supabase row -> MilestoneEvent, or null for other event types / malformed payloads. */
export function toMilestoneEvent(row: { id: number; type: string; payload: unknown; created_at: string }): MilestoneEvent | null {
  if (row.type !== 'milestone' || !row.payload || typeof row.payload !== 'object') return null;
  const p = row.payload as Partial<Record<'playerId' | 'team' | 'steps' | 'soldiers' | 'gained', unknown>>;
  if (typeof p.playerId !== 'string' || (p.team !== 'white' && p.team !== 'black')) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { id: row.id, at: row.created_at, playerId: p.playerId, team: p.team, steps: num(p.steps), soldiers: num(p.soldiers), gained: num(p.gained) };
}

const fmt = new Intl.NumberFormat('de-DE');
const time = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso));

/** One line for the LOG bar / feed: "11:12 · Emir · 10.000 · +4". Unknown players show as "Someone". */
export function describeEvent(ev: MilestoneEvent, players: readonly Player[], timezone: string) {
  const name = players.find((p) => p.id === ev.playerId)?.name ?? 'Someone';
  return { time: time(ev.at, timezone), name, steps: fmt.format(ev.steps), gained: `+${ev.gained}` };
}

/**
 * A battle result (type 'battle'), written by the night-phase engine once it ships. Parsed tolerantly:
 * the fields below are what the spotlight needs; anything else in the payload is ignored.
 */
export interface BattleEvent {
  id: number;
  at: string;
  /** The attacking team. */
  team: TeamId;
  territory: string;
  captured: boolean;
  odds?: number;
  attackerId?: string;
}

export function toBattleEvent(row: { id: number; type: string; payload: unknown; created_at: string }): BattleEvent | null {
  if (row.type !== 'battle' || !row.payload || typeof row.payload !== 'object') return null;
  const p = row.payload as Record<string, unknown>;
  if (p.team !== 'white' && p.team !== 'black') return null;
  const territory = typeof p.territory === 'string' ? p.territory : typeof p.territoryName === 'string' ? p.territoryName : null;
  if (!territory) return null;
  return {
    id: row.id, at: row.created_at, team: p.team, territory,
    captured: p.captured === true || p.won === true,
    odds: typeof p.odds === 'number' ? p.odds : undefined,
    attackerId: typeof p.attackerId === 'string' ? p.attackerId : typeof p.playerId === 'string' ? p.playerId : undefined,
  };
}

/** What the big screen shouts when an event lands: headline, sub-line, team colour. */
export interface Spotlight {
  id: number;
  team: TeamId;
  headline: string;
  sub: string;
}

export function spotlightFor(ev: MilestoneEvent | BattleEvent, players: readonly Player[], teamNames: Record<TeamId, string>): Spotlight {
  if ('captured' in ev) {
    const who = ev.attackerId ? players.find((p) => p.id === ev.attackerId)?.name : undefined;
    const pct = ev.odds !== undefined ? ` · ${Math.round(ev.odds * 100)}% odds` : '';
    return ev.captured
      ? { id: ev.id, team: ev.team, headline: `${teamNames[ev.team]} captures ${ev.territory}`.toUpperCase(), sub: `${who ? `${who} led the attack` : 'Attack'}${pct}` }
      : { id: ev.id, team: ev.team, headline: `${ev.territory} holds`.toUpperCase(), sub: `${teamNames[ev.team]}${who ? ` (${who})` : ''} attacked and failed${pct}` };
  }
  const name = players.find((p) => p.id === ev.playerId)?.name ?? 'Someone';
  return { id: ev.id, team: ev.team, headline: `${name} +${ev.gained} soldiers`.toUpperCase(), sub: `${fmt.format(ev.steps)} steps today · ${teamNames[ev.team]}` };
}
