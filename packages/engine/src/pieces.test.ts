import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from './map';
import { depthsFromHq, startingPositions } from './pieces';
import type { Player, TeamId } from './types';

const team = (t: TeamId, n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${t}-${i}`, name: `${t} ${i}`, team: t }));
const byId = new Map(DEFAULT_MAP.territories.map((t) => [t.id, t]));

describe('startingPositions', () => {
  it("puts every player on a non-HQ territory of their own team's half", () => {
    const players = [...team('white', 4), ...team('black', 4)];
    const pos = startingPositions(DEFAULT_MAP, players);
    expect(pos.size).toBe(8);
    for (const p of players) {
      const t = byId.get(pos.get(p.id)!)!;
      expect(t.team).toBe(p.team);
      expect(t.isHq).toBe(false);
    }
  });

  it('puts every piece on the front line (next to an enemy territory) so everyone can fight', () => {
    const players = [...team('white', 4), ...team('black', 4)];
    const pos = startingPositions(DEFAULT_MAP, players);
    for (const p of players) {
      const t = byId.get(pos.get(p.id)!)!;
      expect(t.neighbors.some((n) => byId.get(n)!.team !== p.team)).toBe(true);
    }
    const depth = depthsFromHq(DEFAULT_MAP, 'white');
    expect(depth.get(pos.get('white-0')!)).toBe(Math.max(...[...pos.entries()].filter(([id]) => id.startsWith('white')).map(([, t]) => depth.get(t)!)));
  });

  it('is deterministic and keeps earlier players in place when someone joins later', () => {
    const three = startingPositions(DEFAULT_MAP, team('black', 3));
    expect(startingPositions(DEFAULT_MAP, team('black', 3))).toEqual(three);
    // The first player always gets the front-line slot, whatever the team size.
    expect(startingPositions(DEFAULT_MAP, team('black', 4)).get('black-0')).toBe(three.get('black-0'));
  });

  it('handles empty teams', () => {
    expect(startingPositions(DEFAULT_MAP, []).size).toBe(0);
  });
});
