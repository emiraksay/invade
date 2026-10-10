import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, STARTING_GARRISON, type TeamId } from '@invade/engine';
import { depthsFromHq, walkPhaseMapView, NO_PROGRESS } from './model';
import { islandPolygon } from './island';

const full = { white: { soldiers: 44, maxSoldiers: 44 }, black: { soldiers: 44, maxSoldiers: 44 } };
const half = { white: { soldiers: 22, maxSoldiers: 44 }, black: { soldiers: 0, maxSoldiers: 44 } };

describe('depthsFromHq', () => {
  it('reaches every territory of the team, starting at 0 on the HQ', () => {
    for (const team of ['white', 'black'] as TeamId[]) {
      const depth = depthsFromHq(DEFAULT_MAP, team);
      const mine = DEFAULT_MAP.territories.filter((t) => t.team === team);
      expect(depth.size).toBe(mine.length);
      expect(depth.get(mine.find((t) => t.isHq)!.id)).toBe(0);
    }
  });
});

describe('walkPhaseMapView', () => {
  it('keeps every territory with its geometry and owner', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, NO_PROGRESS);
    expect(view.territories).toHaveLength(DEFAULT_MAP.territories.length);
    expect(view.width).toBe(DEFAULT_MAP.width);
    for (const [i, t] of view.territories.entries()) {
      const src = DEFAULT_MAP.territories[i]!;
      expect(t.id).toBe(src.id);
      expect(t.owner).toBe(src.team);
      expect(t.polygon).toEqual(islandPolygon(src.polygon, DEFAULT_MAP.width, DEFAULT_MAP.height));
    }
  });

  it('gives every territory its starting garrison, plus the team bonus in the HQ', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, { ...half, white: { ...half.white, bonus: 2 } });
    const white = view.territories.filter((t) => t.owner === 'white');
    expect(white.find((t) => t.isHq)!.soldiers).toBe(STARTING_GARRISON + 2);
    expect(white.filter((t) => !t.isHq).every((t) => t.soldiers === STARTING_GARRISON)).toBe(true);
    expect(view.territories.filter((t) => t.owner === 'black').every((t) => t.soldiers === STARTING_GARRISON)).toBe(true);
  });

  it('places a piece for every member with their soldiers, and marks mine', () => {
    const p = (id: string, team: TeamId, steps: number, soldiers: number) => ({ player: { id, name: id, team }, steps, soldiers, next: null });
    const teams = {
      white: { soldiers: 8, maxSoldiers: 22, members: [p('emir', 'white', 10_200, 8)] },
      black: { soldiers: 4, maxSoldiers: 22, members: [p('kateryna', 'black', 5_100, 4)] },
    };
    const view = walkPhaseMapView(DEFAULT_MAP, teams, { myId: 'emir' });
    expect(view.pieces.map((x) => [x.playerId, x.team, x.soldiers, x.isMe])).toEqual([
      ['emir', 'white', 8, true],
      ['kateryna', 'black', 4, false],
    ]);
    for (const piece of view.pieces) {
      const t = view.territories.find((tv) => tv.id === piece.territoryId)!;
      expect(t.owner).toBe(piece.team);
      expect(t.isHq).toBe(false);
    }
  });

  it('has no pieces when member data is missing (previews)', () => {
    expect(walkPhaseMapView(DEFAULT_MAP, NO_PROGRESS).pieces).toEqual([]);
  });

  it('is dark with no steps and fully lit at the daily max', () => {
    expect(walkPhaseMapView(DEFAULT_MAP, NO_PROGRESS).territories.every((t) => t.charge === 0)).toBe(true);
    expect(walkPhaseMapView(DEFAULT_MAP, full).territories.every((t) => t.charge === 1)).toBe(true);
  });

  it('lights up from the HQ toward the front line, never the other way round', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, half);
    const depth = depthsFromHq(DEFAULT_MAP, 'white');
    const white = view.territories.filter((t) => t.owner === 'white').sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
    for (let i = 1; i < white.length; i++) expect(white[i]!.charge).toBeLessThanOrEqual(white[i - 1]!.charge);
    expect(white[0]!.charge).toBe(1); // the HQ is the first to light
    expect(view.territories.filter((t) => t.owner === 'black').every((t) => t.charge === 0)).toBe(true);
  });

  it('exposes the depth from the HQ (0 on the HQ, increasing toward the front)', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, NO_PROGRESS);
    for (const team of ['white', 'black'] as TeamId[]) {
      const mine = view.territories.filter((t) => t.owner === team);
      expect(mine.find((t) => t.isHq)!.depth).toBe(0);
      expect(Math.max(...mine.map((t) => t.depth))).toBeGreaterThan(0);
      for (const t of mine) expect(t.depth).toBe(depthsFromHq(DEFAULT_MAP, team).get(t.id));
    }
  });

  it('summarises each team', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, half);
    expect(view.teams.white).toEqual({ soldiers: 22, maxSoldiers: 44, territories: 12, charge: 0.5 });
    expect(view.teams.black.charge).toBe(0);
  });

  it('never divides by zero when a team has no members yet', () => {
    const view = walkPhaseMapView(DEFAULT_MAP, { white: { soldiers: 0, maxSoldiers: 0 }, black: full.black });
    expect(view.teams.white.charge).toBe(0);
    expect(Number.isNaN(view.territories[0]!.charge)).toBe(false);
  });
});
