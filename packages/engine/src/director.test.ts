import { describe, expect, it } from 'vitest';
import {
  applyDecree,
  duelPairs,
  eligibleDecrees,
  fallbackDecree,
  isDecided,
  validateDecree,
  type Decree,
  type DirectorState,
} from './director';

const players = [
  { id: 'varya', name: 'Varya', team: 'white' as const, recentSteps: [8_000, 9_000] },
  { id: 'kat', name: 'Kateryna', team: 'white' as const, recentSteps: [3_000, 2_000] },
  { id: 'emir', name: 'Emir', team: 'black' as const, recentSteps: [9_000, 8_500] },
  { id: 'hasan', name: 'Hasan', team: 'black' as const, recentSteps: [15_000, 16_000] },
];

function state(over: Partial<DirectorState> = {}): DirectorState {
  return {
    day: 3,
    daysInWeek: 7,
    points: { white: 1, black: 1 },
    pointsLeft: 7,
    zoneToday: { id: 'z3', name: 'Harbour', points: 1 },
    held: { white: [{ id: 'z1', name: 'Gràcia' }], black: [{ id: 'z2', name: 'Born' }] },
    players,
    history: [],
    ...over,
  };
}
const kinds = (s: DirectorState) => new Set(eligibleDecrees(s).map((o) => o.decree.kind));

describe('isDecided', () => {
  it('is decided only when the trailing team cannot catch up with every point left', () => {
    expect(isDecided({ points: { white: 4, black: 0 }, pointsLeft: 3 })).toBe(true);
    expect(isDecided({ points: { white: 4, black: 1 }, pointsLeft: 3 })).toBe(false); // 4-4 still possible
    expect(isDecided({ points: { white: 2, black: 2 }, pointsLeft: 0 })).toBe(false);
  });
});

describe('duelPairs', () => {
  it('pairs players of similar level across teams, closest first, nobody twice', () => {
    const pairs = duelPairs({ players });
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([['varya', 'emir']]);
  });
  it('skips players with no steps yet', () => {
    expect(duelPairs({ players: players.map((p) => ({ ...p, recentSteps: [] })) })).toEqual([]);
  });
});

describe('eligibleDecrees', () => {
  it('always allows a quiet day, and offers the fun decrees on an even week', () => {
    const k = kinds(state());
    expect(k).toEqual(new Set(['quiet', 'night_march', 'duel', 'all_hands', 'double_stakes']));
  });
  it('never repeats yesterday\'s kind', () => {
    expect(kinds(state({ history: [{ day: 2, decree: { kind: 'night_march', fromHour: 20 } }] })).has('night_march')).toBe(false);
  });
  it('offers reinforcements only to the trailing team, 2+ points behind, not on the final', () => {
    const behind = eligibleDecrees(state({ points: { white: 0, black: 2 } })).filter((o) => o.decree.kind === 'reinforcements');
    expect(behind.map((o) => o.decree)).toEqual([{ kind: 'reinforcements', team: 'white', percent: 50 }]);
    expect(kinds(state({ points: { white: 1, black: 2 } })).has('reinforcements')).toBe(false);
    expect(kinds(state({ day: 7, points: { white: 0, black: 2 }, pointsLeft: 3 })).has('reinforcements')).toBe(false);
  });
  it('offers a rebellion only when the week would otherwise be decided, on a zone the leader holds', () => {
    const open = state({ points: { white: 1, black: 3 }, pointsLeft: 5 });
    expect(kinds(open).has('rebellion')).toBe(false);
    const decided = state({ day: 5, points: { white: 0, black: 4 }, pointsLeft: 3, held: { white: [], black: [{ id: 'z2', name: 'Born' }, { id: 'z4', name: 'Sants' }] } });
    const rebellions = eligibleDecrees(decided).filter((o) => o.decree.kind === 'rebellion').map((o) => o.decree);
    expect(rebellions).toEqual([{ kind: 'rebellion', zoneId: 'z2' }, { kind: 'rebellion', zoneId: 'z4' }]);
    expect(kinds(decided).has('double_stakes')).toBe(false); // no point raising stakes on a decided week
  });
  it('caps comebacks at two per week', () => {
    const history = [
      { day: 3, decree: { kind: 'reinforcements', team: 'white', percent: 50 } as Decree },
      { day: 4, decree: { kind: 'reinforcements', team: 'white', percent: 50 } as Decree },
    ];
    const s = state({ day: 6, points: { white: 0, black: 5 }, pointsLeft: 2, history });
    expect(kinds(s).has('rebellion')).toBe(false);
    expect(kinds(s).has('reinforcements')).toBe(false);
  });
});

