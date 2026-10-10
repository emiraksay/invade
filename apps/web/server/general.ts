// The AI General: reads the live map and gives each player one order. Rules first (code), words second
// (Claude). Every number here comes from the engine or the decided rules; the model never computes.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  DEFAULT_MAP,
  gameDayOf,
  startingPositions,
  summarizeTeamDay,
  teamBonus,
  type ApiResult,
  type GeneralOrder,
  type GeneralResponse,
  type Player,
  type PlayerDay,
  type TeamDay,
  type TeamId,
} from '@invade/engine';
import { hashToken } from './tokens';
import type { GameRow, Repo } from './handlers';

/** An enemy territory the player could attack, as the engine's attackOptions() will return it. */
export interface AttackOption {
  to: string;
  name: string;
  defenders: number;
  maxAttackers: number;
}

export const STRONG_ODDS = 0.6;

/** Decision 4: P(win) = attackers ÷ (attackers + defenders). Replaced by the engine's attackOdds() when it lands. */
export const attackOdds = (attackers: number, defenders: number): number =>
  attackers > 0 ? attackers / (attackers + defenders) : 0;

export interface OrderInput {
  me: PlayerDay;
  team: TeamDay;
  /** From the engine's attackOptions(); empty until the war functions are wired. */
  options: readonly AttackOption[];
  /** Where my piece stands (for a Hold order). */
  territory: string | null;
}

/** Team-bonus threshold the team has not fully reached yet (5k, then 10k), or null when every member is past 10k. */
export function nextBonusThreshold(team: TeamDay): { threshold: number; bonus: number } | null {
  const steps = team.members.map((m) => m.steps);
  if (steps.length === 0) return null;
  const unit = Math.max(1, Math.floor(steps.length / 2));
  const lowest = Math.min(...steps);
  if (lowest < 5_000) return { threshold: 5_000, bonus: unit };
  if (lowest < 10_000) return { threshold: 10_000, bonus: 2 * unit - teamBonus(steps) };
  return null;
}

/**
 * The order, by code, in priority:
 *  a) ATTACK: the option with the best odds using all maxAttackers, if those odds reach 60%;
 *  b) BONUS: I am one of the members below the team's next bonus threshold;
 *  c) WALK: my next milestone;
 *  d) HOLD.
 * Pure: same input, same order.
 */
export function pickOrder({ me, team, options, territory }: OrderInput): GeneralOrder {
  const base = { player: me.player.name, team: me.player.team };
  let best: { opt: AttackOption; odds: number } | null = null;
  for (const opt of options) {
    const odds = attackOdds(opt.maxAttackers, opt.defenders);
    if (!best || odds > best.odds || (odds === best.odds && opt.defenders < best.opt.defenders)) best = { opt, odds };
  }
  if (best && best.odds >= STRONG_ODDS) {
    return { ...base, kind: 'attack', to: best.opt.to, target: best.opt.name, soldiers: best.opt.maxAttackers, defenders: best.opt.defenders, odds: Math.round(best.odds * 100) / 100 };
  }
  const bonus = nextBonusThreshold(team);
  if (bonus && me.steps < bonus.threshold) {
    return { ...base, kind: 'bonus', stepsToGo: bonus.threshold - me.steps, threshold: bonus.threshold, bonus: bonus.bonus };
  }
  if (me.next) return { ...base, kind: 'walk', stepsToGo: me.next.stepsToGo, gain: me.next.gain };
  return { ...base, kind: 'hold', territory: territory ?? 'your ground' };
}

const fmt = new Intl.NumberFormat('de-DE');

/** Fallback when the model is unavailable: correct, in the General's voice, a bit flat. */
export function templateText(o: GeneralOrder): string {
  switch (o.kind) {
    case 'attack': return `${o.player}, strike ${o.target} with ${o.soldiers} soldiers. ${Math.round(o.odds * 100)}% says we take it.`;
    case 'bonus': return `${o.player}, ${fmt.format(o.stepsToGo)} more steps and the whole team earns +${o.bonus}. They are waiting on you.`;
    case 'walk': return `${o.player}, ${fmt.format(o.stepsToGo)} more steps and ${o.gain} fresh soldiers join you.`;
    case 'hold': return `${o.player}, hold ${o.territory}. Max army today. Tonight we move.`;
  }
}

export type GeneralWriter = (order: GeneralOrder) => Promise<string>;

const MAX_CHARS = 140;
const Output = z.object({ text: z.string().min(1) });
const OUTPUT_SCHEMA = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } as const;
const SYSTEM = `You are the General of a team in Invade, a game where friends walk in real life to earn soldiers and fight over a shared map of Barcelona neighbourhoods at night. You receive ONE order the game already decided, with its exact numbers. Rewrite it as one or two short lines in a war-commander's voice: punchy, confident, a little dry, addressing the player by first name. Keep every number exactly as given; never add numbers, places or promises. At most 140 characters in total. No emojis.`;

