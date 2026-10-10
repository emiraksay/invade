import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, STARTING_GARRISON, startingPositions, summarizeTeamDay, type Player, type StepReport } from '@invade/engine';
import { forceFor, general, pickOrder, provisionalAttackOptions, templateLines, type AttackOption } from './general';
import { join, submitSteps, type GameRow, type Repo } from './handlers';

const DAY = '2026-10-10';
const NOW = new Date('2026-10-10T12:00:00+02:00');
const opt = (territory: string, defenders: number): AttackOption => ({
  territoryId: territory.toLowerCase(), territory, defenders, odds: (n) => (n > 0 ? n / (n + defenders) : 0),
});
const players: Player[] = [
  { id: 'me', name: 'Kateryna', team: 'white' },
  { id: 'c', name: 'Costi', team: 'white' },
  { id: 'e', name: 'Emir', team: 'black' },
];
const report = (playerId: string, steps: number): StepReport => ({ playerId, day: DAY, steps, source: 'demo', reportedAt: DAY });
const teamOf = (reports: StepReport[]) => summarizeTeamDay('white', players, reports, DAY);
const me = (team: ReturnType<typeof teamOf>) => team.members.find((m) => m.player.id === 'me')!;

describe('forceFor', () => {
  it('is the smallest force reaching 60%, within what I have', () => {
    expect(forceFor(opt('Gràcia', 2), 10)).toBe(3); // 3/(3+2) = 0.6
    expect(forceFor(opt('Gràcia', 2), 2)).toBeNull(); // 2/4 = 0.5
    expect(forceFor(opt('Gràcia', 0), 1)).toBe(1);
  });
});

describe('pickOrder', () => {
  it('attacks when a strong attack exists, choosing the surest one, with the minimal force', () => {
    const team = teamOf([report('me', 10_050)]); // 8 soldiers
    const order = pickOrder({ me: me(team), team, options: [opt('Gràcia', 4), opt('Born', 2)], myTerritory: null });
    expect(order).toEqual({ kind: 'attack', territoryId: 'born', territory: 'Born', soldiers: 3, defenders: 2, odds: 0.6 });
  });

  it('walks when no attack reaches 60%, and says when the milestone unlocks the team bonus', () => {
    const team = teamOf([report('me', 3_100), report('c', 6_000)]); // me: 0 soldiers, Costi ≥5k
    const order = pickOrder({ me: me(team), team, options: [opt('Gràcia', 2)], myTerritory: null });
    expect(order).toEqual({ kind: 'walk', stepsToGo: 1_900, gain: 4, unlocksBonus: true });
  });

  it('walks without the bonus flag when a teammate is still below the milestone too', () => {
    const team = teamOf([report('me', 3_100), report('c', 1_000)]);
    const order = pickOrder({ me: me(team), team, options: [], myTerritory: null });
    expect(order).toMatchObject({ kind: 'walk', unlocksBonus: false });
  });

  it('holds at the daily cap with nothing worth attacking', () => {
    const team = teamOf([report('me', 12_000)]); // 10 soldiers, next = null
    const order = pickOrder({ me: me(team), team, options: [opt('Gràcia', 40)], myTerritory: { id: 't13', name: 'Eixample' } });
    expect(order).toEqual({ kind: 'hold', territoryId: 't13', territory: 'Eixample' });
  });

  it('is pure', () => {
    const team = teamOf([report('me', 10_050)]);
    const facts = { me: me(team), team, options: [opt('Born', 2)], myTerritory: null };
    expect(pickOrder(facts)).toEqual(pickOrder(facts));
  });
});

describe('provisionalAttackOptions', () => {
  it('lists enemy neighbours of my piece with garrison + enemy pieces, odds per decision 4', () => {
    const soldiers = new Map([['e', 8]]);
    const positions = startingPositions(DEFAULT_MAP, players);
    const mine = DEFAULT_MAP.territories.find((t) => t.id === positions.get('me'))!;
    const options = provisionalAttackOptions(DEFAULT_MAP, players, soldiers, 'me');
    const enemyNeighbours = mine.neighbors.filter((id) => DEFAULT_MAP.territories.find((t) => t.id === id)!.team === 'black');
    expect(options.map((o) => o.territoryId).sort()).toEqual([...enemyNeighbours].sort());
    for (const o of options) {
      const emirHere = positions.get('e') === o.territoryId ? 8 : 0;
      expect(o.defenders).toBe(STARTING_GARRISON + emirHere);
      expect(o.odds(3)).toBeCloseTo(3 / (3 + o.defenders));
      expect(o.odds(0)).toBe(0);
    }
  });
  it('returns nothing for an unknown player', () => {
    expect(provisionalAttackOptions(DEFAULT_MAP, players, new Map(), 'ghost')).toEqual([]);
  });
});

