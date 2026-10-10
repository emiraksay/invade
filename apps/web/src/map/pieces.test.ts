import { describe, expect, it } from 'vitest';
import type { PieceView } from './model';
import { PLAYER_COLORS, playerColors } from './pieces';

const piece = (playerId: string): PieceView => ({ playerId, name: playerId, team: 'white', territoryId: 't', position: [0, 0], soldiers: 0, steps: 0, isMe: false });

describe('playerColors', () => {
  it('gives every player (up to 8) their own colour, in piece order', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const colors = playerColors(ids.map(piece));
    expect(ids.map((id) => colors.get(id))).toEqual([...PLAYER_COLORS]);
    expect(new Set(colors.values()).size).toBe(8);
  });
});
