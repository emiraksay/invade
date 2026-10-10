import { describe, expect, it } from 'vitest';
import { toBattleRecord, type BattleRecord, type Player, type StepSource, type TeamId } from '@invade/engine';
import { join, me, submitSteps, type GameRow, type Repo } from './handlers';

/** In-memory Repo with the same semantics as the SQL functions (keep-max, team cap). */
function memoryRepo() {
  const game: GameRow = {
    id: 'g1',
    code: 'INVADE',
    settings: {
      campaignDays: 30, winThreshold: 0.51, walkPhaseHours: 24, timezone: 'Europe/Madrid',
      teamNames: { white: 'White', black: 'Black' },
    },
  };
  const players: Player[] = [];
  const secrets = new Map<string, string>(); // tokenHash -> playerId
  const steps = new Map<string, number>(); // `${player}|${day}` -> steps
  const events: { type: string; payload: unknown }[] = [];

  const repo: Repo = {
    async findGameByCode(code) { return code === game.code ? game : null; },
    async createPlayer(_gameId, name, team: TeamId, tokenHash) {
      if (players.filter((p) => p.team === team).length >= 4) throw new Error('team_full');
      const player = { id: `p${players.length + 1}`, name, team };
      players.push(player);
      secrets.set(tokenHash, player.id);
      return player;
    },
    async findByTokenHash(hash) {
      const player = players.find((p) => p.id === secrets.get(hash));
      return player ? { player, game } : null;
    },
    async reportSteps(playerId, day, value, _source: StepSource) {
      const key = `${playerId}|${day}`;
      const before = steps.get(key) ?? 0;
      const after = Math.max(before, value);
      steps.set(key, after);
      return { before, after };
    },
    async insertEvent(_gameId, type, payload) { events.push({ type, payload }); },
    async listPlayers() { return [...players]; },
    async listStepReports(_gameId, day) {
      return [...steps.entries()]
        .filter(([k]) => k.endsWith(`|${day}`))
        .map(([k, v]) => ({ playerId: k.split('|')[0]!, day, steps: v, source: 'demo' as const, reportedAt: day }));
    },
    async listBattles() {
      return events
        .map((e, i) => toBattleRecord({ id: i + 1, type: e.type, payload: e.payload, created_at: `2026-10-10T12:${String(i).padStart(2, '0')}:00Z` }))
        .filter((b): b is BattleRecord => b !== null);
    },
  };
  return { repo, events, players, steps };
}

const NOW = new Date('2026-10-10T10:00:00+02:00');

async function joined(repo: Repo, name = 'Emir', team: TeamId = 'white') {
  const r = await join(repo, { code: 'invade', name, team });
  if (!r.ok) throw new Error(r.error);
  return r.data.token;
}

