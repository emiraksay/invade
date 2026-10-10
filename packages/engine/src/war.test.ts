import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from './map';
import { startingPositions } from './pieces';
import { attackOdds, attackOptions, resolveBattle, territoryShare, warState, type BattleRecord } from './war';
import type { Player } from './types';

const players: Player[] = [
  { id: 'emir', name: 'Emir', team: 'white' },
  { id: 'kat', name: 'Kateryna', team: 'black' },
];
const TODAY = '2026-10-10';
const battle = (over: Partial<BattleRecord>): BattleRecord => ({
  id: 1, playerId: 'emir', team: 'white', from: '', to: '', attackers: 4, defenders: 2, p: 2 / 3,
  roll: 0.1, won: true, attackersLeft: 3, defendersLeft: 0, day: TODAY, at: '2026-10-10T12:00:00Z', ...over,
});

describe('odds and resolution (decision 4)', () => {
  it('computes attackers / (attackers + defenders)', () => {
    expect(attackOdds(8, 2)).toBe(0.8);
    expect(attackOdds(0, 2)).toBe(0);
  });
  it('wins when the roll is below p, with the decision-4 survivors', () => {
    expect(resolveBattle(8, 2, 0.79)).toEqual({ p: 0.8, won: true, attackersLeft: 7, defendersLeft: 0 });
    expect(resolveBattle(8, 2, 0.8)).toEqual({ p: 0.8, won: false, attackersLeft: 0, defendersLeft: 1 });
    expect(resolveBattle(2, 6, 0.9)).toMatchObject({ won: false, defendersLeft: 5 });
  });
});

describe('warState', () => {
  it('starts from the halves, garrisons of 2, pieces with today\'s soldiers', () => {
    const war = warState(DEFAULT_MAP, players, { emir: 8, kat: 4 }, [], TODAY);
    expect(territoryShare(war, 'white')).toBeCloseTo(0.5, 1); // half the land, by area
    expect(Object.values(war.garrison).every((g) => g === 2)).toBe(true);
    expect(war.pieces.emir!.available).toBe(8);
  });

  it('flips a won territory, moves the piece in and spends today\'s soldiers', () => {
    const start = warState(DEFAULT_MAP, players, { emir: 8 }, [], TODAY);
    const target = attackOptions(start, DEFAULT_MAP, 'emir')[0]!;
    const war = warState(DEFAULT_MAP, players, { emir: 8 },
      [battle({ from: start.pieces.emir!.territoryId, to: target.to, attackers: 5, attackersLeft: 4 })], TODAY);
    expect(war.owner[target.to]).toBe('white');
    expect(war.garrison[target.to]).toBe(4);
    expect(war.pieces.emir).toEqual({ territoryId: target.to, available: 3 });
    expect(territoryShare(war, 'white')).toBeGreaterThan(0.5);
  });

  it('keeps ownership on a loss and only lowers the defenders', () => {
    const start = warState(DEFAULT_MAP, players, { emir: 8 }, [], TODAY);
    const target = attackOptions(start, DEFAULT_MAP, 'emir')[0]!;
    const war = warState(DEFAULT_MAP, players, { emir: 8 },
      [battle({ to: target.to, won: false, attackers: 2, attackersLeft: 0, defendersLeft: 1 })], TODAY);
    expect(war.owner[target.to]).toBe('black');
    expect(war.garrison[target.to]).toBe(1);
    expect(war.pieces.emir!.available).toBe(6);
  });

  it("does not spend today's soldiers for yesterday's battles", () => {
    const war = warState(DEFAULT_MAP, players, { emir: 8 }, [battle({ to: 'x', day: '2026-10-09' })], TODAY);
    expect(war.pieces.emir!.available).toBe(8);
  });
});

describe('attackOptions', () => {
  it('lists only enemy territories next to my piece, with my available soldiers', () => {
    const war = warState(DEFAULT_MAP, players, { emir: 8 }, [], TODAY);
    const here = DEFAULT_MAP.territories.find((t) => t.id === startingPositions(DEFAULT_MAP, players).get('emir'))!;
    const options = attackOptions(war, DEFAULT_MAP, 'emir');
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(here.neighbors).toContain(o.to);
      expect(war.owner[o.to]).toBe('black');
      expect(o).toMatchObject({ defenders: 2, maxAttackers: 8 });
    }
  });
  it('is empty without soldiers', () => {
    expect(attackOptions(warState(DEFAULT_MAP, players, {}, [], TODAY), DEFAULT_MAP, 'emir')).toEqual([]);
  });
});

describe('warState on a new map', () => {
  it('ignores battles for territories that are not on the map (fought on an earlier map)', () => {
    const players = [{ id: 'emir', name: 'Emir', team: 'black' as const }];
    const old = { id: 1, playerId: 'emir', team: 'black' as const, from: 't13', to: 't14', attackers: 4, defenders: 2, p: 0.67, roll: 0.1, won: true, attackersLeft: 3, defendersLeft: 0, day: '2026-10-10', at: '2026-10-10T12:00:00Z' };
    const war = warState(DEFAULT_MAP, players, { emir: 4 }, [old], '2026-10-10');
    expect(Object.keys(war.owner).sort()).toEqual(DEFAULT_MAP.territories.map((t) => t.id).sort());
    expect(war.pieces.emir?.territoryId).not.toBe('t14');
  });
});
