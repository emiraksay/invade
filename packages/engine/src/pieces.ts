// Player pieces: every player stands on a territory of their team's half with the soldiers they carry.
// From the cousin's design (Figma "Sctech" Place/Move/Attack frames): avatars on the map, each with a
// soldier badge. Decided 2026-10-10: soldiers from walking go to the player ("self"); several players
// may share a territory; pieces start spread over the team's half, front line first, by join order.
import type { MapDef, Player, TeamId } from './types';

/** Soldiers every territory holds at the start of the campaign (the numbers on the Figma map). */
export const STARTING_GARRISON = 2;

/** Steps from the team's HQ through its own land (0 = HQ). The front line is deepest. */
export function depthsFromHq(map: MapDef, team: TeamId): Map<string, number> {
  const mine = map.territories.filter((t) => t.team === team);
  const byId = new Map(mine.map((t) => [t.id, t]));
  const hq = mine.find((t) => t.isHq);
  const depth = new Map<string, number>();
  if (!hq) return depth;
  depth.set(hq.id, 0);
  const queue = [hq.id];
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const n of byId.get(id)!.neighbors) {
      if (byId.has(n) && !depth.has(n)) {
        depth.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return depth;
}

/**
 * Where each player's piece starts: spread evenly over the team's non-HQ territories, ordered
 * front line first, in the given player order (join order). Deterministic, so every screen agrees.
 * Returns playerId -> territoryId.
 */
export function startingPositions(map: MapDef, players: readonly Player[]): Map<string, string> {
  const positions = new Map<string, string>();
  for (const team of ['white', 'black'] as TeamId[]) {
    const depth = depthsFromHq(map, team);
    const slots = map.territories
      .filter((t) => t.team === team && !t.isHq)
      .sort((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0) || a.id.localeCompare(b.id));
    const hq = map.territories.find((t) => t.team === team && t.isHq);
    const members = players.filter((p) => p.team === team);
    members.forEach((p, i) => {
      const slot = slots[Math.floor((i * slots.length) / Math.max(1, members.length))] ?? hq;
      if (slot) positions.set(p.id, slot.id);
    });
  }
  return positions;
}