describe('validateDecree', () => {
  const options = eligibleDecrees(state());
  it('accepts an exact allowed option, whatever the key order', () => {
    expect(validateDecree({ fromHour: 20, kind: 'night_march' }, options)).toEqual({ kind: 'night_march', fromHour: 20 });
  });
  it('rejects invented numbers, unknown kinds and extra fields', () => {
    expect(validateDecree({ kind: 'night_march', fromHour: 18 }, options)).toBeNull();
    expect(validateDecree({ kind: 'duel', a: 'varya', b: 'emir', prize: 40 }, options)).toBeNull();
    expect(validateDecree({ kind: 'reinforcements', team: 'white', percent: 50 }, options)).toBeNull();
    expect(validateDecree({ kind: 'quiet', bonus: 3 }, options)).toBeNull();
    expect(validateDecree('quiet', options)).toBeNull();
  });
});

describe('fallbackDecree', () => {
  it('prefers a comeback, then higher stakes, then a duel', () => {
    expect(fallbackDecree(eligibleDecrees(state({ points: { white: 0, black: 2 } })), 3).kind).toBe('reinforcements');
    expect(fallbackDecree(eligibleDecrees(state()), 3).kind).toBe('double_stakes');
    expect(fallbackDecree(eligibleDecrees(state({ day: 2 })), 2).kind).toBe('duel');
  });
  it('is a quiet day when nothing else is allowed', () => {
    expect(fallbackDecree([{ decree: { kind: 'quiet' }, why: '' }], 1)).toEqual({ kind: 'quiet' });
  });
});

describe('applyDecree', () => {
  const facts = {
    players,
    steps: { varya: 10_500, kat: 4_500, emir: 9_800, hasan: 12_000 },
    stepsAfterHour: { varya: 0, kat: 600, emir: 300, hasan: 0 },
  };
  // Milestones: 5k=4, 10k=8, 12k=10. White: 8 + 0 = 8. Black: 4 + 10 = 14.
  it('quiet day: plain milestones', () => {
    expect(applyDecree({ kind: 'quiet' }, facts, 1)).toMatchObject({ soldiers: { white: 8, black: 14 }, points: 1, extraZoneId: null });
  });
  it('night march: late steps count twice and can cross a milestone', () => {
    // Kateryna 4,500 + 600 late = 5,100 → 4. Emir 9,800 + 300 = 10,100 → 8.
    expect(applyDecree({ kind: 'night_march', fromHour: 20 }, facts, 1).soldiers).toEqual({ white: 12, black: 18 });
  });
  it('duel: the one who walked more wins the prize for their team', () => {
    expect(applyDecree({ kind: 'duel', a: 'varya', b: 'emir', prize: 4 }, facts, 1).soldiers).toEqual({ white: 12, black: 14 });
  });
  it('all hands: only a team where everyone hit the bar', () => {
    expect(applyDecree({ kind: 'all_hands', minSteps: 4_000, prize: 4 }, facts, 1).soldiers).toEqual({ white: 12, black: 18 });
    expect(applyDecree({ kind: 'all_hands', minSteps: 6_000, prize: 4 }, facts, 1).soldiers).toEqual({ white: 8, black: 18 });
  });
  it('double stakes, reinforcements and rebellion change points, soldiers and the extra zone', () => {
    expect(applyDecree({ kind: 'double_stakes', points: 2 }, facts, 1).points).toBe(2);
    expect(applyDecree({ kind: 'reinforcements', team: 'white', percent: 50 }, facts, 1).soldiers).toEqual({ white: 12, black: 14 });
    expect(applyDecree({ kind: 'rebellion', zoneId: 'z2' }, facts, 1).extraZoneId).toBe('z2');
  });
});