describe('join', () => {
  it('creates a player, returns a one-time token, and accepts a lowercase code', async () => {
    const { repo } = memoryRepo();
    const r = await join(repo, { code: 'invade', name: '  Emir ', team: 'white' });
    expect(r.ok && r.data.player).toMatchObject({ name: 'Emir', team: 'white' });
    expect(r.ok && r.data.token).toMatch(/^INV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('rejects bad input and unknown games with readable errors', async () => {
    const { repo } = memoryRepo();
    expect(await join(repo, { code: 'INVADE', name: '', team: 'white' })).toEqual({ ok: false, error: 'Enter your name' });
    expect(await join(repo, { code: 'INVADE', name: 'A'.repeat(15), team: 'white' })).toMatchObject({ ok: false });
    expect(await join(repo, { code: 'INVADE', name: 'Emir', team: 'red' })).toMatchObject({ ok: false });
    expect(await join(repo, { code: 'NOPE', name: 'Emir', team: 'white' })).toEqual({ ok: false, error: 'No game with that code' });
  });

  it('refuses a name that already joined, whatever the case or team', async () => {
    const { repo } = memoryRepo();
    await joined(repo, 'Kateryna', 'black');
    const again = await join(repo, { code: 'INVADE', name: 'kateryna ', team: 'white' });
    expect(again).toMatchObject({ ok: false });
    expect(!again.ok && again.error).toContain('already in this game');
  });

  it('caps a team at 4 players', async () => {
    const { repo } = memoryRepo();
    for (const n of ['a', 'b', 'c', 'd']) await joined(repo, n);
    expect(await join(repo, { code: 'INVADE', name: 'e', team: 'white' })).toEqual({ ok: false, error: 'Team White is full' });
    expect((await join(repo, { code: 'INVADE', name: 'e', team: 'black' })).ok).toBe(true);
  });
});

describe('me', () => {
  it('resolves a token to the player, case-insensitively', async () => {
    const { repo } = memoryRepo();
    const token = await joined(repo);
    const r = await me(repo, { token: token.toLowerCase() });
    expect(r.ok && r.data.player.name).toBe('Emir');
    expect(await me(repo, { token: 'INV-AAAA-BBBB-CCCC' })).toEqual({ ok: false, error: 'Unknown code' });
  });
});

describe('submitSteps', () => {
  it("uses today's game day when no day is sent, and tolerates extra text around a date", async () => {
    const { repo } = memoryRepo();
    const token = await joined(repo);
    expect(await submitSteps(repo, { token, steps: 100 }, NOW)).toMatchObject({ ok: true, data: { day: '2026-10-10' } });
    expect(await submitSteps(repo, { token, steps: 200, day: ' 2026-10-10\n' }, NOW)).toMatchObject({ ok: true, data: { day: '2026-10-10' } });
  });

  it('stores steps, converts to soldiers, and fires a milestone event exactly once', async () => {
    const { repo, events } = memoryRepo();
    const token = await joined(repo);
    const first = await submitSteps(repo, { token, steps: 5_200, day: '2026-10-10' }, NOW);
    expect(first).toEqual({ ok: true, data: { day: '2026-10-10', steps: 5_200, soldiers: 4, gained: 4 } });
    // Resend of the same total: no change, no new event.
    const again = await submitSteps(repo, { token, steps: 5_200, day: '2026-10-10' }, NOW);
    expect(again.ok && again.data.gained).toBe(0);
    expect(events).toHaveLength(1);
  });

  it('never lowers the stored total (stale or out-of-order reports)', async () => {
    const { repo } = memoryRepo();
    const token = await joined(repo);
    await submitSteps(repo, { token, steps: 8_000, day: '2026-10-10' }, NOW);
    const stale = await submitSteps(repo, { token, steps: 3_000, day: '2026-10-10' }, NOW);
    expect(stale.ok && stale.data.steps).toBe(8_000);
  });

  it('accepts Shortcut-style values (string, decimals) and floors them', async () => {
    const { repo } = memoryRepo();
    const token = await joined(repo);
    const r = await submitSteps(repo, { token, steps: '10432.7', day: '2026-10-10' }, NOW);
    expect(r.ok && r.data).toMatchObject({ steps: 10_432, soldiers: 8 });
  });

  it('rejects unknown tokens, implausible counts, and days far from today', async () => {
    const { repo } = memoryRepo();
    const token = await joined(repo);
    expect(await submitSteps(repo, { token: 'INV-AAAA-BBBB-CCCC', steps: 10, day: '2026-10-10' }, NOW)).toEqual({ ok: false, error: 'Unknown code' });
    expect((await submitSteps(repo, { token, steps: 500_000, day: '2026-10-10' }, NOW)).ok).toBe(false);
    expect((await submitSteps(repo, { token, steps: -5, day: '2026-10-10' }, NOW)).ok).toBe(false);
    expect((await submitSteps(repo, { token, steps: 100, day: '2026-10-07' }, NOW)).ok).toBe(false);
    expect((await submitSteps(repo, { token, steps: 100, day: '2026-10-09' }, NOW)).ok).toBe(true);
  });
});

describe('attack (POST /api/attack)', () => {
  async function setup() {
    const { attack, loadWarContext } = await import('./war');
    const { attackOptions, DEFAULT_MAP } = await import('@invade/engine');
    const mem = memoryRepo();
    const emir = await joined(mem.repo, 'Emir', 'white');
    await joined(mem.repo, 'Kat', 'black');
    await submitSteps(mem.repo, { token: emir, steps: 10_000 }, NOW); // 8 soldiers
    const me = (await mem.repo.findByTokenHash((await import('./tokens')).hashToken(emir)))!;
    const ctx = await loadWarContext(mem.repo, me.game, NOW);
    const target = attackOptions(ctx.war, DEFAULT_MAP, me.player.id)[0]!;
    return { attack, loadWarContext, mem, emir, me, target };
  }

  it('wins with a low roll: the territory flips, the piece moves in, soldiers are spent', async () => {
    const { attack, loadWarContext, mem, emir, me, target } = await setup();
    const r = await attack(mem.repo, { token: emir, to: target.to, soldiers: 5 }, NOW, () => 0.1);
    expect(r).toMatchObject({ ok: true, data: { won: true, to: target.to, attackersLeft: 4, defendersLeft: 0 } });
    const ctx = await loadWarContext(mem.repo, me.game, NOW);
    expect(ctx.war.owner[target.to]).toBe('white');
    expect(ctx.war.pieces[me.player.id]).toEqual({ territoryId: target.to, available: 3 });
  });

  it('loses with a high roll: ownership stays, defenders drop', async () => {
    const { attack, loadWarContext, mem, emir, me, target } = await setup();
    const r = await attack(mem.repo, { token: emir, to: target.to, soldiers: 2 }, NOW, () => 0.99);
    expect(r).toMatchObject({ ok: true, data: { won: false, defendersLeft: 1 } });
    expect((await loadWarContext(mem.repo, me.game, NOW)).war.owner[target.to]).toBe('black');
  });

  it('rejects targets not next to me, too many soldiers, and players without soldiers', async () => {
    const { attack, mem, emir, target } = await setup();
    expect(await attack(mem.repo, { token: emir, to: 'tXX', soldiers: 1 }, NOW)).toEqual({ ok: false, error: 'You can only attack enemy territory next to you' });
    expect(await attack(mem.repo, { token: emir, to: target.to, soldiers: 9 }, NOW)).toEqual({ ok: false, error: 'You only have 8 soldiers available' });
    const kat = await joined(mem.repo, 'Kim', 'black');
    expect((await attack(mem.repo, { token: kat, to: target.to, soldiers: 1 }, NOW)).ok).toBe(false);
  });
});

describe('director (POST /api/director)', () => {
  it("issues one of today's live decrees with the template when Claude is unavailable", async () => {
    const { director } = await import('./directorLive');
    const { repo } = memoryRepo();
    await joined(repo, 'Emir', 'white');
    await joined(repo, 'Kat', 'black');
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const r = await director(repo, { code: 'invade' }, NOW);
    process.env.ANTHROPIC_API_KEY = saved;
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(['quiet', 'duel', 'all_hands', 'reinforcements']).toContain(r.data.decree.kind);
      expect(r.data.writer).toBe('template');
      expect(r.data.title.length).toBeGreaterThan(0);
    }
    expect(await director(repo, { code: 'nope' }, NOW)).toEqual({ ok: false, error: 'No game with that code' });
  });
});
