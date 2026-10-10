import { Delaunay } from 'd3-delaunay';
import type { MapDef, Point, TeamId, Territory } from './types';

// Barcelona neighbourhoods, assigned to territories from top to bottom.
const NAMES = [
  'Horta', 'Vallcarca', 'Sarrià', 'Pedralbes', 'Tibidabo', 'El Carmel',
  'Gràcia', 'Sant Gervasi', 'Les Corts', 'Guinardó', 'Sagrada Família', 'Clot',
  'Eixample', 'Sant Antoni', 'Sants', 'Poblenou', 'Sant Martí', 'Fort Pienc',
  'Raval', 'Gòtic', 'Born', 'Poble-sec', 'Montjuïc', 'Barceloneta',
];

/** Small deterministic PRNG (mulberry32): same seed, same map, on every device and the server. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The seven zones of the weekly map: Barcelona's big districts, top to bottom.
export const ZONE_NAMES = ['Horta', 'Sarrià', 'Gràcia', 'Eixample', 'Sant Martí', 'Sants', 'Ciutat Vella'];

const round = (n: number) => Math.round(n * 100) / 100;

/** Area of a polygon (shoelace), in map units². */
export function polygonArea(polygon: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i]!;
    const [x1, y1] = polygon[(i + 1) % polygon.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function centroid(polygon: readonly Point[]): Point {
  let x = 0, y = 0, area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i]!;
    const [x1, y1] = polygon[(i + 1) % polygon.length]!;
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  area /= 2;
  return [x / (6 * area), y / (6 * area)];
}

/**
 * Generates the battlefield: `count` irregular territories (Voronoi cells, relaxed `relax` times
 * toward even sizes) tiling a portrait rectangle. Top is Black, bottom is White (as in the Figma),
 * each team's HQ is its territory furthest from the front line.
 * `split: 'count'` gives each team half the territories; `split: 'area'` gives each team (as close
 * as possible to) half the land, so the count may differ by team and may be odd.
 */
export function generateMap(opts: {
  seed?: number; count?: number; width?: number; height?: number;
  relax?: number; split?: 'count' | 'area'; names?: readonly string[]; idPrefix?: string;
} = {}): MapDef {
  const { seed = 7, count = 24, width = 100, height = 160, relax = 3, split = 'count', names = NAMES, idPrefix = 't' } = opts;
  if (count > names.length) throw new Error(`count must be <= ${names.length}`);
  if (split === 'count' && count % 2 !== 0) throw new Error('count must be even when splitting by count');

  const rng = seededRng(seed);
  // d3 wants mutable tuples internally; territories expose readonly `Point`s.
  let points: [number, number][] = Array.from({ length: count }, (): [number, number] => [rng() * width, rng() * height]);

  // Lloyd relaxation: move each point to its cell's centroid so cells end up similar in size.
  let voronoi = Delaunay.from(points).voronoi([0, 0, width, height]);
  for (let i = 0; i < relax; i++) {
    points = points.map((_, j): [number, number] => [...centroid(cellPolygon(voronoi, j))]);
    voronoi = Delaunay.from(points).voronoi([0, 0, width, height]);
  }
  const delaunay = voronoi.delaunay;

  // Sort cells top to bottom; first half Black, second half White.
  const order = points.map((p, i) => ({ i, y: p[1] })).sort((a, b) => a.y - b.y).map((o) => o.i);
  const rank = new Map(order.map((cell, r) => [cell, r]));
  // How many of the top cells go to Black: half of them, or the cut closest to half the land.
  let blackCount = count / 2;
  if (split === 'area') {
    const areas = order.map((cell) => polygonArea(cellPolygon(voronoi, cell)));
    const total = areas.reduce((a, b) => a + b, 0);
    let best = 1, bestGap = Infinity, sum = 0;
    for (let k = 1; k < count; k++) {
      sum += areas[k - 1]!;
      const gap = Math.abs(sum / total - 0.5);
      if (gap < bestGap) { best = k; bestGap = gap; }
    }
    blackCount = best;
  }
  const teamOf = (cell: number): TeamId => (rank.get(cell)! < blackCount ? 'black' : 'white');
  const pad = count > 9 ? 2 : 1;
  const idOf = (cell: number) => `${idPrefix}${String(rank.get(cell)! + 1).padStart(pad, '0')}`;

  const territories: Territory[] = order.map((cell, r) => {
    const polygon = cellPolygon(voronoi, cell);
    return {
      id: idOf(cell),
      name: names[r]!,
      team: teamOf(cell),
      isHq: r === 0 || r === count - 1,
      polygon: polygon.map(([x, y]) => [round(x), round(y)] as const),
      center: [round(points[cell]![0]), round(points[cell]![1])] as const,
      neighbors: [...delaunay.neighbors(cell)].filter((n) => sharesEdge(voronoi, cell, n)).map(idOf).sort(),
    };
  });

  return { id: `voronoi-${seed}-${count}${split === 'area' ? '-area' : ''}`, seed, width, height, territories };
}

type Voronoi = ReturnType<Delaunay<[number, number]>['voronoi']>;

function cellPolygon(voronoi: Voronoi, i: number): Point[] {
  const ring = voronoi.cellPolygon(i);
  // d3 closes the ring by repeating the first point; drop it.
  return ring.slice(0, -1).map(([x, y]) => [x, y] as const);
}

/** Delaunay neighbours can touch only at a corner after clipping; require a real shared edge. */
function sharesEdge(voronoi: Voronoi, a: number, b: number): boolean {
  const key = ([x, y]: Point) => `${x.toFixed(6)},${y.toFixed(6)}`;
  const pa = new Set(cellPolygon(voronoi, a).map(key));
  return cellPolygon(voronoi, b).filter((p) => pa.has(key(p))).length >= 2;
}

/** The weekly map (decision 19): seven zones of different sizes; each team starts with half the land. */
export const MAP_SEED = 162;
export const DEFAULT_MAP: MapDef = generateMap({ seed: MAP_SEED, count: 7, relax: 1, split: 'area', names: ZONE_NAMES, idPrefix: 'z' });
