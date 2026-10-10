import { useEffect, useRef, useState } from 'react';
import type { PieceView } from './model';

/** Map units: the garrison badge sits up-left of the territory centre so it never covers a piece. */
export const GARRISON_OFFSET: readonly [number, number] = [-6, -5];

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
 * player's initial, a white soldier badge bottom-right (Figma NumberCircle), the name underneath.
 * My own piece gets a thicker glowing ring. The badge pops when the soldiers go up.
 */
export function PieceToken({ piece }: { piece: PieceView }) {
  const pop = usePop(piece.soldiers);
  return (
    <div className={`piece piece-${piece.team}${piece.isMe ? ' piece-me' : ''}`} aria-label={`${piece.name}, ${piece.soldiers} soldiers${piece.isMe ? ' (you)' : ''}`}>
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
