import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, type Point } from '@invade/engine';
import { islandPoint, islandPolygon } from './island';

const { width: w, height: h } = DEFAULT_MAP;
const key = ([x, y]: Point) => `${x.toFixed(6)},${y.toFixed(6)}`;

describe('island outline', () => {
  it('keeps every point inside the map and the centre in place', () => {
    for (const t of DEFAULT_MAP.territories) {
      for (const [x, y] of islandPolygon(t.polygon, w, h)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(w);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(h);
      }
    }
    expect(islandPoint([w / 2, h / 2], w, h)).toEqual([w / 2, h / 2]);
  });

  it('pulls the corners in (rounded island, not a rectangle)', () => {
    const [x, y] = islandPoint([0, 0], w, h);
    expect(x).toBeGreaterThan(w * 0.05);
    expect(y).toBeGreaterThan(h * 0.05);
  });

  it('keeps corners shared by neighbours shared, so tiles never crack apart', () => {
    const byId = new Map(DEFAULT_MAP.territories.map((t) => [t.id, t]));
    for (const t of DEFAULT_MAP.territories) {
      for (const n of t.neighbors) {
        const shared = t.polygon.filter((p) => byId.get(n)!.polygon.some((q) => key(q) === key(p)));
        const a = new Set(islandPolygon(t.polygon, w, h).map(key));
        const b = new Set(islandPolygon(byId.get(n)!.polygon, w, h).map(key));
        for (const p of shared) {
          const moved = key(islandPoint(p, w, h));
          expect(a.has(moved) && b.has(moved)).toBe(true);
        }
      }
    }
  });

  it('adds coastline points only along the map border', () => {
    for (const t of DEFAULT_MAP.territories) {
      const onBorder = t.polygon.some(([x, y]) => x === 0 || y === 0 || x === w || y === h);
      if (!onBorder) expect(islandPolygon(t.polygon, w, h)).toHaveLength(t.polygon.length);
    }
  });
});
