import { useEffect, useRef, useState } from 'react';
import type { Point, TeamId } from '@invade/engine';
import type { MapView, PieceView, TerritoryView } from './model';
import { ATTACK_RED, attackMark, garrisonAt, piecePositions, playerColors, useFlip, usePop, type AttackMark } from './pieces';
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

function Tile({ t, pulse, selected, onTap, mark }: { t: TerritoryView; pulse: number; selected: boolean; onTap?: (t: TerritoryView) => void; mark?: AttackMark }) {
  const p = PALETTE[t.owner];
  const flip = useFlip(t.owner);
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
      style={{ cursor: interactive ? 'pointer' : undefined, opacity: mark === 'dim' ? 0.4 : 1, transition: 'opacity 300ms ease' }}
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
        stroke={mark === 'target' ? ATTACK_RED : selected ? '#7fb6ff' : '#fff'}
        strokeWidth={mark === 'target' ? 1.6 : selected ? 1.2 : 0.7}
        strokeOpacity={mark === 'target' || selected ? 1 : 0.45 + 0.55 * t.charge}
        className={mark === 'target' ? 'tile-target' : undefined}
        strokeLinejoin="round"
        style={{ transition: 'fill 600ms ease, stroke-opacity 600ms ease' }}
      />
      {/* Soldiers arrived: a white flash that marches outward from the HQ. Remounted on each pulse to replay. */}
      {pulse > 0 && (
        <path key={pulse} d={path(poly)} fill="#fff" className="tile-pulse" style={{ animationDelay: `${t.depth * RIPPLE_STEP_MS}ms` }} pointerEvents="none" />
      )}
      {/* Conquered: a bright flash, remounted on each change of owner to replay. */}
      {flip > 0 && <path key={`f${flip}`} d={path(poly)} fill="#fff" className="tile-flip" pointerEvents="none" />}
      {/* Figma: the HQ shows just the crown; soldier counts live in the stats bar and team lists. */}
      {t.isHq && <Crown x={cx} y={cy} fill={CROWN_FILL[t.owner]} />}
    </g>
  );
}

/** Garrison number on a territory (Figma map numbers): small white circle, black number. */
function Garrison({ t, occupied }: { t: TerritoryView; occupied: boolean }) {
  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  const [x, gy] = garrisonAt(t.center, occupied);
  const y = gy - lift;
  return (
    <g pointerEvents="none" aria-hidden>
      <circle cx={x} cy={y} r={2.4} fill="#fff" stroke="#000" strokeWidth={0.3} />
      <text x={x} y={y} fontSize={2.8} fontWeight={700} fill="#000" textAnchor="middle" dominantBaseline="central">{t.soldiers}</text>
    </g>
  );
}

/** A player piece: disc in team colour with the initial and a ring in the player's colour, soldier badge bottom-right, name below. */
function Piece({ p, at, lift, color, onTap }: { p: PieceView; at: Point; lift: number; color: string; onTap?: (p: PieceView) => void }) {
  const pop = usePop(p.soldiers);
  const [x, y] = [at[0], at[1] - lift];
  const light = p.team === 'white';
  return (
    <g
      transform={`translate(${x} ${y})`}
      pointerEvents={onTap ? undefined : 'none'}
      onClick={onTap ? () => onTap(p) : undefined}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(p); } } : undefined}
      tabIndex={onTap ? 0 : undefined}
      role={onTap ? 'button' : undefined}
      style={{ cursor: onTap ? 'pointer' : undefined }}
      aria-label={`${p.name}, ${p.soldiers} soldiers${p.isMe ? ' (you)' : ''}`}>
      {p.isMe && <circle r={7.6} fill="none" stroke={color} strokeWidth={2.4} strokeOpacity={0.4} />}
      {p.isMe && <circle r={6.7} fill="none" stroke="#fff" strokeWidth={0.6} />}
      <circle r={5.6} fill={light ? '#f4f4f4' : '#1d1a18'} stroke={color} strokeWidth={p.isMe ? 1.4 : 1} />
      <text fontSize={5.2} fontWeight={700} fill={light ? '#111' : '#f2f2f2'} textAnchor="middle" dominantBaseline="central">{p.name.trim().charAt(0).toUpperCase() || '?'}</text>
      <g key={pop} className={pop ? 'piece-pop' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx={4.4} cy={4.2} r={2.6} fill="#fff" stroke="#000" strokeWidth={0.3} />
        <text x={4.4} y={4.2} fontSize={3} fontWeight={700} fill="#000" textAnchor="middle" dominantBaseline="central">{p.soldiers}</text>
      </g>
      <text y={10} fontSize={3} fill="#fff" textAnchor="middle" style={{ paintOrder: 'stroke' }} stroke="#000" strokeWidth={0.6}>{p.isMe ? 'You' : p.name}</text>
    </g>
  );
}

export interface MapSvgProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** Flat top-down view (no tilt), e.g. for small previews. */
  flat?: boolean;
  /** Territories I can attack right now (highlighted; the rest dims). Null when not choosing. */
  targets?: ReadonlySet<string> | null;
  /** Tap on my own piece (starts choosing an attack). */
  onPieceTap?: (p: PieceView) => void;
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

export function MapSvg({ view, selected = null, onTap, flat = false, targets = null, onPieceTap }: MapSvgProps) {
  const pulses = usePulses(view);
  const pad = 4;
  const extra = DEPTH + HQ_LIFT_MAX;
  // Paint back to front so a tile's side is covered by the tile in front of it.
  const tiles = [...view.territories].sort((a, b) => a.center[1] - b.center[1]);
  const colors = playerColors(view.pieces);
  const occupied = new Set(view.pieces.map((p) => p.territoryId));
  const spots = piecePositions(view);
  const myTerritory = view.pieces.find((p) => p.isMe)?.territoryId;
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
          <Tile key={t.id} t={t} pulse={pulses[t.owner]} selected={t.id === selected} onTap={onTap} mark={attackMark(t.id, targets, myTerritory)} />
        ))}
        {/* Figma: the HQ shows only its crown, no number next to it. */}
        {tiles.filter((t) => !t.isHq).map((t) => <Garrison key={`g-${t.id}`} t={t} occupied={occupied.has(t.id)} />)}
        {view.pieces.map((p) => {
          const t = view.territories.find((x) => x.id === p.territoryId);
          const lift = t?.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
          return <Piece key={p.playerId} p={p} at={spots.get(p.playerId)!} lift={lift} color={colors.get(p.playerId)!} onTap={p.isMe ? onPieceTap : undefined} />;
        })}
      </svg>
    </div>
  );
}
