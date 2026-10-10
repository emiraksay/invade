import { beforeEach, describe, expect, it } from 'vitest';
import { summarizeTeamDay, type Player, type StepReport } from '@invade/engine';
import { _resetCache, attackOdds, cachedWords, general, nextBonusThreshold, pickOrder, teamOrder, templateText, type AttackOption } from './general';
import { join, submitSteps, type GameRow, type Repo } from './handlers';

const DAY = '2026-10-10';
const NOW = new Date('2026-10-10T12:00:00+02:00');
const opt = (name: string, defenders: number, maxAttackers: number): AttackOption => ({ to: name.toLowerCase(), name, defenders, maxAttackers });
const players: Player[] = [
  { id: 'me', name: 'Kateryna', team: 'white' },
  { id: 'c', name: 'Costi', team: 'white' },
  { id: 'e', name: 'Emir', team: 'black' },
];
const report = (playerId: string, steps: number): StepReport => ({ playerId, day: DAY, steps, source: 'demo', reportedAt: DAY });
const white = (reports: StepReport[]) => summarizeTeamDay('white', players, reports, DAY);
const me = (team: ReturnType<typeof white>) => team.members.find((m) => m.player.id === 'me')!;
const input = (team: ReturnType<typeof white>, options: AttackOption[] = [], territory: string | null = 'Eixample') => ({ me: me(team), team, options, territory });

describe('attackOdds', () => {
  it('is attackers over attackers plus defenders', () => {
    expect(attackOdds(3, 2)).toBeCloseTo(0.6);
    expect(attackOdds(0, 2)).toBe(0);
  });
});

describe('pickOrder', () => {
  it('a) attacks with all available soldiers when the best option reaches 60%', () => {
    const team = white([report('me', 10_050)]);
    const order = pickOrder(input(team, [opt('Gràcia', 4, 8), opt('Born', 2, 8)]));
    expect(order).toEqual({ player: 'Kateryna', team: 'white', kind: 'attack', to: 'born', target: 'Born', soldiers: 8, defenders: 2, odds: 0.8 });
  });
  it('a) on equal odds prefers the weaker garrison', () => {
    const team = white([report('me', 10_050)]);
    const order = pickOrder(input(team, [opt('A', 2, 8), opt('B', 2, 8)]));
    expect(order).toMatchObject({ kind: 'attack', target: 'A' });
  });
  it('a) does not attack below 60%, falls through', () => {
    const team = white([report('me', 10_050), report('c', 10_000)]);
    const order = pickOrder(input(team, [opt('Fort', 20, 8)]));
    expect(order.kind).not.toBe('attack');
  });
  it('b) orders the team bonus when I am below the next threshold', () => {
    const team = white([report('me', 3_100), report('c', 6_000)]);
    expect(pickOrder(input(team))).toEqual({ player: 'Kateryna', team: 'white', kind: 'bonus', stepsToGo: 1_900, threshold: 5_000, bonus: 1 });
  });
  it('b) uses the 10k threshold once everyone is past 5k', () => {
    const team = white([report('me', 7_000), report('c', 10_000)]);
    expect(pickOrder(input(team))).toMatchObject({ kind: 'bonus', stepsToGo: 3_000, threshold: 10_000, bonus: 1 });
  });
  it('c) walks to the next milestone when the bonus does not depend on me', () => {
    const team = white([report('me', 10_050), report('c', 10_000)]); // both past 10k: no bonus threshold left
    expect(pickOrder(input(team))).toEqual({ player: 'Kateryna', team: 'white', kind: 'walk', stepsToGo: 1_950, gain: 2 });
  });
  it('d) holds at the cap with nothing to attack', () => {
    const team = white([report('me', 12_000), report('c', 12_000)]);
    expect(pickOrder(input(team, [], 'Eixample'))).toEqual({ player: 'Kateryna', team: 'white', kind: 'hold', territory: 'Eixample' });
    expect(pickOrder(input(team, [], null)).kind).toBe('hold');
  });
  it('is pure', () => {
    const team = white([report('me', 3_100)]);
    expect(pickOrder(input(team))).toEqual(pickOrder(input(team)));
  });
});

describe('nextBonusThreshold', () => {
  it('5k while anyone is below it, 10k after, null past 10k, null for an empty team', () => {
    expect(nextBonusThreshold(white([report('me', 100), report('c', 9_000)]))).toEqual({ threshold: 5_000, bonus: 1 });
    expect(nextBonusThreshold(white([report('me', 6_000), report('c', 9_000)]))).toEqual({ threshold: 10_000, bonus: 1 });
    expect(nextBonusThreshold(white([report('me', 10_000), report('c', 12_000)]))).toBeNull();
    expect(nextBonusThreshold(summarizeTeamDay('black', [], [], DAY))).toBeNull();
  });
});

