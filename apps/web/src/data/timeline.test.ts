import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, MILESTONES, type BattleRecord, type Player } from '@invade/engine';
import type { MilestoneEvent } from './events';
import { stateAt, timeline } from './timeline';

const day = '2026-10-10';
const players: Player[] = [{ id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'w2', name: 'Costi', team: 'white' }, { id: 'b1', name: 'Emir', team: 'black' }];
const first = MILESTONES[0]!;
const ev = (id: number, playerId: string, team: 'white' | 'black', at: string, steps = first.steps): MilestoneEvent =>
  ({ id, at, playerId, team, steps, soldiers: first.soldiers, gained: first.soldiers });
const t = DEFAULT_MAP.territories;
const battle = (id: number, at: string, d = day): BattleRecord =>
  ({ id, day: d, playerId: 'w1', team: 'white', from: t[0]!.id, to: t[1]!.id, attackers: 4, defenders: 2, p: 0.67, roll: 0.2, won: true, attackersLeft: 4, defendersLeft: 0, at });

const events = [ev(2, 'b1', 'black', `${day}T12:00:00Z`), ev(1, 'w1', 'white', `${day}T09:00:00Z`)];
const battles = [battle(5, `${day}T13:00:00Z`), battle(4, `2026-10-09T20:00:00Z`, '2026-10-09')];

describe('timeline', () => {
  it('orders today\'s syncs and battles oldest first and leaves yesterday out', () => {
    expect(timeline(events, battles, day).map((m) => `${m.kind}${m.id}`)).toEqual(['sync1', 'sync2', 'battle5']);
  });
});

describe('stateAt', () => {
  it('rebuilds the teams through the engine from the syncs up to that moment', () => {
    const noon = stateAt(events, battles, players, day, `${day}T12:00:00Z`);
    expect(noon.events.map((e) => e.id).sort()).toEqual([1, 2]);
    expect(noon.battles.map((b) => b.id)).toEqual([4]); // yesterday's battle stays, today's 13:00 one not yet
    expect(noon.teams.white.members.find((m) => m.player.id === 'w1')?.soldiers).toBe(first.soldiers);
    expect(noon.teams.white.members.find((m) => m.player.id === 'w2')?.soldiers).toBe(0);
    expect(noon.teams.black.memberSoldiers).toBe(first.soldiers);
  });

  it('at the start of the day nothing has happened yet', () => {
    const dawn = stateAt(events, battles, players, day, `${day}T00:00:00Z`);
    expect(dawn.events).toEqual([]);
    expect(dawn.teams.white.soldiers).toBe(0);
  });
});
