// The war, server side: rebuild the current war from stored facts (players, today's steps, battles)
// and resolve attacks. Used by POST /api/attack and by the AI General (loadWarContext).
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  DEFAULT_MAP,
  attackOptions,
  gameDayOf,
  resolveBattle,
  summarizeTeamDay,
  warState,
  type ApiResult,
  type AttackResponse,
  type MapDef,
  type Player,
  type TeamDay,
  type TeamId,
  type WarState,
} from '@invade/engine';
import type { GameRow, Repo } from './handlers';
import { hashToken } from './tokens';

export interface WarContext {
  map: MapDef;
  game: GameRow;
  players: Player[];
  teams: Record<TeamId, TeamDay>;
  war: WarState;
  today: string;
}

/** Everything needed to reason about the war right now, derived from facts (decision 10). */
export async function loadWarContext(repo: Repo, game: GameRow, now: Date): Promise<WarContext> {
  const today = gameDayOf(now, game.settings.timezone);
  const [players, reports, battles] = await Promise.all([
    repo.listPlayers(game.id),
    repo.listStepReports(game.id, today),
    repo.listBattles(game.id),
  ]);
  const teams = {
    white: summarizeTeamDay('white', players, reports, today),
    black: summarizeTeamDay('black', players, reports, today),
  };
  const earned = Object.fromEntries([...teams.white.members, ...teams.black.members].map((m) => [m.player.id, m.soldiers]));
  return { map: DEFAULT_MAP, game, players, teams, war: warState(DEFAULT_MAP, players, earned, battles, today), today };
}


const attackSchema = z.object({
  token: z.string().trim().min(8).max(64),
  to: z.string().trim().min(1).max(20),
  soldiers: z.coerce.number().int().min(1).max(1000),
});

/** Fair roll in [0, 1) from the OS random source (never from the client). */
export const serverRoll = () => randomInt(0, 1_000_000) / 1_000_000;

export async function attack(repo: Repo, input: unknown, now: Date, roll: () => number = serverRoll): Promise<ApiResult<AttackResponse>> {
  const parsed = attackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { token, to, soldiers } = parsed.data;

  const found = await repo.findByTokenHash(hashToken(token));
  if (!found) return { ok: false, error: 'Unknown code' };
  const { player, game } = found;

  const ctx = await loadWarContext(repo, game, now);
  const piece = ctx.war.pieces[player.id];
  if (!piece) return { ok: false, error: 'You are not on the map yet' };
  const option = attackOptions(ctx.war, ctx.map, player.id).find((o) => o.to === to);
  if (!option) {
    if (piece.available <= 0) return { ok: false, error: 'No soldiers left today: walk to earn more' };
    return { ok: false, error: 'You can only attack enemy territory next to you' };
  }
  if (soldiers > option.maxAttackers) return { ok: false, error: `You only have ${option.maxAttackers} soldiers available` };

  const r = roll();
  const result = resolveBattle(soldiers, option.defenders, r);
  await repo.insertEvent(game.id, 'battle', {
    playerId: player.id,
    team: player.team,
    from: piece.territoryId,
    to,
    attackers: soldiers,
    defenders: option.defenders,
    p: result.p,
    roll: r,
    won: result.won,
    attackersLeft: result.attackersLeft,
    defendersLeft: result.defendersLeft,
    day: ctx.today,
  });
  return { ok: true, data: { won: result.won, p: result.p, roll: r, to, attackersLeft: result.attackersLeft, defendersLeft: result.defendersLeft } };
}
