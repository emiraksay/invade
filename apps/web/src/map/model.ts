import { STARTING_GARRISON, depthsFromHq as engineDepthsFromHq, startingPositions, type MapDef, type Point, type TeamDay, type TeamId } from '@invade/engine';
import { islandPoint, islandPolygon } from './island';

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
  /** Soldiers garrisoned on the ground here (starting garrison; the HQ also holds today's team bonus). */
  soldiers: number;
  /** 0..1: how lit the territory is. Spreads from the HQ to the front line as the team nears its daily max. */
  charge: number;
  /** Steps from the team's HQ through its own land (0 = HQ). Renderers stagger effects by it. */
  depth: number;
}

export interface TeamView {
  soldiers: number;
  maxSoldiers: number;
  territories: number;
  /** 0..1: soldiers / maxSoldiers. */
  charge: number;
}

/** A player standing on the map with the soldiers they carry (cousin's design: avatar + soldier badge). */
export interface PieceView {
  playerId: string;
  name: string;
  team: TeamId;
  territoryId: string;
  /** Where to draw it, in map units on the island; nudged apart when players share a territory. */
  position: Point;
  /** Soldiers this player earned today from walking (milestones 5k/10k/12k). */
  soldiers: number;
  steps: number;
  /** True for the viewer's own piece (highlight it). */
  isMe: boolean;
}

export interface MapView {
  width: number;
  height: number;
  territories: TerritoryView[];
  teams: Record<TeamId, TeamView>;
  /** Every player's piece. Empty when member data isn't available (e.g. previews). */
  pieces: PieceView[];
}

/** What the Walk Phase view needs from each team's day (a subset of the engine's TeamDay). */
export type TeamProgress = Pick<TeamDay, 'soldiers' | 'maxSoldiers'> & Partial<Pick<TeamDay, 'members' | 'bonus'>>;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Steps from the team's HQ through the team's own land (the rule lives in the engine). */
export const depthsFromHq = engineDepthsFromHq;

/** Spread pieces that share a territory in a small ring around its centre. */
function nudge(center: Point, index: number, count: number): Point {
  if (count <= 1) return center;
  const angle = (2 * Math.PI * index) / count;
  const r = 3.2;
  return [center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)];
}

/**
 * ☀️ Walk Phase: the map is the scoreboard.
 * Today's soldiers sit in the team's HQ, and the team's half lights up from the HQ
 * toward the front line in proportion to soldiers / maxSoldiers.
 */
export function walkPhaseMapView(map: MapDef, teams: Record<TeamId, TeamProgress>, opts: { myId?: string } = {}): MapView {
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
      // Drawn on the Figma's island outline; the engine's map stays a rectangle.
      polygon: islandPolygon(t.polygon, map.width, map.height),
      center: islandPoint(t.center, map.width, map.height),
      neighbors: t.neighbors,
      soldiers: STARTING_GARRISON + (t.isHq ? teams[t.team].bonus ?? 0 : 0),
      charge: clamp01(teamCharge(t.team) * levels - d),
      depth: d,
    };
  });

  const teamView = (team: TeamId): TeamView => ({
    soldiers: teams[team].soldiers,
    maxSoldiers: teams[team].maxSoldiers,
    territories: map.territories.filter((t) => t.team === team).length,
    charge: teamCharge(team),
  });

  // Pieces: every member stands on their starting territory with today's soldiers.
  const members = [...(teams.white.members ?? []), ...(teams.black.members ?? [])];
  const positions = startingPositions(map, members.map((m) => m.player));
  const centers = new Map(territories.map((t) => [t.id, t.center]));
  const crowd = new Map<string, number>();
  for (const id of positions.values()) crowd.set(id, (crowd.get(id) ?? 0) + 1);
  const seen = new Map<string, number>();
  const pieces = members.flatMap<PieceView>((m) => {
    const territoryId = positions.get(m.player.id);
    const center = territoryId ? centers.get(territoryId) : undefined;
    if (!territoryId || !center) return [];
    const i = seen.get(territoryId) ?? 0;
    seen.set(territoryId, i + 1);
    return [{
      playerId: m.player.id,
      name: m.player.name,
      team: m.player.team,
      territoryId,
      position: nudge(center, i, crowd.get(territoryId) ?? 1),
      soldiers: m.soldiers,
      steps: m.steps,
      isMe: m.player.id === opts.myId,
    }];
  });

  return {
    width: map.width,
    height: map.height,
    territories,
    teams: { white: teamView('white'), black: teamView('black') },
    pieces,
  };
}

/** An empty day: nobody has walked yet. Handy for loading states and the SVG/3D previews. */
export const NO_PROGRESS: Record<TeamId, TeamProgress> = {
  white: { soldiers: 0, maxSoldiers: 0 },
  black: { soldiers: 0, maxSoldiers: 0 },
};
