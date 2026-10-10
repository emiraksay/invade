import { describe, expect, it } from 'vitest';
import { describeEvent, toMilestoneEvent } from './events';

describe('toMilestoneEvent', () => {
  it('maps a milestone row and ignores other types or bad payloads', () => {
    const row = { id: 7, type: 'milestone', created_at: '2026-10-10T10:12:00Z', payload: { playerId: 'p1', team: 'white', day: '2026-10-10', steps: 10050, soldiers: 8, gained: 4 } };
    expect(toMilestoneEvent(row)).toEqual({ id: 7, at: '2026-10-10T10:12:00Z', playerId: 'p1', team: 'white', steps: 10050, soldiers: 8, gained: 4 });
    expect(toMilestoneEvent({ ...row, type: 'other' })).toBeNull();
    expect(toMilestoneEvent({ ...row, payload: { team: 'white' } })).toBeNull();
    expect(toMilestoneEvent({ ...row, payload: { playerId: 'p1', team: 'red' } })).toBeNull();
  });
});

describe('describeEvent', () => {
  it('formats time in the game timezone, name, steps and gain', () => {
    const ev = { id: 1, at: '2026-10-10T10:12:00Z', playerId: 'p1', team: 'white' as const, steps: 10050, soldiers: 8, gained: 4 };
    expect(describeEvent(ev, [{ id: 'p1', name: 'Emir', team: 'white' }], 'Europe/Madrid')).toEqual({ time: '12:12', name: 'Emir', steps: '10.050', gained: '+4' });
    expect(describeEvent(ev, [], 'Europe/Madrid').name).toBe('Someone');
  });
});
