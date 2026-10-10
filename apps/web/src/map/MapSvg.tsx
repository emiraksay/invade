import { useEffect, useRef, useState } from 'react';
import type { Point, TeamId } from '@invade/engine';
import type { MapView, PieceView, TerritoryView } from './model';
import { GARRISON_OFFSET, usePop } from './pieces';
import { insetPolygon, SLAB_GAP } from './geometry';
import { CROWN_FILL, CROWN_H, CROWN_PATH, CROWN_W } from './crown';

/**
 * 2.5D SVG battlefield in the Figma "Base" style: dark extruded tiles for Black, light glossy
 * tiles for White, glowing white edges that brighten as a team's charge rises, the HQ marked
 * with a crown, garrison numbers and the players' pieces. Pure presentation: everything it draws comes from MapView.
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

/** The HQ crown (outlined), centred on (x, y), about 9 map units wide. */
function Crown({ x, y, fill }: { x: number; y: number; fill: string }) {
  const k = 9 / CROWN_W;
  return (
    <path
      d={CROWN_PATH}
      transform={`translate(${x - (CROWN_W * k) / 2} ${y - (CROWN_H * k) / 2}) scale(${k})`}
      fill="none"
      stroke={fill}
      strokeWidth={1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

const RIPPLE_STEP_MS = 140;

function Tile({ t, pulse, selected, onTap }: { t: TerritoryView; pulse: number; selected: boolean; onTap?: (t: TerritoryView) => void }) {
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
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(t); } } : undefined}
      tabIndex={interactive ? 0 : undefined}
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
      {/* Soldiers arrived: a white flash that marches outward from the HQ. Remounted on each pulse to replay. */}
      {pulse > 0 && (
        <path key={pulse} d={path(poly)} fill="#fff" className="tile-pulse" style={{ animationDelay: `${t.depth * RIPPLE_STEP_MS}ms` }} pointerEvents="none" />
      )}
      {/* Figma: the HQ shows just the crown; soldier counts live in the stats bar and team lists. */}
      {t.isHq && <Crown x={cx} y={cy} fill={CROWN_FILL[t.owner]} />}
    </g>
  );
}

/** Garrison number on a territory (Figma map numbers): small white circle, black number. */
function Garrison({ t }: { t: TerritoryView }) {
  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  const x = t.center[0] + GARRISON_OFFSET[0], y = t.center[1] + GARRISON_OFFSET[1] - lift;
  return (
    <g pointerEvents="none" aria-hidden>
      <circle cx={x} cy={y} r={2.4} fill="#fff" stroke="#000" strokeWidth={0.3} />
      <text x={x} y={y} fontSize={2.8} fontWeight={700} fill="#000" textAnchor="middle" dominantBaseline="central">{t.soldiers}</text>
    </g>
  );
}

/** A player piece: disc in team colour with the initial, soldier badge bottom-right, name below. */
function Piece({ p, lift }: { p: PieceView; lift: number }) {
  const pop = usePop(p.soldiers);
  const [x, y] = [p.position[0], p.position[1] - lift];
  const light = p.team === 'white';
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none" aria-label={`${p.name}, ${p.soldiers} soldiers${p.isMe ? ' (you)' : ''}`}>
      {p.isMe && <circle r={6.6} fill="none" stroke="#fff" strokeWidth={2.4} strokeOpacity={0.35} />}
      <circle r={4.6} fill={light ? '#f4f4f4' : '#1d1a18'} stroke={light ? '#1d1a18' : '#e8e8e8'} strokeWidth={p.isMe ? 1.3 : 0.7} />
      <text fontSize={4.4} fontWeight={700} fill={light ? '#111' : '#f2f2f2'} textAnchor="middle" dominantBaseline="central">{p.name.trim().charAt(0).toUpperCase() || '?'}</text>
      <g key={pop} className={pop ? 'piece-pop' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx={3.6} cy={3.4} r={2.3} fill="#fff" stroke="#000" strokeWidth={0.3} />
        <text x={3.6} y={3.4} fontSize={2.7} fontWeight={700} fill="#000" textAnchor="middle" dominantBaseline="central">{p.soldiers}</text>
      </g>
      <text y={8.6} fontSize={2.8} fill="#fff" textAnchor="middle" style={{ paintOrder: 'stroke' }} stroke="#000" strokeWidth={0.6}>{p.isMe ? 'You' : p.name}</text>
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

/** Counts up each time a team's soldiers increase, so tiles can replay their flash. */
function usePulses(view: MapView): Record<TeamId, number> {
  const [pulses, setPulses] = useState<Record<TeamId, number>>({ white: 0, black: 0 });
  const prev = useRef<Record<TeamId, number>>({ white: view.teams.white.soldiers, black: view.teams.black.soldiers });
  const white = view.teams.white.soldiers, black = view.teams.black.soldiers;
  useEffect(() => {
    const grew: TeamId[] = (['white', 'black'] as TeamId[]).filter((team) => ({ white, black })[team] > prev.current[team]);
    prev.current = { white, black };
    if (grew.length) setPulses((p) => ({ ...p, ...Object.fromEntries(grew.map((team) => [team, p[team] + 1])) }));
  }, [white, black]);
  return pulses;
}

export function MapSvg({ view, selected = null, onTap, flat = false }: MapSvgProps) {
  const pulses = usePulses(view);
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
          <Tile key={t.id} t={t} pulse={pulses[t.owner]} selected={t.id === selected} onTap={onTap} />
        ))}
        {tiles.map((t) => <Garrison key={`g-${t.id}`} t={t} />)}
        {view.pieces.map((p) => {
          const t = view.territories.find((x) => x.id === p.territoryId);
          const lift = t?.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
          return <Piece key={p.playerId} p={p} lift={lift} />;
        })}
      </svg>
    </div>
  );
}
