import type { MapDef, Point, TeamDay, TeamId } from '@invade/engine';

/**
 * The map view model: what a renderer (SVG or three.js) draws, as pure data.
 * No React, no three.js, no network. Built from engine data so the renderers never
 * learn the rules. When the night phase adds territory state to the engine contracts,
 * only this file changes.
 */

export interface TerritoryView {
  id: string;
  name: string;
  owner: TeamId;
  isHq: boolean;
  polygon: readonly Point[];
  center: Point;
  neighbors: readonly string[];
  /** Soldiers garrisoned here. Walk Phase: today's team soldiers march into the HQ. */
  soldiers: number;
  /** 0..1: how lit the territory is. Spreads from the HQ to the front line as the team nears its daily max. */
  charge: number;
}

export interface TeamView {
  soldiers: number;
  maxSoldiers: number;
  territories: number;
  /** 0..1: soldiers / maxSoldiers. */
  charge: number;
}

export interface MapView {
  width: number;
  height: number;
  territories: TerritoryView[];
  teams: Record<TeamId, TeamView>;
}

/** What the Walk Phase view needs from each team's day (a subset of the engine's TeamDay). */
export type TeamProgress = Pick<TeamDay, 'soldiers' | 'maxSoldiers'>;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Steps from the team's HQ through the team's own land (breadth-first). The front line is deepest. */
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
 * ☀️ Walk Phase: the map is the scoreboard.
 * Today's soldiers sit in the team's HQ, and the team's half lights up from the HQ
 * toward the front line in proportion to soldiers / maxSoldiers.
 */
export function walkPhaseMapView(map: MapDef, teams: Record<TeamId, TeamProgress>): MapView {
  const depths: Record<TeamId, Map<string, number>> = {
    white: depthsFromHq(map, 'white'),
    black: depthsFromHq(map, 'black'),
  };
  const maxDepth = (team: TeamId) => Math.max(0, ...depths[team].values());
  const teamCharge = (team: TeamId) =>
    teams[team].maxSoldiers > 0 ? clamp01(teams[team].soldiers / teams[team].maxSoldiers) : 0;

  const territories = map.territories.map<TerritoryView>((t) => {
    const levels = maxDepth(t.team) + 1;
    const d = depths[t.team].get(t.id) ?? maxDepth(t.team);
    return {
      id: t.id,
      name: t.name,
      owner: t.team,
      isHq: t.isHq,
      polygon: t.polygon,
      center: t.center,
      neighbors: t.neighbors,
      soldiers: t.isHq ? teams[t.team].soldiers : 0,
      charge: clamp01(teamCharge(t.team) * levels - d),
    };
  });

  const teamView = (team: TeamId): TeamView => ({
    soldiers: teams[team].soldiers,
    maxSoldiers: teams[team].maxSoldiers,
    territories: map.territories.filter((t) => t.team === team).length,
    charge: teamCharge(team),
  });

  return {
    width: map.width,
    height: map.height,
    territories,
    teams: { white: teamView('white'), black: teamView('black') },
  };
}

/** An empty day: nobody has walked yet. Handy for loading states and the SVG/3D previews. */
export const NO_PROGRESS: Record<TeamId, TeamProgress> = {
  white: { soldiers: 0, maxSoldiers: 0 },
  black: { soldiers: 0, maxSoldiers: 0 },
};
