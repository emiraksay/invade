import { describe, expect, it } from 'vitest';
import { summarizeTeamDay, type Player, type StepReport } from '@invade/engine';
import { nudge, nudgeTargets, templateMessage } from './nudge';
import { join, submitSteps, type GameRow, type Repo } from './handlers';

const DAY = '2026-10-10';
const NOW = new Date('2026-10-10T12:00:00+02:00');

const players: Player[] = [
  { id: 'me', name: 'Kateryna', team: 'white' },
  { id: 'c', name: 'Costi', team: 'white' },
  { id: 'v', name: 'Varvara', team: 'white' },
  { id: 'e', name: 'Emir', team: 'black' },
];
const report = (playerId: string, steps: number): StepReport => ({ playerId, day: DAY, steps, source: 'demo', reportedAt: DAY });

describe('nudgeTargets', () => {
  it('skips me and anyone at the daily cap, and puts the bonus-unlocker first', () => {
    const team = summarizeTeamDay('white', players, [report('me', 12_000), report('c', 3_120), report('v', 9_400)], DAY);
    const t = nudgeTargets(team, 'me');
    expect(t.map((x) => x.playerId)).toEqual(['c', 'v']); // Costi unlocks the +B bonus (everyone else is ≥5k)
    expect(t[0]).toMatchObject({ name: 'Costi', stepsToGo: 1_880, gain: 4, unlocksBonus: true });
    expect(t[1]).toMatchObject({ name: 'Varvara', stepsToGo: 600, gain: 4, unlocksBonus: false });
  });

  it('orders by closeness when nobody unlocks a bonus, and caps the list at 3', () => {
    const many: Player[] = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, team: 'white' }));
    const team = summarizeTeamDay('white', [{ id: 'me', name: 'Me', team: 'white' }, ...many], many.map((p, i) => report(p.id, 1000 * i)), DAY);
    const t = nudgeTargets(team, 'me');
    expect(t).toHaveLength(3);
    expect(t.map((x) => x.stepsToGo)).toEqual([1000, 2000, 3000]);
  });

  it('is pure: same input, same output', () => {
    const team = summarizeTeamDay('white', players, [report('c', 100)], DAY);
    expect(nudgeTargets(team, 'me')).toEqual(nudgeTargets(team, 'me'));
  });
});

describe('templateMessage', () => {
  it('uses the exact numbers and mentions the bonus only when it applies', () => {
    expect(templateMessage({ playerId: 'c', name: 'Costi', steps: 3120, stepsToGo: 1880, gain: 4, unlocksBonus: true })).toContain('1.880 steps from +4 soldiers');
    expect(templateMessage({ playerId: 'c', name: 'Costi', steps: 3120, stepsToGo: 1880, gain: 4, unlocksBonus: false })).not.toContain('bonus');
    expect(templateMessage({ playerId: 'v', name: 'Varvara', steps: 0, stepsToGo: 5000, gain: 4, unlocksBonus: false })).toContain('no steps logged yet');
  });
});

/** Same in-memory repo shape as handlers.test.ts, kept local so this file stands alone. */
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
    async listBattles() { return []; },
  };
  return repo;
}

async function joined(repo: Repo, name: string, team: 'white' | 'black' = 'white') {
  const r = await join(repo, { code: 'INVADE', name, team });
  if (!r.ok) throw new Error(r.error);
  return r.data.token;
}

describe('nudge handler', () => {
  it('rejects unknown codes', async () => {
    const r = await nudge(memoryRepo(), { token: 'INV-XXXX-XXXX-XXXX' }, NOW);
    expect(r).toEqual({ ok: false, error: 'Unknown code' });
  });

  it('returns facts from the engine and words from the writer', async () => {
    const repo = memoryRepo();
    const me = await joined(repo, 'Kateryna');
    const costi = await joined(repo, 'Costi');
    await submitSteps(repo, { token: me, steps: 12_000, day: DAY, source: 'demo' }, NOW);
    await submitSteps(repo, { token: costi, steps: 3_120, day: DAY, source: 'demo' }, NOW);
    const writer = async (facts: { playerId: string }[]) => Object.fromEntries(facts.map((f) => [f.playerId, `hey ${f.playerId}`]));
    const r = await nudge(repo, { token: me }, NOW, writer);
    expect(r.ok && r.data.writer).toBe('claude');
    expect(r.ok && r.data.nudges).toEqual([
      { playerId: 'p2', name: 'Costi', steps: 3_120, stepsToGo: 1_880, gain: 4, unlocksBonus: true, message: 'hey p2' },
    ]);
  });

  it('falls back to the template when the writer fails or returns nothing for a player', async () => {
    const repo = memoryRepo();
    const me = await joined(repo, 'Kateryna');
    await joined(repo, 'Costi');
    const failing = async () => { throw new Error('boom'); };
    const r = await nudge(repo, { token: me }, NOW, failing);
    expect(r.ok && r.data.writer).toBe('template');
    expect(r.ok && r.data.nudges[0]!.message).toContain('Costi');
  });

  it('returns an empty list when nobody needs a nudge', async () => {
    const repo = memoryRepo();
    const me = await joined(repo, 'Kateryna');
    const r = await nudge(repo, { token: me }, NOW, async () => ({}));
    expect(r.ok && r.data.nudges).toEqual([]);
  });
});
