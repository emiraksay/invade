// The war: player pieces attack neighbouring enemy territories. Decision 4: odds roll,
// P(win) = attackers / (attackers + defenders), rolled on the server. Facts are stored as
// BattleRecords (events of type 'battle'); the map state is always derived by replaying them.
import { DEFAULT_MAP, polygonArea } from './map';
import { STARTING_GARRISON, startingPositions } from './pieces';
import type { GameDay, MapDef, Player, TeamId } from './types';

export interface BattleRecord {
  id: number;
  playerId: string;
  team: TeamId;
  from: string;
  to: string;
  attackers: number;
  defenders: number;
  /** Win probability at the time of the attack. */
  p: number;
  /** Server roll in [0, 1); the attack won if roll < p. */
  roll: number;
  won: boolean;
  attackersLeft: number;
  defendersLeft: number;
  day: GameDay;
  at: string; // ISO timestamp
}

export interface PieceState {
  territoryId: string;
  /** Soldiers this player can still commit today (earned today minus spent in today's attacks). */
  available: number;
}

export interface WarState {
  owner: Record<string, TeamId>;
  garrison: Record<string, number>;
  pieces: Record<string, PieceState>;
}

export interface AttackOption {
  to: string;
  name: string;
  defenders: number;
  maxAttackers: number;
}

export function attackOdds(attackers: number, defenders: number): number {
  if (attackers <= 0) return 0;
  return attackers / (attackers + Math.max(0, defenders));
}

/** Resolves one attack for a given roll in [0, 1). Survivors per decision 4. */
export function resolveBattle(attackers: number, defenders: number, roll: number) {
  const p = attackOdds(attackers, defenders);
  const won = roll < p;
  return {
    p,
    won,
    attackersLeft: won ? Math.max(1, attackers - Math.floor(defenders / 2)) : 0,
    defendersLeft: won ? 0 : Math.max(1, defenders - Math.floor(attackers / 2)),
  };
}

/**
 * The current war: start from the map's halves and garrisons, place pieces, then replay every
 * battle in order. A won battle flips the territory, leaves the survivors as its garrison and
 * moves the attacker's piece in. Soldiers committed today are subtracted from today's earnings.
 */
export function warState(
  map: MapDef,
  players: readonly Player[],
  earnedToday: Readonly<Record<string, number>>,
  battles: readonly BattleRecord[],
  today: GameDay,
): WarState {
  const owner: Record<string, TeamId> = {};
  const garrison: Record<string, number> = {};
  for (const t of map.territories) {
    owner[t.id] = t.team;
    garrison[t.id] = STARTING_GARRISON;
  }
  const pieces: Record<string, PieceState> = {};
  for (const [playerId, territoryId] of startingPositions(map, players)) {
    pieces[playerId] = { territoryId, available: earnedToday[playerId] ?? 0 };
  }

  const ordered = [...battles].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  for (const b of ordered) {
    // A battle for a territory that is not on this map (fought on an earlier map) is ignored.
    if (!(b.to in owner)) continue;
    const piece = pieces[b.playerId];
    if (piece && b.day === today) piece.available = Math.max(0, piece.available - b.attackers);
    if (b.won) {
      owner[b.to] = b.team;
      garrison[b.to] = b.attackersLeft;
      if (piece) piece.territoryId = b.to;
      // Defenders standing on the lost territory retreat to a neighbour their team still holds, else their HQ.
      const lost = map.territories.find((t) => t.id === b.to);
      for (const p of players) {
        const other = pieces[p.id];
        if (!other || p.team === b.team || other.territoryId !== b.to) continue;
        const retreat = lost?.neighbors.filter((n) => owner[n] === p.team).sort()[0]
          ?? map.territories.find((t) => t.team === p.team && t.isHq && owner[t.id] === p.team)?.id
          ?? map.territories.find((t) => owner[t.id] === p.team)?.id;
        if (retreat) other.territoryId = retreat;
      }
    } else {
      garrison[b.to] = b.defendersLeft;
    }
  }
  return { owner, garrison, pieces };
}

/** Enemy territories next to the player's piece that they can attack now. */
export function attackOptions(war: WarState, map: MapDef, playerId: string): AttackOption[] {
  const piece = war.pieces[playerId];
  if (!piece || piece.available <= 0) return [];
  const here = map.territories.find((t) => t.id === piece.territoryId);
  const myTeam = war.owner[piece.territoryId];
  if (!here || !myTeam) return [];
  return here.neighbors
    .filter((id) => war.owner[id] !== myTeam)
    .map((id) => ({
      to: id,
      name: map.territories.find((t) => t.id === id)?.name ?? id,
      defenders: war.garrison[id] ?? 0,
      maxAttackers: piece.available,
    }));
}

/** Share of the land a team holds, weighted by each territory's area (the 51% win condition). */
export function territoryShare(war: WarState, team: TeamId, map: MapDef = DEFAULT_MAP): number {
  let mine = 0, all = 0;
  for (const t of map.territories) {
    const area = polygonArea(t.polygon);
    all += area;
    if (war.owner[t.id] === team) mine += area;
  }
  return all ? mine / all : 0;
}

/** A stored event row (type 'battle', written by POST /api/attack) -> BattleRecord, or null if malformed. */
export function toBattleRecord(row: { id: number; type: string; payload: unknown; created_at: string }): BattleRecord | null {
  if (row.type !== 'battle' || !row.payload || typeof row.payload !== 'object') return null;
  const p = row.payload as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const playerId = str(p.playerId), from = str(p.from), to = str(p.to), day = str(p.day);
  const attackers = num(p.attackers), defenders = num(p.defenders), pr = num(p.p), roll = num(p.roll);
  const attackersLeft = num(p.attackersLeft), defendersLeft = num(p.defendersLeft);
  if (!playerId || !from || !to || !day || (p.team !== 'white' && p.team !== 'black') || typeof p.won !== 'boolean') return null;
  if (attackers === null || defenders === null || pr === null || roll === null || attackersLeft === null || defendersLeft === null) return null;
  return { id: row.id, at: row.created_at, playerId, team: p.team, from, to, attackers, defenders, p: pr, roll, won: p.won, attackersLeft, defendersLeft, day };
}
