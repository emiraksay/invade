// The AI Director, live on today's map war (decision 21). Varya's engine + Claude picker are used as-is
// (packages/engine/src/director.ts, server/director.ts); this file only adapts the map war into a
// DirectorState and stores ONE decree per game day, so every phone and the big screen show the same one.
import { z } from 'zod';
import {
  DEFAULT_MAP,
  eligibleDecrees,
  fallbackDecree,
  type ApiResult,
  type DecreeKind,
  type DirectorState,
} from '@invade/engine';
import { claudeDirector, templateAnnouncement, type DayDecree } from './director';
import type { GameRow, Repo } from './handlers';
import { loadWarContext } from './war';

/** Decrees that make sense on the map war today. Zone/points ones (double stakes, rebellion) and
 *  night march (needs hourly steps) belong to the weekly format and are filtered out. */
const LIVE_KINDS: readonly DecreeKind[] = ['quiet', 'duel', 'all_hands', 'reinforcements'];

/** Builds what the Director looks at from the current war: territories held stand in for points. */
export async function directorStateFor(repo: Repo, game: GameRow, now: Date): Promise<{ state: DirectorState; today: string }> {
  const ctx = await loadWarContext(repo, game, now);
  const held = { white: [] as { id: string; name: string }[], black: [] as { id: string; name: string }[] };
  for (const t of DEFAULT_MAP.territories) held[ctx.war.owner[t.id] ?? t.team].push({ id: t.id, name: t.name });
  const start = game.settings.seasonStart ?? ctx.today;
  const day = Math.min(7, Math.max(1, Math.round((Date.parse(ctx.today) - Date.parse(start)) / 86_400_000) + 1));
  // Today's battleground: a front-line territory, rotating by day so it changes every morning.
  const front = DEFAULT_MAP.territories.filter((t) => t.neighbors.some((n) => ctx.war.owner[n] !== ctx.war.owner[t.id]));
  const zone = front[(day - 1) % Math.max(1, front.length)] ?? DEFAULT_MAP.territories[0]!;
  const state: DirectorState = {
    day,
    daysInWeek: game.settings.campaignDays || 7,
    points: { white: held.white.length, black: held.black.length },
    pointsLeft: DEFAULT_MAP.territories.length,
    zoneToday: { id: zone.id, name: zone.name, points: 1 },
    held,
    players: ctx.players.map((p) => ({ id: p.id, name: p.name, team: p.team, recentSteps: [] })),
    history: [],
  };
  return { state, today: ctx.today };
}

const schema = z.object({ code: z.string().trim().toUpperCase().min(1).max(20) });

/** POST /api/director { code }: today's decree, chosen once by Claude (or the fallback) and then stored. */
export async function director(repo: Repo, input: unknown, now: Date): Promise<ApiResult<DayDecree>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid game code' };
  const game = await repo.findGameByCode(parsed.data.code);
  if (!game) return { ok: false, error: 'No game with that code' };

  const { state, today } = await directorStateFor(repo, game, now);
  const stored = (await repo.listEvents?.(game.id, 'decree'))?.find((e) => (e.payload as { date?: string }).date === today);
  if (stored) return { ok: true, data: stored.payload as DayDecree };

  const options = eligibleDecrees(state).filter((o) => LIVE_KINDS.includes(o.decree.kind));
  let decree: DayDecree;
  try {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('no ANTHROPIC_API_KEY');
    const out = await claudeDirector(state, options, game.settings.teamNames);
    const picked = options[out.option];
    if (!picked) throw new Error(`model picked option ${out.option} of ${options.length}`);
    decree = { day: state.day, decree: picked.decree, title: out.title.trim(), story: out.story.trim(), writer: 'claude' };
  } catch (e) {
    console.error(`[director] using the fallback: ${e instanceof Error ? e.message : String(e)}`);
    const d = fallbackDecree(options, state.day);
    decree = { day: state.day, decree: d, ...templateAnnouncement(d, state, game.settings.teamNames), writer: 'template' };
  }
  await repo.insertEvent(game.id, 'decree', { ...decree, date: today });
  return { ok: true, data: decree };
}