describe('templateLines', () => {
  it('keeps the numbers', () => {
    expect(templateLines({ kind: 'attack', territoryId: 'x', territory: 'Born', soldiers: 3, defenders: 2, odds: 0.6 }, 'Kateryna')[0]).toContain('Born with 3. 60%');
    expect(templateLines({ kind: 'walk', stepsToGo: 1900, gain: 4, unlocksBonus: true }, 'Costi')[0]).toContain('1.900 steps: +4 soldiers and the team bonus');
    expect(templateLines({ kind: 'hold', territoryId: 'x', territory: 'Eixample' }, 'Emir')[0]).toContain('hold Eixample');
  });
});

function memoryRepo() {
  const game: GameRow = {
    id: 'g1', code: 'INVADE',
    settings: { campaignDays: 30, winThreshold: 0.51, walkPhaseHours: 24, timezone: 'Europe/Madrid', teamNames: { white: 'White', black: 'Black' } },
  };
  const ps: Player[] = [];
  const secrets = new Map<string, string>();
  const steps = new Map<string, number>();
  const repo: Repo = {
    async findGameByCode(code) { return code === game.code ? game : null; },
    async createPlayer(_g, name, team, hash) { const p = { id: `p${ps.length + 1}`, name, team }; ps.push(p); secrets.set(hash, p.id); return p; },
    async findByTokenHash(hash) { const p = ps.find((x) => x.id === secrets.get(hash)); return p ? { player: p, game } : null; },
    async reportSteps(id, day, v) { const k = `${id}|${day}`; const before = steps.get(k) ?? 0; const after = Math.max(before, v); steps.set(k, after); return { before, after }; },
    async insertEvent() {},
    async listPlayers() { return [...ps]; },
    async listStepReports(_g, day) {
      return [...steps.entries()].filter(([k]) => k.endsWith(`|${day}`)).map(([k, v]) => ({ playerId: k.split('|')[0]!, day, steps: v, source: 'demo' as const, reportedAt: day }));
    },
  };
  return repo;
}
async function joined(repo: Repo, name: string, team: 'white' | 'black') {
  const r = await join(repo, { code: 'INVADE', name, team });
  if (!r.ok) throw new Error(r.error);
  return r.data.token;
}

describe('general handler', () => {
  it('rejects bad input and unknown codes', async () => {
    expect(await general(memoryRepo(), {}, NOW)).toEqual({ ok: false, error: 'Invalid request' });
    expect(await general(memoryRepo(), { token: 'INV-XXXX-XXXX-XXXX' }, NOW)).toEqual({ ok: false, error: 'Unknown code' });
  });

  it('gives a player a walk order with template lines when the writer fails', async () => {
    const repo = memoryRepo();
    const me = await joined(repo, 'Kateryna', 'white');
    await submitSteps(repo, { token: me, steps: 3_100, day: DAY, source: 'demo' }, NOW);
    const r = await general(repo, { token: me }, NOW, async () => { throw new Error('boom'); });
    expect(r.ok && r.data.order).toEqual({ kind: 'walk', stepsToGo: 1_900, gain: 4, unlocksBonus: true });
    expect(r.ok && r.data.writer).toBe('template');
    expect(r.ok && r.data.lines[0]).toContain('Kateryna');
  });

  it('gives the team version the most decisive order, written by the writer', async () => {
    const repo = memoryRepo();
    const k = await joined(repo, 'Kateryna', 'white');
    const c = await joined(repo, 'Costi', 'white');
    await joined(repo, 'Emir', 'black');
    await submitSteps(repo, { token: k, steps: 12_000, day: DAY, source: 'demo' }, NOW); // 10 soldiers: attacks
    await submitSteps(repo, { token: c, steps: 4_000, day: DAY, source: 'demo' }, NOW);
    const r = await general(repo, { code: 'invade', team: 'white' }, NOW, async (order, name) => [`${name}: ${order.kind}`]);
    expect(r.ok && r.data.order.kind).toBe('attack');
    expect(r.ok && r.data.name).toBe('Kateryna');
    expect(r.ok && r.data.lines).toEqual(['Kateryna: attack']);
    expect(r.ok && r.data.writer).toBe('claude');
  });

  it('fails cleanly for an empty team', async () => {
    const repo = memoryRepo();
    await joined(repo, 'Kateryna', 'white');
    expect(await general(repo, { code: 'INVADE', team: 'black' }, NOW, async () => [])).toEqual({ ok: false, error: 'Nobody on that team yet' });
  });
});
