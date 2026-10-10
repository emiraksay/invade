import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PieceView } from './model';

/**
 * Each player's ring colour. The first three are the cousin's Sctech Place frame (red, blue, green
 * rings around the avatars); the rest continue in the same pure, saturated style.
 * Display only: handed out in the order of view.pieces, so up to 8 players never share a colour.
 */
export const PLAYER_COLORS = ['#ff2424', '#0004ff', '#00ff44', '#ffe500', '#ff00e5', '#00e5ff', '#ff8a00', '#8a00ff'] as const;

export function playerColors(pieces: readonly PieceView[]): Map<string, string> {
  return new Map(pieces.map((p, i) => [p.playerId, PLAYER_COLORS[i % PLAYER_COLORS.length]!]));
}

/** Map units: the garrison badge moves up-left of the territory centre when a piece (or the HQ crown) is there. */
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
export function PieceToken({ piece, color }: { piece: PieceView; color: string }) {
  const pop = usePop(piece.soldiers);
  return (
    <div className={`piece piece-${piece.team}${piece.isMe ? ' piece-me' : ''}`} style={{ '--ring': color } as CSSProperties} aria-label={`${piece.name}, ${piece.soldiers} soldiers${piece.isMe ? ' (you)' : ''}`}>
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
