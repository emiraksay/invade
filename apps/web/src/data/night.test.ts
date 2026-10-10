import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, startingPositions, summarizeTeamDay, warState, type BattleRecord, type Player, type TeamId } from '@invade/engine';
import { nightReveal } from './night';

const players: Player[] = [
  { id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'w2', name: 'Costi', team: 'white' },
  { id: 'b1', name: 'Emir', team: 'black' }, { id: 'b2', name: 'Hasan', team: 'black' },
];
const day = '2026-10-10';
const settings = { teamNames: { white: 'White', black: 'Black' } as Record<TeamId, string>, timezone: 'Europe/Madrid' };
const teams = { white: summarizeTeamDay('white', players, [], day), black: summarizeTeamDay('black', players, [], day) };

/** A white territory next to a black one, so the fake battle is a legal move on the real map. */
function frontLine(): { from: string; to: string } {
  const war = warState(DEFAULT_MAP, players, {}, [], day);
  for (const t of DEFAULT_MAP.territories) {
    if (war.owner[t.id] !== 'white') continue;
    const enemy = t.neighbors.find((n) => war.owner[n] === 'black');
    if (enemy) return { from: t.id, to: enemy };
  }
  throw new Error('no front line');
}

const battle = (id: number, won: boolean, at: string): BattleRecord => {
  const { from, to } = frontLine();
  return { id, day: at.slice(0, 10), playerId: 'w1', team: 'white', from, to, attackers: 4, defenders: 2, p: 4 / 6, roll: won ? 0.1 : 0.9, won, attackersLeft: won ? 4 : 0, defendersLeft: won ? 0 : 2, at };
};

describe('nightReveal: the day\'s battles become the reveal', () => {
  it('replays only tonight\'s battles, in order, with the share before and after', () => {
    const r = nightReveal({ battles: [battle(2, true, '2026-10-10T18:00:00Z'), battle(1, false, '2026-10-10T12:00:00Z')], players, teams, settings, day });
    expect(r.attacks).toBe(2);
    expect(r.captures).toBe(1);
    expect(r.acts.map((a) => a.id)).toEqual([1, 2]);
    expect(r.acts[0]!.headline).toMatch(/HOLDS$/);
    expect(r.acts[1]!.headline).toMatch(/^WHITE CAPTURES/);
    expect(r.acts[1]!.sub).toContain('Kateryna');
    expect(r.after.white).toBeGreaterThan(r.before.white);
    expect(r.before.white + r.before.black).toBe(100);
  });

  it('leaves yesterday\'s battles in the "before" map', () => {
    const r = nightReveal({ battles: [battle(1, true, '2026-10-09T18:00:00Z')], players, teams, settings, day });
    expect(r.attacks).toBe(0);
    expect(r.before).toEqual(r.after);
    expect(startingPositions).toBeTypeOf('function');
  });
});
