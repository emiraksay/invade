import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Point } from '@invade/engine';
import type { MapView, PieceView } from './model';

/**
 * Each player's ring colour. The first three are the cousin's Sctech Place frame (red, blue, green
 * rings around the avatars); the rest continue in the same pure, saturated style.
 * Display only: handed out in the order of view.pieces, so up to 8 players never share a colour.
 */
export const PLAYER_COLORS = ['#ff2424', '#0004ff', '#00ff44', '#ffe500', '#ff00e5', '#00e5ff', '#ff8a00', '#8a00ff'] as const;

export function playerColors(pieces: readonly PieceView[]): Map<string, string> {
  return new Map(pieces.map((p, i) => [p.playerId, PLAYER_COLORS[i % PLAYER_COLORS.length]!]));
}

/** Map units between the centres of pieces sharing a territory (a disc is ~8 units wide with its name). */
const PIECE_SPACING = 10;

/**
 * Where to draw each piece: alone on a territory it stands at the centre; players sharing one stand
 * side by side in a row (the camera looks across the map, so a row never hides anyone or merges names).
 */
export function piecePositions(view: Pick<MapView, 'pieces' | 'territories'>): Map<string, Point> {
  const centers = new Map(view.territories.map((t) => [t.id, t.center]));
  const groups = new Map<string, PieceView[]>();
  for (const p of view.pieces) groups.set(p.territoryId, [...(groups.get(p.territoryId) ?? []), p]);
  const out = new Map<string, Point>();
  for (const [id, group] of groups) {
    const [cx, cy] = centers.get(id) ?? group[0]!.position;
    group.forEach((p, i) => out.set(p.playerId, [cx + (i - (group.length - 1) / 2) * PIECE_SPACING, cy]));
  }
  return out;
}

/** Map units: the garrison badge moves up-left of the territory centre when a piece is there. */
export const GARRISON_OFFSET: readonly [number, number] = [-8, -6];

/** Where to draw a territory's garrison number: its centre, or off to the side if something else is drawn there. */
export function garrisonAt(center: readonly [number, number], occupied: boolean): [number, number] {
  return occupied ? [center[0] + GARRISON_OFFSET[0], center[1] + GARRISON_OFFSET[1]] : [center[0], center[1]];
}

/** Counts up each time `value` rises, so a badge can replay its pop (stays 0 until the first rise). */
export function usePop(value: number): number {
  const [pop, setPop] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current) setPop((p) => p + 1);
    prev.current = value;
  }, [value]);
  return pop;
}

/**
 * A player on the map (cousin's Sctech Place/Attack frames): a disc in the team colour with the
 * player's initial and a ring in the player's own colour, a white soldier badge bottom-right (Figma NumberCircle), the name underneath.
 * My own piece gets a thicker ring glowing in that colour. The badge pops when the soldiers go up.
 */
export function PieceToken({ piece, color, onTap }: { piece: PieceView; color: string; onTap?: (p: PieceView) => void }) {
  const pop = usePop(piece.soldiers);
  const tap = onTap ? { role: 'button', tabIndex: 0, onClick: () => onTap(piece), onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(piece); } } } : {};
  return (
    <div {...tap} className={`piece piece-${piece.team}${piece.isMe ? ' piece-me' : ''}${onTap ? ' piece-tappable' : ''}`} style={{ '--ring': color } as CSSProperties} aria-label={`${piece.name}, ${piece.soldiers} soldiers${piece.isMe ? ' (you)' : ''}`}>
      <div className="piece-disc">
        {piece.name.trim().charAt(0).toUpperCase() || '?'}
        <span key={pop} className={`piece-badge${pop ? ' piece-pop' : ''}`}>{piece.soldiers}</span>
      </div>
      <span className="piece-name">{piece.isMe ? 'You' : piece.name}</span>
    </div>
  );
}

/** Soldiers garrisoned on a territory (Figma map numbers): a small white circle with a black number. */
export function GarrisonBadge({ soldiers }: { soldiers: number }) {
  return <span className="garrison" aria-label={`${soldiers} soldiers garrisoned`}>{soldiers}</span>;
}

/**
 * How a territory looks while I'm choosing what to attack: the ones I can attack light up red,
 * the rest dim (except where my piece stands). Undefined when I'm not choosing.
 */
export type AttackMark = 'target' | 'dim' | undefined;
export const ATTACK_RED = '#ff2424';

export function attackMark(territoryId: string, targets: ReadonlySet<string> | null | undefined, myTerritory: string | undefined): AttackMark {
  if (!targets) return undefined;
  if (targets.has(territoryId)) return 'target';
  return territoryId === myTerritory ? undefined : 'dim';
}

/** Counts up each time a territory changes hands, so it can replay its flip flash. */
export function useFlip(owner: string): number {
  const [flip, setFlip] = useState(0);
  const prev = useRef(owner);
  useEffect(() => {
    if (owner !== prev.current) setFlip((f) => f + 1);
    prev.current = owner;
  }, [owner]);
  return flip;
}
