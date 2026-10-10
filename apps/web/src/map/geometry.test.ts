import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from '@invade/engine';
import { insetPolygon, SLAB_GAP } from './geometry';

describe('insetPolygon', () => {
  it('moves every vertex toward the centre by about the gap', () => {
    for (const t of DEFAULT_MAP.territories) {
      const inset = insetPolygon(t.polygon, t.center, SLAB_GAP);
      expect(inset).toHaveLength(t.polygon.length);
      inset.forEach(([x, y], i) => {
        const [ox, oy] = t.polygon[i]!;
        const moved = Math.hypot(x - ox, y - oy);
        expect(moved).toBeLessThanOrEqual(SLAB_GAP + 1e-9);
        // closer to the centre than before
        expect(Math.hypot(t.center[0] - x, t.center[1] - y)).toBeLessThan(Math.hypot(t.center[0] - ox, t.center[1] - oy) + 1e-9);
      });
    }
  });

  it('never collapses a cell past its centre', () => {
    const tiny = insetPolygon([[0, 0], [1, 0], [1, 1], [0, 1]], [0.5, 0.5], 10);
    for (const [x, y] of tiny) expect(Math.hypot(x - 0.5, y - 0.5)).toBeGreaterThan(0.3);
  });
});
