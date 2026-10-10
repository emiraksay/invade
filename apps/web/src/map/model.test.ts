import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, type TeamId } from '@invade/engine';
import { depthsFromHq, walkPhaseMapView, NO_PROGRESS } from './model';

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
      expect(t.polygon).toBe(src.polygon);
    }
  });

  it("puts today's soldiers in the HQ only", () => {
    const view = walkPhaseMapView(DEFAULT_MAP, half);
    const white = view.territories.filter((t) => t.owner === 'white');
    expect(white.find((t) => t.isHq)!.soldiers).toBe(22);
    expect(white.filter((t) => !t.isHq).every((t) => t.soldiers === 0)).toBe(true);
    expect(view.territories.filter((t) => t.owner === 'black').every((t) => t.soldiers === 0)).toBe(true);
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
