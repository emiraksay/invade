// The AI General: reads the live map and gives each player one order. Rules first (code), words second
// (Claude). Every number here comes from the engine or the decided rules; the model never computes.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  DEFAULT_MAP,
  STARTING_GARRISON,
  gameDayOf,
  startingPositions,
  summarizeTeamDay,
  teamBonus,
  type ApiResult,
  type GeneralOrder,
  type GeneralResponse,
  type MapDef,
  type Player,
  type PlayerDay,
  type TeamDay,
  type TeamId,
} from '@invade/engine';
import { hashToken } from './tokens';
import type { GameRow, Repo } from './handlers';

/** An enemy territory the player could attack. `odds(n)` = chance of taking it with n soldiers. */
export interface AttackOption {
  territoryId: string;
  territory: string;
  defenders: number;
  odds: (soldiers: number) => number;
}

export const STRONG_ODDS = 0.6;

/**
 * PROVISIONAL until the engine ships `attackOptions(war, map, playerId)`: enemy territories next to the
 * player's piece, defenders = starting garrison + enemy pieces standing there, odds = decision 4
 * (attackers ÷ (attackers + defenders)). Swap this one function for the engine's when it lands.
 */
export function provisionalAttackOptions(
  map: MapDef,
  players: readonly Player[],
  soldiersById: ReadonlyMap<string, number>,
  playerId: string,
): AttackOption[] {
  const me = players.find((p) => p.id === playerId);
  const positions = startingPositions(map, players);
  const here = positions.get(playerId);
  if (!me || !here) return [];
  const territory = map.territories.find((t) => t.id === here);
  if (!territory) return [];
  return territory.neighbors
    .map((id) => map.territories.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.team !== me.team)
    .map((t) => {
      const enemyPieces = players.filter((p) => p.team !== me.team && positions.get(p.id) === t.id);
      const defenders = STARTING_GARRISON + enemyPieces.reduce((s, p) => s + (soldiersById.get(p.id) ?? 0), 0);
      return { territoryId: t.id, territory: t.name, defenders, odds: (n) => (n > 0 ? n / (n + defenders) : 0) };
    });
}

/** Smallest force (≤ available) that reaches STRONG_ODDS, or null if even everything is not enough. */
export function forceFor(option: AttackOption, available: number): number | null {
  for (let n = 1; n <= available; n++) if (option.odds(n) >= STRONG_ODDS) return n;
  return null;
}

export interface OrderFacts {
  me: PlayerDay;
  team: TeamDay;
  options: AttackOption[];
  /** Where my piece stands (for a Hold order). */
  myTerritory: { id: string; name: string } | null;
}

/**
 * The order, by code: (a) a strong attack (odds ≥ 0.6 with my soldiers), the surest one;
 * (b) else the next milestone, flagged when it also unlocks the team bonus; (c) else hold.
 * Pure: same facts, same order.
 */
export function pickOrder({ me, team, options, myTerritory }: OrderFacts): GeneralOrder {
  const available = me.soldiers;
  let best: { opt: AttackOption; n: number; odds: number } | null = null;
  for (const opt of options) {
    const n = forceFor(opt, available);
    if (n === null) continue;
    const odds = opt.odds(n);
    if (!best || odds > best.odds || (odds === best.odds && opt.defenders < best.opt.defenders)) best = { opt, n, odds };
  }
  if (best) {
    return { kind: 'attack', territoryId: best.opt.territoryId, territory: best.opt.territory, soldiers: best.n, defenders: best.opt.defenders, odds: Math.round(best.odds * 100) / 100 };
  }
  if (me.next) {
    const memberSteps = team.members.map((m) => m.steps);
    const i = team.members.findIndex((m) => m.player.id === me.player.id);
    const withMilestone = memberSteps.map((s, j) => (j === i ? Math.max(s, me.next!.milestone.steps) : s));
    return { kind: 'walk', stepsToGo: me.next.stepsToGo, gain: me.next.gain, unlocksBonus: teamBonus(withMilestone) > teamBonus(memberSteps) };
  }
  return { kind: 'hold', territoryId: myTerritory?.id ?? '', territory: myTerritory?.name ?? 'your ground' };
}

const fmt = new Intl.NumberFormat('de-DE');

/** Fallback lines when the model is unavailable: correct, in the General's voice, a bit flat. */
export function templateLines(order: GeneralOrder, name: string): string[] {
  switch (order.kind) {
    case 'attack':
      return [`${name}, attack ${order.territory} with ${order.soldiers}. ${Math.round(order.odds * 100)}% to take it.`, `${order.defenders} defenders. Go now.`];
    case 'walk':
      return [`${name}, walk ${fmt.format(order.stepsToGo)} steps: +${order.gain} soldiers${order.unlocksBonus ? ' and the team bonus' : ''}.`, 'Boots on. The map does not fill itself.'];
    case 'hold':
      return [`${name}, hold ${order.territory}. Max army today, nothing to attack yet.`, 'Rest. Tonight we move.'];
  }
}

