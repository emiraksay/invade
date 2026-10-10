// Server-side use cases. Pure logic over a `Repo`, so every rule is unit-tested without a database.
// Order in every handler: validate input -> authenticate -> apply engine rules -> write -> respond.
import { z } from 'zod';
import {
  MAX_PLAUSIBLE_DAILY_STEPS,
  gameDayOf,
  soldiersGained,
  stepsToSoldiers,
  type ApiResult,
  type GameSettings,
  type JoinResponse,
  type MeResponse,
  type Player,
  type StepSource,
  type SubmitStepsResponse,
  type TeamId,
} from '@invade/engine';
import { generateToken, hashToken } from './tokens';

export interface GameRow {
  id: string;
  code: string;
  settings: GameSettings;
}

export interface Repo {
  findGameByCode(code: string): Promise<GameRow | null>;
  /** Atomically creates the player and stores the token hash. Throws Error('team_full'). */
  createPlayer(gameId: string, name: string, team: TeamId, tokenHash: string): Promise<Player>;
  findByTokenHash(tokenHash: string): Promise<{ player: Player; game: GameRow } | null>;
  /** Atomic keep-max upsert; returns stored steps before and after. */
  reportSteps(playerId: string, day: string, steps: number, source: StepSource): Promise<{ before: number; after: number }>;
  insertEvent(gameId: string, type: string, payload: unknown): Promise<void>;
}

const fail = (error: string): ApiResult<never> => ({ ok: false, error });

/** First validation issue as a readable message, naming the field when zod's default text is generic. */
const issue = (e: z.ZodError): string => {
  const first = e.issues[0];
  if (!first) return 'Invalid input';
  return first.message === 'Required' && first.path.length ? `${first.path.join('.')} is required` : first.message;
};

const joinSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(20),
  name: z.string().trim().min(1, 'Enter your name').max(14, 'Name must be under 14 characters'),
  team: z.enum(['white', 'black']),
});

export async function join(repo: Repo, input: unknown): Promise<ApiResult<JoinResponse>> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  const { code, name, team } = parsed.data;

  const game = await repo.findGameByCode(code);
  if (!game) return fail('No game with that code');

  const token = generateToken();
  try {
    const player = await repo.createPlayer(game.id, name, team, hashToken(token));
    return { ok: true, data: { player, game: { id: game.id, code: game.code }, token } };
  } catch (e) {
    if (e instanceof Error && e.message.includes('team_full')) {
      return fail(`Team ${game.settings.teamNames[team]} is full`);
    }
    throw e;
  }
}

const tokenSchema = z.object({ token: z.string().trim().min(8).max(64) });

export async function me(repo: Repo, input: unknown): Promise<ApiResult<MeResponse>> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid code');
  const found = await repo.findByTokenHash(hashToken(parsed.data.token));
  if (!found) return fail('Unknown code');
  return { ok: true, data: { player: found.player, game: { id: found.game.id, code: found.game.code } } };
}

const stepsSchema = tokenSchema.extend({
  // Shortcuts may send numbers as strings and with decimals (Health sums); normalise.
  steps: z.coerce.number().finite().min(0).max(MAX_PLAUSIBLE_DAILY_STEPS).transform(Math.floor),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD'),
  source: z.enum(['apple_health', 'demo']).default('apple_health'),
});

const DAY_MS = 86_400_000;

export async function submitSteps(repo: Repo, input: unknown, now: Date): Promise<ApiResult<SubmitStepsResponse>> {
  const parsed = stepsSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  const { token, steps, day, source } = parsed.data;

  const found = await repo.findByTokenHash(hashToken(token));
  if (!found) return fail('Unknown code');
  const { player, game } = found;

  // The server owns the clock: accept only today (game timezone), or ±1 day for late/early syncs.
  const today = gameDayOf(now, game.settings.timezone);
  if (Math.abs(Date.parse(day) - Date.parse(today)) > DAY_MS) return fail(`day must be within one day of ${today}`);

  const { before, after } = await repo.reportSteps(player.id, day, steps, source);
  const gained = soldiersGained(before, after);
  if (gained > 0) {
    await repo.insertEvent(game.id, 'milestone', {
      playerId: player.id, team: player.team, day, steps: after, soldiers: stepsToSoldiers(after), gained,
    });
  }
  return { ok: true, data: { day, steps: after, soldiers: stepsToSoldiers(after), gained } };
}
