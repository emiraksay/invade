import { describe, expect, it } from 'vitest';
import { describeEvent, spotlightFor, toBattleEvent, toMilestoneEvent } from './events';

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

const names = { white: 'White', black: 'Black' } as const;
const players = [{ id: 'p1', name: 'Emir', team: 'white' as const }];

describe('spotlightFor', () => {
  it('shouts a milestone: name, soldiers, steps, team', () => {
    const ev = { id: 1, at: '2026-10-10T10:12:00Z', playerId: 'p1', team: 'white' as const, steps: 10050, soldiers: 8, gained: 4 };
    expect(spotlightFor(ev, players, names)).toEqual({ id: 1, team: 'white', headline: 'EMIR +4 SOLDIERS', sub: '10.050 steps today · White' });
    expect(spotlightFor({ ...ev, playerId: 'ghost' }, players, names).headline).toBe('SOMEONE +4 SOLDIERS');
  });
  it('shouts a battle, won or held', () => {
    const won = { id: 2, at: '2026-10-10T20:00:00Z', team: 'white' as const, territory: 'Gràcia', captured: true, odds: 0.6, attackerId: 'p1' };
    expect(spotlightFor(won, players, names)).toEqual({ id: 2, team: 'white', headline: 'WHITE CAPTURES GRÀCIA', sub: 'Emir led the attack · 60% odds' });
    expect(spotlightFor({ ...won, captured: false }, players, names).headline).toBe('GRÀCIA HOLDS');
  });
});

describe('toBattleEvent', () => {
  it('parses the expected shape and tolerates aliases, rejects other types', () => {
    const row = { id: 9, type: 'battle', created_at: '2026-10-10T20:00:00Z', payload: { team: 'black', territoryName: 'Born', won: true, odds: 0.75, playerId: 'p2' } };
    expect(toBattleEvent(row)).toEqual({ id: 9, at: row.created_at, team: 'black', territory: 'Born', captured: true, odds: 0.75, attackerId: 'p2' });
    expect(toBattleEvent({ ...row, type: 'milestone' })).toBeNull();
    expect(toBattleEvent({ ...row, payload: { team: 'black' } })).toBeNull();
  });
});
