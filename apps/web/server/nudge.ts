// The Nudge: who on my team is short of their next milestone, and a personal line to send them.
// Rules first (code), words second (Claude). The model never decides numbers; it only writes.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  gameDayOf,
  summarizeTeamDay,
  teamBonus,
  type ApiResult,
  type Nudge,
  type NudgeResponse,
  type TeamDay,
} from '@invade/engine';
import { hashToken } from './tokens';
import type { Repo } from './handlers';

export const MAX_NUDGES = 3;

/** The facts about one teammate who still has a milestone to reach today. */
export type NudgeFacts = Omit<Nudge, 'message'>;

/**
 * Who to nudge: teammates (not me) who have not reached today's cap, those who would unlock the team
 * bonus first, then the closest to their next milestone. Pure: same TeamDay, same list.
 */
export function nudgeTargets(team: TeamDay, myPlayerId: string): NudgeFacts[] {
  const memberSteps = team.members.map((m) => m.steps);
  const currentBonus = teamBonus(memberSteps);
  const facts: NudgeFacts[] = [];
  team.members.forEach((m, i) => {
    if (m.player.id === myPlayerId || !m.next) return;
    const withMilestone = memberSteps.map((s, j) => (j === i ? Math.max(s, m.next!.milestone.steps) : s));
    facts.push({
      playerId: m.player.id,
      name: m.player.name,
      steps: m.steps,
      stepsToGo: m.next.stepsToGo,
      gain: m.next.gain,
      unlocksBonus: teamBonus(withMilestone) > currentBonus,
    });
  });
  return facts
    .sort((a, b) => Number(b.unlocksBonus) - Number(a.unlocksBonus) || a.stepsToGo - b.stepsToGo)
    .slice(0, MAX_NUDGES);
}

const fmt = new Intl.NumberFormat('de-DE');

/** Fallback text when the model is unavailable: correct, friendly, a bit flat. */
export function templateMessage(f: NudgeFacts): string {
  const start = f.steps === 0 ? `${f.name}, no steps logged yet today.` : `${f.name}, you're ${fmt.format(f.stepsToGo)} steps from +${f.gain} soldiers.`;
  const bonus = f.unlocksBonus ? ' Hit it and the whole team gets the bonus.' : '';
  return `${start}${bonus} A walk round the block does it. ⚔️`;
}

/** Writes one message per teammate. Returns playerId -> message; missing ids fall back to the template. */
export type NudgeWriter = (facts: NudgeFacts[], teamName: string, senderName: string) => Promise<Record<string, string>>;

const NudgeOutput = z.object({
  nudges: z.array(z.object({ playerId: z.string(), message: z.string() })),
});
/** The same shape as a JSON schema for the API's structured output (the SDK's Zod helper needs Zod 4; the app is on Zod 3). */
const NUDGE_SCHEMA = {
  type: 'object',
  properties: {
    nudges: {
      type: 'array',
      items: {
        type: 'object',
        properties: { playerId: { type: 'string' }, message: { type: 'string' } },
        required: ['playerId', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['nudges'],
  additionalProperties: false,
} as const;

const SYSTEM = `You write nudges for Invade, a game where friends in two teams walk in real life: every step today becomes soldiers their team uses tonight to take a shared map. Daily milestones: 5,000 steps = 4 soldiers, 10,000 = 8, 12,000 = 10 (the cap). When every member of a team reaches a milestone, the team earns a bonus.

You receive facts about teammates who still have a milestone to reach today. For each one, write ONE message the sender will send them (WhatsApp, iMessage): warm, playful, a little competitive, never shaming. Address the player by first name. Use the exact numbers given (steps to go, soldiers gained). Mention the team bonus only when unlocksBonus is true. If steps is 0, they have not synced or walked yet: say so lightly. Max 22 words. At most one emoji. Do not invent facts.`;

/** Claude writes the words. Uses structured output so the result is always valid JSON. */
export const claudeWriter: NudgeWriter = async (facts, teamName, senderName) => {
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: NUDGE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ sender: senderName, team: teamName, teammates: facts }),
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Error('nudge: model declined');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  const out = NudgeOutput.parse(JSON.parse(text));
  return Object.fromEntries(out.nudges.map((n) => [n.playerId, n.message.trim()]));
};

const tokenSchema = z.object({ token: z.string().trim().min(8).max(64) });

/**
 * POST /api/nudge. Facts from the engine; words from `writer` (Claude by default, template when no key or on error).
 */
export async function nudge(repo: Repo, input: unknown, now: Date, writer?: NudgeWriter): Promise<ApiResult<NudgeResponse>> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid code' };
  const found = await repo.findByTokenHash(hashToken(parsed.data.token));
  if (!found) return { ok: false, error: 'Unknown code' };
  const { player, game } = found;

  const day = gameDayOf(now, game.settings.timezone);
  const [players, reports] = await Promise.all([repo.listPlayers(game.id), repo.listStepReports(game.id, day)]);
  const team = summarizeTeamDay(player.team, players, reports, day);
  const facts = nudgeTargets(team, player.id);
  if (facts.length === 0) return { ok: true, data: { day, team: player.team, nudges: [], writer: 'template' } };

  const write = writer ?? (process.env.ANTHROPIC_API_KEY?.trim() ? claudeWriter : null);
  let written: Record<string, string> = {};
  let usedWriter: NudgeResponse['writer'] = 'template';
  if (write) {
    try {
      written = await write(facts, game.settings.teamNames[player.team], player.name);
      usedWriter = 'claude';
    } catch (e) {
      console.error(`[nudge] writer failed, using template: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const nudges: Nudge[] = facts.map((f) => ({ ...f, message: written[f.playerId]?.trim() || templateMessage(f) }));
  return { ok: true, data: { day, team: player.team, nudges, writer: usedWriter } };
}
