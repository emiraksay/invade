import type { Point } from '@invade/engine';

/**
 * Shrinks a territory polygon toward its centre by `gap` map units, so neighbouring slabs
 * show a crack between them (the Figma's broken-ground look). Voronoi cells are convex,
 * so moving each vertex straight toward the centre keeps the shape.
 */
export function insetPolygon(polygon: readonly Point[], center: Point, gap: number): Point[] {
  const [cx, cy] = center;
  return polygon.map(([x, y]) => {
    const dx = cx - x, dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(gap / d, 0.45); // never collapse a tiny cell
    return [x + dx * k, y + dy * k] as const;
  });
}

/** Gap between slabs, in map units (the map is 100 x 160). */
export const SLAB_GAP = 1.6;
