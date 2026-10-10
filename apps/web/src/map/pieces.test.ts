import { describe, expect, it } from 'vitest';
import type { PieceView } from './model';
import { PLAYER_COLORS, piecePositions, playerColors } from './pieces';

const piece = (playerId: string): PieceView => ({ playerId, name: playerId, team: 'white', territoryId: 't', position: [0, 0], soldiers: 0, steps: 0, isMe: false });

describe('playerColors', () => {
  it('gives every player (up to 8) their own colour, in piece order', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const colors = playerColors(ids.map(piece));
    expect(ids.map((id) => colors.get(id))).toEqual([...PLAYER_COLORS]);
    expect(new Set(colors.values()).size).toBe(8);
  });
});

describe('piecePositions', () => {
  it('puts a lone piece on the centre and spreads players sharing a territory into a row', () => {
    const territories = [{ id: 'a', center: [50, 50] as [number, number] }, { id: 'b', center: [10, 10] as [number, number] }];
    const pieces = [{ ...piece('p1'), territoryId: 'a' }, { ...piece('p2'), territoryId: 'a' }, { ...piece('p3'), territoryId: 'b' }];
    const at = piecePositions({ territories, pieces } as never);
    expect(at.get('p3')).toEqual([10, 10]);
    const [x1, y1] = at.get('p1')!, [x2, y2] = at.get('p2')!;
    expect(y1).toBe(50); expect(y2).toBe(50);
    expect(x2 - x1).toBeGreaterThanOrEqual(8);
    expect((x1 + x2) / 2).toBe(50);
  });
});
