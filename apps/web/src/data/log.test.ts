import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, type BattleRecord, type Player } from '@invade/engine';

const target = DEFAULT_MAP.territories[0]!;
import { logLines } from './log';
import type { MilestoneEvent } from './events';

const players: Player[] = [{ id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'b1', name: 'Emir', team: 'black' }];
const ev: MilestoneEvent = { id: 1, playerId: 'w1', steps: 10_000, soldiers: 8, gained: 4, at: '2026-10-10T09:12:00Z' } as MilestoneEvent;
const battle: BattleRecord = { id: 7, day: '2026-10-10', playerId: 'b1', team: 'black', from: 't1', to: target.id, attackers: 4, defenders: 2, p: 0.67, roll: 0.9, won: false, attackersLeft: 0, defendersLeft: 2, at: '2026-10-10T11:30:00Z' };

describe('logLines: syncs and battles in one list', () => {
  it('merges both kinds newest first with the Figma row fields', () => {
    const lines = logLines([ev], [battle], players, 'Europe/Madrid', '2026-10-10');
    expect(lines.map((l) => l.kind)).toEqual(['battle', 'sync']);
    const b = lines[0]!;
    if (b.kind !== 'battle') throw new Error('expected battle');
    expect(b).toMatchObject({ name: 'Emir', team: 'black', attackers: 4, defenders: 2, won: false, time: '13:30' });
    expect(b.territory).toBe(target.name); // resolved to the map's name
    const s = lines[1]!;
    if (s.kind !== 'sync') throw new Error('expected sync');
    expect(s).toMatchObject({ name: 'Kateryna', gained: '+4', time: '11:12' });
  });

  it('leaves yesterday\'s battles out of today\'s log', () => {
    expect(logLines([], [{ ...battle, day: '2026-10-09' }], players, 'Europe/Madrid', '2026-10-10')).toEqual([]);
  });
});
