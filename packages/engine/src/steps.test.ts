import { describe, expect, it } from 'vitest';
import {
  mergeSteps,
  nextMilestone,
  soldiersGained,
  stepsToSoldiers,
  summarizeTeamDay,
  teamBonus,
} from './steps';
import type { Player, StepReport } from './types';

describe('stepsToSoldiers', () => {
  it.each([
    [0, 0],
    [4_999, 0],
    [5_000, 4],
    [9_999, 4],
    [10_000, 8],
    [11_999, 8],
    [12_000, 10],
    [40_000, 10], // daily cap
  ])('%i steps -> %i soldiers', (steps, soldiers) => {
    expect(stepsToSoldiers(steps)).toBe(soldiers);
  });
});

describe('nextMilestone', () => {
  it('points at the next milestone with steps to go and gain', () => {
    expect(nextMilestone(3_800)).toEqual({ milestone: { steps: 5_000, soldiers: 4 }, stepsToGo: 1_200, gain: 4 });
    expect(nextMilestone(10_500)).toEqual({ milestone: { steps: 12_000, soldiers: 10 }, stepsToGo: 1_500, gain: 2 });
  });
  it('is null once the cap is reached', () => {
    expect(nextMilestone(12_000)).toBeNull();
  });
});

// The cousin's balancing table (Figma MVP page, "Balancing" frame), for a team of two.
describe('team of two matches the balancing table', () => {
  const pair = (a: number, b: number) => stepsToSoldiers(a) + stepsToSoldiers(b) + teamBonus([a, b]);
  it.each([
    [12_000, 12_000, 22],
    [12_000, 10_000, 20],
    [12_000, 5_000, 15],
    [12_000, 0, 10],
    [10_000, 10_000, 18],
    [10_000, 5_000, 13],
    [10_000, 0, 8],
    [5_000, 5_000, 9],
    [5_000, 0, 4],
    [0, 0, 0],
  ])('%i + %i -> %i soldiers', (a, b, total) => {
    expect(pair(a, b)).toBe(total);
  });
});

describe('teamBonus', () => {
  it('scales with team size: +2 / +4 for four players', () => {
    expect(teamBonus([5_000, 6_000, 7_000, 9_000])).toBe(2);
    expect(teamBonus([10_000, 12_000, 10_500, 11_000])).toBe(4);
  });
  it('is zero when anyone is below 5k, or for an empty team', () => {
    expect(teamBonus([12_000, 12_000, 12_000, 4_999])).toBe(0);
    expect(teamBonus([])).toBe(0);
  });
  it('gives a solo player +1 / +2', () => {
    expect(teamBonus([5_000])).toBe(1);
    expect(teamBonus([10_000])).toBe(2);
  });
});

describe('idempotent step reports', () => {
  it('keeps the higher cumulative value, so resends and stale reports never change the total', () => {
    expect(mergeSteps(6_412, 6_412)).toBe(6_412);
    expect(mergeSteps(6_412, 5_000)).toBe(6_412);
    expect(mergeSteps(null, 3_000)).toBe(3_000);
  });
  it('reports soldiers gained only when a milestone is crossed', () => {
    expect(soldiersGained(4_900, 5_100)).toBe(4);
    expect(soldiersGained(5_100, 9_000)).toBe(0);
    expect(soldiersGained(9_000, 5_000)).toBe(0);
  });
});

describe('summarizeTeamDay', () => {
  const players: Player[] = [
    { id: 'a', name: 'Emir', team: 'white' },
    { id: 'b', name: 'Selin', team: 'white' },
    { id: 'c', name: 'Ömer', team: 'black' },
  ];
  const report = (playerId: string, day: string, steps: number): StepReport => ({
    playerId, day, steps, source: 'apple_health', reportedAt: '2026-10-10T10:00:00Z',
  });

  it('derives members, bonus and totals from reports of that day only', () => {
    const reports = [
      report('a', '2026-10-10', 10_200),
      report('a', '2026-10-10', 9_000), // stale resend, ignored
      report('b', '2026-10-10', 5_300),
      report('b', '2026-10-09', 20_000), // yesterday, ignored
      report('c', '2026-10-10', 12_000), // other team
    ];
    const white = summarizeTeamDay('white', players, reports, '2026-10-10');
    expect(white.members.map((m) => [m.player.id, m.steps, m.soldiers])).toEqual([
      ['a', 10_200, 8],
      ['b', 5_300, 4],
    ]);
    expect(white.bonus).toBe(1);
    expect(white.soldiers).toBe(13);
    expect(white.steps).toBe(15_500);
    expect(white.maxSoldiers).toBe(22);
  });

  it('treats players without reports as 0 steps', () => {
    const black = summarizeTeamDay('black', players, [], '2026-10-10');
    expect(black.members[0]?.steps).toBe(0);
    expect(black.soldiers).toBe(0);
  });
});
