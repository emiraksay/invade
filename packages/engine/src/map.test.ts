import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, generateMap, polygonArea } from './map';
import type { MapDef, TeamId } from './types';

const byId = (map: MapDef) => new Map(map.territories.map((t) => [t.id, t]));

describe('generateMap', () => {
  it('is deterministic: same seed, identical map', () => {
    expect(generateMap({ seed: 7 })).toEqual(generateMap({ seed: 7 }));
    expect(generateMap({ seed: 8 })).not.toEqual(generateMap({ seed: 7 }));
  });

  it('has 7 named zones with unique ids and real polygons', () => {
    const ids = new Set(DEFAULT_MAP.territories.map((t) => t.id));
    expect(ids.size).toBe(7);
    for (const t of DEFAULT_MAP.territories) {
      expect(t.name).toBeTruthy();
      expect(t.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives each team about half the land, in zones of clearly different sizes, with one HQ each', () => {
    const areas = DEFAULT_MAP.territories.map((t) => polygonArea(t.polygon));
    const total = areas.reduce((a, b) => a + b, 0);
    for (const team of ['white', 'black'] as TeamId[]) {
      const mine = DEFAULT_MAP.territories.filter((t) => t.team === team);
      const share = mine.reduce((a, t) => a + polygonArea(t.polygon), 0) / total;
      expect(Math.abs(share - 0.5)).toBeLessThan(0.03);
      expect(mine.length).toBeGreaterThanOrEqual(3);
      expect(mine.filter((t) => t.isHq)).toHaveLength(1);
    }
    expect(Math.max(...areas) / Math.min(...areas)).toBeGreaterThan(2);
  });

  it('still splits by count when asked (the old 24-territory map)', () => {
    const old = generateMap();
    expect(old.territories).toHaveLength(24);
    for (const team of ['white', 'black'] as TeamId[]) expect(old.territories.filter((t) => t.team === team)).toHaveLength(12);
  });

  it('has symmetric neighbours and every territory has at least one', () => {
    const lookup = byId(DEFAULT_MAP);
    for (const t of DEFAULT_MAP.territories) {
      expect(t.neighbors.length).toBeGreaterThan(0);
      for (const n of t.neighbors) expect(lookup.get(n)?.neighbors).toContain(t.id);
    }
  });

  it("keeps each team's land connected and gives the teams a shared front line", () => {
    const lookup = byId(DEFAULT_MAP);
    for (const team of ['white', 'black'] as TeamId[]) {
      const mine = DEFAULT_MAP.territories.filter((t) => t.team === team);
      const seen = new Set([mine[0]!.id]);
      const queue = [mine[0]!.id];
      while (queue.length) {
        for (const n of lookup.get(queue.shift()!)!.neighbors) {
          if (lookup.get(n)!.team === team && !seen.has(n)) { seen.add(n); queue.push(n); }
        }
      }
      expect(seen.size).toBe(mine.length);
    }
    const front = DEFAULT_MAP.territories.filter(
      (t) => t.team === 'white' && t.neighbors.some((n) => lookup.get(n)!.team === 'black'),
    );
    expect(front.length).toBeGreaterThan(0);
  });

  it('keeps every point inside the map bounds', () => {
    for (const t of DEFAULT_MAP.territories) {
      for (const [x, y] of t.polygon) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(DEFAULT_MAP.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(DEFAULT_MAP.height);
      }
    }
  });
});
