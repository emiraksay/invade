import type { Point, TeamId } from '@invade/engine';
import type { MapView, TerritoryView } from './model';
import { insetPolygon, SLAB_GAP } from './geometry';

/**
 * 2.5D SVG battlefield in the Figma "Base" style: dark extruded tiles for Black, light glossy
 * tiles for White, glowing white edges that brighten as a team's charge rises, the HQ marked
 * with a crown and today's soldiers. Pure presentation: everything it draws comes from MapView.
 * Works everywhere (no WebGL), so it is also the fallback for the three.js map.
 */

const DEPTH = 6;                 // tile thickness, in map units
const HQ_LIFT_PER_SOLDIER = 0.18; // the HQ pillar grows with today's soldiers
const HQ_LIFT_MAX = 10;
const TILT_DEG = 38;

interface Palette { topDim: string; topLit: string; side: string; text: string }
const PALETTE: Record<TeamId, Palette> = {
  white: { topDim: '#86847f', topLit: '#eef1f6', side: '#5f5e5a', text: '#121215' },
  black: { topDim: '#171311', topLit: '#3b3532', side: '#070605', text: '#f2efe6' },
};

/** Linear blend of two hex colours, t in 0..1. */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const v = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0');
  return `#${v(0)}${v(1)}${v(2)}`;
}

const path = (poly: readonly Point[], dy = 0) => `M${poly.map(([x, y]) => `${x} ${y + dy}`).join('L')}Z`;

function Crown({ x, y, fill }: { x: number; y: number; fill: string }) {
  // Small crown: three points on a band. Drawn in map units, about 8 wide.
  return (
    <path
      d={`M${x - 4} ${y + 2} L${x - 4} ${y - 2} L${x - 2} ${y} L${x} ${y - 3.5} L${x + 2} ${y} L${x + 4} ${y - 2} L${x + 4} ${y + 2} Z`}
      fill={fill}
      stroke="#000"
      strokeWidth="0.4"
      strokeLinejoin="round"
    />
  );
}

function Tile({ t, selected, onTap }: { t: TerritoryView; selected: boolean; onTap?: (t: TerritoryView) => void }) {
  const p = PALETTE[t.owner];
  const depth = DEPTH + (t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0);
  const top = mix(p.topDim, p.topLit, t.charge);
  const [cx, cy] = t.center;
  const poly = insetPolygon(t.polygon, t.center, SLAB_GAP);
  const interactive = Boolean(onTap);
  return (
    <g
      transform={t.isHq ? `translate(0 ${-(depth - DEPTH)})` : undefined}
      onClick={onTap ? () => onTap(t) : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={`${t.name}, ${t.owner}${t.isHq ? ' headquarters' : ''}${t.soldiers ? `, ${t.soldiers} soldiers` : ''}`}
      style={{ cursor: interactive ? 'pointer' : undefined }}
    >
      {/* Side (extrusion): the same polygon pushed down, painted first. */}
      <path d={path(poly, depth)} fill={p.side} />
      {/* Outer glow: a wide, faint white stroke that strengthens with charge. Cheap, no SVG filter. */}
      <path d={path(poly)} fill="none" stroke="#fff" strokeWidth={5} strokeOpacity={0.04 + 0.12 * t.charge} strokeLinejoin="round" style={{ transition: 'stroke-opacity 600ms ease' }} />
      <path d={path(poly)} fill="none" stroke="#fff" strokeWidth={2.4} strokeOpacity={0.08 + 0.3 * t.charge} strokeLinejoin="round" style={{ transition: 'stroke-opacity 600ms ease' }} />
      {/* Top */}
      <path
        d={path(poly)}
        fill={top}
        stroke={selected ? '#7fb6ff' : '#fff'}
        strokeWidth={selected ? 1.2 : 0.7}
        strokeOpacity={selected ? 1 : 0.45 + 0.55 * t.charge}
        strokeLinejoin="round"
        style={{ transition: 'fill 600ms ease, stroke-opacity 600ms ease' }}
      />
      {t.isHq && <Crown x={cx} y={cy - (t.soldiers ? 3 : 0)} fill={t.owner === 'white' ? '#121215' : '#f2efe6'} />}
      {t.isHq && t.soldiers > 0 && (
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="6" fontWeight="700" fill={p.text} style={{ fontFamily: 'var(--font-body)' }}>
          {t.soldiers}
        </text>
      )}
    </g>
  );
}

export interface MapSvgProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** Flat top-down view (no tilt), e.g. for small previews. */
  flat?: boolean;
}

export function MapSvg({ view, selected = null, onTap, flat = false }: MapSvgProps) {
  const pad = 4;
  const extra = DEPTH + HQ_LIFT_MAX;
  // Paint back to front so a tile's side is covered by the tile in front of it.
  const tiles = [...view.territories].sort((a, b) => a.center[1] - b.center[1]);
  return (
    <div style={{ perspective: flat ? undefined : '900px', margin: flat ? 0 : '-10% 0 -6%' }}>
      <svg
        viewBox={`${-pad} ${-pad - HQ_LIFT_MAX} ${view.width + pad * 2} ${view.height + pad * 2 + extra}`}
        width="100%"
        role="img"
        aria-label="Battlefield"
        style={{
          display: 'block',
          userSelect: 'none',
          transform: flat ? undefined : `rotateX(${TILT_DEG}deg) rotateZ(-7deg)`,
          transformOrigin: '50% 55%',
        }}
      >
        {tiles.map((t) => (
          <Tile key={t.id} t={t} selected={t.id === selected} onTap={onTap} />
        ))}
      </svg>
    </div>
  );
}