describe('teamOrder', () => {
  const base = { player: 'x', team: 'white' as const };
  it('best attack first, else biggest walking gain, fewest steps on a tie', () => {
    const a1 = { ...base, kind: 'attack' as const, to: 'a', target: 'A', soldiers: 4, defenders: 2, odds: 0.67 };
    const a2 = { ...base, kind: 'attack' as const, to: 'b', target: 'B', soldiers: 8, defenders: 2, odds: 0.8 };
    const w1 = { ...base, kind: 'walk' as const, stepsToGo: 900, gain: 4 };
    const w2 = { ...base, kind: 'bonus' as const, stepsToGo: 300, threshold: 5000, bonus: 2 };
    const w3 = { ...base, kind: 'walk' as const, stepsToGo: 100, gain: 4 };
    expect(teamOrder([w1, a1, a2])).toBe(a2);
    expect(teamOrder([w1, w2])).toBe(w1);
    expect(teamOrder([w1, w3])).toBe(w3);
    expect(teamOrder([])).toBeNull();
  });
});

describe('templateText', () => {
  it('keeps the numbers for every kind', () => {
    const base = { player: 'Kateryna', team: 'white' as const };
    expect(templateText({ ...base, kind: 'attack', to: 'b', target: 'Born', soldiers: 8, defenders: 2, odds: 0.8 })).toBe('Kateryna, strike Born with 8 soldiers. 80% says we take it.');
    expect(templateText({ ...base, kind: 'bonus', stepsToGo: 1900, threshold: 5000, bonus: 1 })).toContain('1.900 more steps and the whole team earns +1');
    expect(templateText({ ...base, kind: 'walk', stepsToGo: 1950, gain: 2 })).toBe('Kateryna, 1.950 more steps and 2 fresh soldiers join you.');
    expect(templateText({ ...base, kind: 'hold', territory: 'Eixample' })).toContain('hold Eixample');
  });
});

describe('cachedWords', () => {
  beforeEach(() => _resetCache());
  it('calls the writer once per key within 2 minutes', async () => {
    let calls = 0;
    const write = async () => { calls++; return 'go'; };
    expect(await cachedWords('k', write, 1_000)).toBe('go');
    expect(await cachedWords('k', write, 60_000)).toBe('go');
    expect(calls).toBe(1);
    await cachedWords('k', write, 1_000 + 2 * 60_000 + 1);
    expect(calls).toBe(2);
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
    async listBattles() { return []; },
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

describe('general route', () => {
  beforeEach(() => _resetCache());
  it('rejects bad input and unknown tokens', async () => {
    expect(await general(memoryRepo(), {}, NOW)).toEqual({ ok: false, error: 'Invalid request' });
    expect(await general(memoryRepo(), { token: 'INV-XXXX-XXXX-XXXX' }, NOW)).toEqual({ ok: false, error: 'Unknown code' });
    expect(await general(memoryRepo(), { code: 'NOPE', team: 'white' }, NOW)).toEqual({ ok: false, error: 'No game with that code' });
  });
  it('gives a player a bonus order with template text when the writer fails', async () => {
    const repo = memoryRepo();
    const k = await joined(repo, 'Kateryna', 'white');
    const c = await joined(repo, 'Costi', 'white');
    await submitSteps(repo, { token: k, steps: 3_100, day: DAY, source: 'demo' }, NOW);
    await submitSteps(repo, { token: c, steps: 6_000, day: DAY, source: 'demo' }, NOW);
    const r = await general(repo, { token: k }, NOW, async () => { throw new Error('boom'); });
    expect(r.ok && r.data.order).toMatchObject({ kind: 'bonus', stepsToGo: 1_900, player: 'Kateryna' });
    expect(r.ok && r.data.writer).toBe('template');
    expect(r.ok && r.data.text).toContain('Kateryna');
  });
  it('gives a player with no steps yet a walk order to 5,000', async () => {
    const repo = memoryRepo();
    const k = await joined(repo, 'Kateryna', 'white');
    const r = await general(repo, { token: k }, NOW, async (o) => `${o.player}: ${o.kind}`);
    expect(r.ok && r.data.order).toMatchObject({ kind: 'bonus', stepsToGo: 5_000 });
    expect(r.ok && r.data.text).toBe('Kateryna: bonus');
    expect(r.ok && r.data.writer).toBe('claude');
  });
  it('gives the team version the strongest order, attacks when options are wired', async () => {
    const repo = memoryRepo();
    const k = await joined(repo, 'Kateryna', 'white');
    await joined(repo, 'Costi', 'white');
    await submitSteps(repo, { token: k, steps: 12_000, day: DAY, source: 'demo' }, NOW);
    const withAttacks: typeof import('./general').loadContext = async (rp, g, n) => {
      const { loadContext } = await import('./general');
      const ctx = await loadContext(rp, g, n);
      return { ...ctx, attackOptions: (id) => (id === 'p1' ? [{ to: 't1', name: 'Gràcia', defenders: 2, maxAttackers: 10 }] : []) };
    };
    const r = await general(repo, { code: 'invade', team: 'white' }, NOW, async (o) => `${o.player}: ${o.kind}`, withAttacks);
    expect(r.ok && r.data.order).toMatchObject({ kind: 'attack', target: 'Gràcia', soldiers: 10, odds: 0.83, player: 'Kateryna' });
    expect(r.ok && r.data.text).toBe('Kateryna: attack');
  });
  it('fails cleanly for an empty team', async () => {
    const repo = memoryRepo();
    await joined(repo, 'Kateryna', 'white');
    expect(await general(repo, { code: 'INVADE', team: 'black' }, NOW, async () => 'x')).toEqual({ ok: false, error: 'Nobody on that team yet' });
  });
});
