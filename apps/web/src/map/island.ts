import type { Point } from '@invade/engine';

/**
 * Bends the engine's rectangular map into the Figma's island: rounded corners and a coastline
 * that wobbles in and out. Display only: territories, neighbours and rules stay the engine's.
 *
 * Every point moves toward the map centre by a factor that depends only on its direction, so
 * the rectangle's border lands on the coastline and the inside follows smoothly. It is a pure
 * function of the point, so corners shared by neighbouring tiles stay shared (no cracks).
 */

const CORNER_ROUNDNESS = 2.6;  // superellipse exponent: lower = rounder island
const COAST_WOBBLE = 0.07;     // how far the coast bites in, as a share of the radius
const COAST_SAMPLES = 6;       // extra points per border edge, so the coast can wobble

/** 0..1 coastline noise around the island (fixed: same island on every device). */
function coast(angle: number): number {
  const n = 0.55 * Math.sin(3 * angle + 0.7) + 0.3 * Math.sin(7 * angle + 2.1) + 0.15 * Math.sin(13 * angle + 4.4);
  return (n + 1) / 2;
}

/** How much to shrink a point lying in direction `angle` (normalised square coords): 1 keeps it, < 1 pulls it in. */
function shrink(angle: number): number {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const square = 1 / Math.max(c, s);                                                       // centre → square edge
  const round = Math.pow(Math.pow(c, CORNER_ROUNDNESS) + Math.pow(s, CORNER_ROUNDNESS), -1 / CORNER_ROUNDNESS); // centre → rounded edge
  return (round / square) * (1 - COAST_WOBBLE * coast(angle));
}

export function islandPoint([x, y]: Point, width: number, height: number): Point {
  const hw = width / 2, hh = height / 2;
  const ux = (x - hw) / hw, uy = (y - hh) / hh;
  if (ux === 0 && uy === 0) return [x, y];
  const k = shrink(Math.atan2(uy, ux));
  return [hw + ux * k * hw, hh + uy * k * hh];
}

const EPS = 1e-6;
/** The borders of the [0,w] x [0,h] rectangle a point sits on (two at a corner). */
function sides([x, y]: Point, width: number, height: number): string[] {
  const out: string[] = [];
  if (Math.abs(x) < EPS) out.push('left');
  if (Math.abs(x - width) < EPS) out.push('right');
  if (Math.abs(y) < EPS) out.push('top');
  if (Math.abs(y - height) < EPS) out.push('bottom');
  return out;
}

/**
 * A territory polygon on the island. Edges along the map border get extra points first, so the
 * coastline curves; inner edges keep their two ends (shared with the neighbour).
 */
export function islandPolygon(polygon: readonly Point[], width: number, height: number): Point[] {
  const out: Point[] = [];
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!;
    out.push(a);
    const sb = sides(b, width, height);
    if (sides(a, width, height).some((s) => sb.includes(s))) {
      for (let j = 1; j <= COAST_SAMPLES; j++) {
        const t = j / (COAST_SAMPLES + 1);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  });
  return out.map((p) => islandPoint(p, width, height));
}

/** The whole island's coastline (the map border, bent), finely sampled. For shadows and outlines. */
export function islandOutline(width: number, height: number, perSide = 48): Point[] {
  const corners: Point[] = [[0, 0], [width, 0], [width, height], [0, height]];
  const out: Point[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4]!;
    for (let j = 0; j < perSide; j++) {
      const t = j / perSide;
      out.push(islandPoint([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], width, height));
    }
  });
  return out;
}