export type GeneralWriter = (order: GeneralOrder, name: string, teamName: string) => Promise<string[]>;

const Output = z.object({ lines: z.array(z.string().min(1)).min(1).max(2) });
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: { lines: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 } },
  required: ['lines'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are the General of a team in Invade, a game where friends walk in real life to earn soldiers and fight over a shared map of Barcelona neighbourhoods at night. You receive ONE order that the game already decided, with its exact numbers (territory, soldiers, defenders, win odds, steps to go, soldiers gained, whether it unlocks the team bonus). Rewrite it as one or two short lines in a commander's voice: punchy, confident, a little dry, addressed to the player by first name. Keep every number exactly as given, never add numbers, places or promises. Max 18 words per line. No emojis. No hashtags.`;

/** Claude writes the words. Structured JSON output; validated with zod. */
export const claudeWriter: GeneralWriter = async (order, name, teamName) => {
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 300,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify({ player: name, team: teamName, order }) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('general: model declined');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return Output.parse(JSON.parse(text)).lines.map((l) => l.trim());
};

const requestSchema = z.union([
  z.object({ token: z.string().trim().min(8).max(64) }),
  z.object({ code: z.string().trim().toUpperCase().min(1).max(20), team: z.enum(['white', 'black']) }),
]);

/** POST /api/general. Facts and order from code; words from `writer` (Claude by default, template when no key or on error). */
export async function general(repo: Repo, input: unknown, now: Date, writer?: GeneralWriter): Promise<ApiResult<GeneralResponse>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  let game: GameRow;
  let team: TeamId;
  let playerId: string | null;
  if ('token' in parsed.data) {
    const found = await repo.findByTokenHash(hashToken(parsed.data.token));
    if (!found) return { ok: false, error: 'Unknown code' };
    game = found.game; team = found.player.team; playerId = found.player.id;
  } else {
    const g = await repo.findGameByCode(parsed.data.code);
    if (!g) return { ok: false, error: 'No game with that code' };
    game = g; team = parsed.data.team; playerId = null;
  }

  const day = gameDayOf(now, game.settings.timezone);
  const [players, reports] = await Promise.all([repo.listPlayers(game.id), repo.listStepReports(game.id, day)]);
  const days: Record<TeamId, TeamDay> = {
    white: summarizeTeamDay('white', players, reports, day),
    black: summarizeTeamDay('black', players, reports, day),
  };
  const soldiersById = new Map<string, number>();
  for (const t of ['white', 'black'] as TeamId[]) for (const m of days[t].members) soldiersById.set(m.player.id, m.soldiers);
  const positions = startingPositions(DEFAULT_MAP, players);
  const territoryOf = (id: string) => {
    const t = DEFAULT_MAP.territories.find((x) => x.id === positions.get(id));
    return t ? { id: t.id, name: t.name } : null;
  };
  const orderFor = (m: PlayerDay): GeneralOrder =>
    pickOrder({ me: m, team: days[team], options: provisionalAttackOptions(DEFAULT_MAP, players, soldiersById, m.player.id), myTerritory: territoryOf(m.player.id) });

  const members = days[team].members;
  if (members.length === 0) return { ok: false, error: 'Nobody on that team yet' };
  let target: PlayerDay;
  if (playerId) {
    target = members.find((m) => m.player.id === playerId) ?? { player: players.find((p) => p.id === playerId)!, steps: 0, soldiers: 0, next: null };
  } else {
    // Team version: the most decisive order on the team: the surest attack, else the closest milestone, else the first member.
    const ranked = members.map((m) => ({ m, o: orderFor(m) }));
    const attack = ranked.filter((r) => r.o.kind === 'attack').sort((a, b) => (b.o as { odds: number }).odds - (a.o as { odds: number }).odds)[0];
    const walk = ranked.filter((r) => r.o.kind === 'walk').sort((a, b) => (a.o as { stepsToGo: number }).stepsToGo - (b.o as { stepsToGo: number }).stepsToGo)[0];
    target = (attack ?? walk ?? ranked[0]!).m;
  }
  const order = orderFor(target);
  const name = target.player.name;
  const teamName = game.settings.teamNames[team];

  const write = writer ?? (process.env.ANTHROPIC_API_KEY?.trim() ? claudeWriter : null);
  let lines: string[] | null = null;
  let usedWriter: GeneralResponse['writer'] = 'template';
  if (write) {
    try {
      lines = await write(order, name, teamName);
      usedWriter = 'claude';
    } catch (e) {
      console.error(`[general] writer failed, using template: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: true, data: { day, team, playerId: target.player.id, name, order, lines: lines?.length ? lines : templateLines(order, name), writer: usedWriter } };
}
