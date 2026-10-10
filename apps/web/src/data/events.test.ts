import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from '@invade/engine';
import { battleShout, describeEvent, spotlightFor, toMilestoneEvent } from './events';

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
    const won = { id: 2, at: '2026-10-10T20:00:00Z', team: 'white' as const, territory: 'Gràcia', won: true, p: 0.6, playerId: 'p1' };
    expect(spotlightFor(won, players, names)).toEqual({ id: 2, team: 'white', headline: 'WHITE CAPTURES GRÀCIA', sub: 'Emir led the attack · 60% odds' });
    expect(spotlightFor({ ...won, won: false }, players, names).headline).toBe('GRÀCIA HOLDS');
  });
});

describe('battleShout', () => {
  it('resolves the territory name from the map and keeps the numbers', () => {
    const t = DEFAULT_MAP.territories[0]!;
    const record = { id: 9, playerId: 'p2', team: 'black' as const, from: 't02', to: t.id, attackers: 4, defenders: 2, p: 0.67, roll: 0.1, won: true, attackersLeft: 3, defendersLeft: 0, day: '2026-10-10', at: '2026-10-10T20:00:00Z' };
    expect(battleShout(record, DEFAULT_MAP)).toEqual({ id: 9, at: record.at, team: 'black', territory: t.name, won: true, p: 0.67, playerId: 'p2' });
    expect(battleShout({ ...record, to: 'nope' }, DEFAULT_MAP).territory).toBe('nope');
  });
});