/** Claude writes the words: one call, 4 s timeout, no retries. Structured JSON, validated. */
export const claudeWriter: GeneralWriter = async (order) => {
  const client = new Anthropic({ timeout: 4_000, maxRetries: 0 });
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 200,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify(order) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('general: model declined');
  const text = Output.parse(JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '')).text.trim();
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1).trimEnd()}…` : text;
};

/** Words cache per (player, order) for 2 minutes: the same order asked twice costs one call. */
const CACHE_MS = 2 * 60_000;
const cache = new Map<string, { text: string; until: number }>();
export function cachedWords(key: string, write: () => Promise<string>, now = Date.now()): Promise<string> {
  const hit = cache.get(key);
  if (hit && hit.until > now) return Promise.resolve(hit.text);
  return write().then((text) => { cache.set(key, { text, until: now + CACHE_MS }); return text; });
}
export const _resetCache = () => cache.clear();

const requestSchema = z.union([
  z.object({ token: z.string().trim().min(8).max(64) }),
  z.object({ code: z.string().trim().toUpperCase().min(1).max(20), team: z.enum(['white', 'black']) }),
]);

export interface WarContext {
  players: Player[];
  days: Record<TeamId, TeamDay>;
  attackOptions: (playerId: string) => AttackOption[];
  territoryOf: (playerId: string) => string | null;
}

/**
 * Today's context for the General. Attack options are EMPTY until the engine's war functions are merged
 * (Emir: "wire attacks when I say"); everything else is live. Swap the two closures for loadWarContext() then.
 */
export async function loadContext(repo: Repo, game: GameRow, day: string): Promise<WarContext> {
  const [players, reports] = await Promise.all([repo.listPlayers(game.id), repo.listStepReports(game.id, day)]);
  const days: Record<TeamId, TeamDay> = {
    white: summarizeTeamDay('white', players, reports, day),
    black: summarizeTeamDay('black', players, reports, day),
  };
  const positions = startingPositions(DEFAULT_MAP, players);
  return {
    players,
    days,
    attackOptions: () => [],
    territoryOf: (id) => DEFAULT_MAP.territories.find((t) => t.id === positions.get(id))?.name ?? null,
  };
}

const gainOf = (o: GeneralOrder) => (o.kind === 'bonus' ? o.bonus : o.kind === 'walk' ? o.gain : 0);

/** The team's strongest order: the best attack, else the biggest walking gain (fewest steps on a tie), else hold. */
export function teamOrder(orders: readonly GeneralOrder[]): GeneralOrder | null {
  const attacks = orders.filter((o): o is Extract<GeneralOrder, { kind: 'attack' }> => o.kind === 'attack').sort((a, b) => b.odds - a.odds);
  if (attacks[0]) return attacks[0];
  const walks = orders.filter((o): o is Extract<GeneralOrder, { kind: 'bonus' | 'walk' }> => o.kind === 'bonus' || o.kind === 'walk')
    .sort((a, b) => gainOf(b) - gainOf(a) || a.stepsToGo - b.stepsToGo);
  return walks[0] ?? orders[0] ?? null;
}

/** POST /api/general. Order from code; words from `writer` (Claude by default, template when no key or on error). */
export async function general(repo: Repo, input: unknown, now: Date, writer?: GeneralWriter, load: typeof loadContext = loadContext): Promise<ApiResult<GeneralResponse>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  let game: GameRow; let team: TeamId; let playerId: string | null;
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
  const ctx = await load(repo, game, day);
  const members = ctx.days[team].members;
  const orderFor = (m: PlayerDay) => pickOrder({ me: m, team: ctx.days[team], options: ctx.attackOptions(m.player.id), territory: ctx.territoryOf(m.player.id) });

  let order: GeneralOrder | null;
  if (playerId) {
    const me = members.find((m) => m.player.id === playerId)
      ?? { player: ctx.players.find((p) => p.id === playerId)!, steps: 0, soldiers: 0, next: { milestone: { steps: 5_000, soldiers: 4 }, stepsToGo: 5_000, gain: 4 } };
    order = orderFor(me);
  } else {
    order = teamOrder(members.map(orderFor));
  }
  if (!order) return { ok: false, error: 'Nobody on that team yet' };

  const write = writer ?? (process.env.ANTHROPIC_API_KEY?.trim() ? claudeWriter : null);
  let text = templateText(order);
  let usedWriter: GeneralResponse['writer'] = 'template';
  if (write) {
    try {
      text = await cachedWords(`${playerId ?? team}:${JSON.stringify(order)}`, () => write(order!), now.getTime());
      usedWriter = 'claude';
    } catch (e) {
      console.error(`[general] writer failed, using template: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: true, data: { day, order, text, writer: usedWriter } };
}
