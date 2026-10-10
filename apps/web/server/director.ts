// The AI Director: each morning, one decree for the day. Rules first (code), choice and story second (Claude).
// The engine lists today's allowed decrees with exact parameters; Claude picks one by its number and
// writes the announcement. A pick outside the list, a refusal or an outage falls back to the engine's
// deterministic choice with a template text, so the game never waits on the model. See docs/DIRECTOR.md.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eligibleDecrees, fallbackDecree, leader, type Decree, type DecreeOption, type DirectorState } from '@invade/engine';

export interface DayDecree {
  day: number;
  decree: Decree;
  /** Short headline for the map and the big screen, e.g. "Night March". */
  title: string;
  /** Two or three sentences announcing the decree, in the game's voice. */
  story: string;
  writer: 'claude' | 'template';
}

/** Picks one option (by index) and writes its announcement. */
export type DirectorWriter = (
  state: DirectorState,
  options: readonly DecreeOption[],
  teamNames: Record<'white' | 'black', string>,
) => Promise<{ option: number; title: string; story: string }>;

const nameOf = (state: DirectorState, id: string) => state.players.find((p) => p.id === id)?.name ?? id;

/** Fallback headline and text: correct, a bit flat. */
export function templateAnnouncement(decree: Decree, state: DirectorState, teamNames: Record<'white' | 'black', string>): { title: string; story: string } {
  const zone = state.zoneToday.name;
  switch (decree.kind) {
    case 'night_march':
      return { title: 'Night March', story: `Every step after ${decree.fromHour}:00 counts double today. Save some legs for the evening: ${zone} is decided at midnight.` };
    case 'duel':
      return { title: 'Duel', story: `${nameOf(state, decree.a)} vs ${nameOf(state, decree.b)}: whoever walks more today wins ${decree.prize} soldiers for their team.` };
    case 'all_hands':
      return { title: 'All Hands', story: `A team where every single player walks ${decree.minSteps.toLocaleString('en')} steps today gets +${decree.prize} soldiers. Nobody gets left behind.` };
    case 'double_stakes':
      return { title: 'Double Stakes', story: `${zone} is worth ${decree.points} points today. This one can swing the week.` };
    case 'reinforcements':
      return { title: 'Reinforcements', story: `${teamNames[decree.team]} is behind, so reinforcements arrive: their soldiers count ${decree.percent}% more today.` };
    case 'rebellion': {
      const held = [...state.held.white, ...state.held.black].find((z) => z.id === decree.zoneId)?.name ?? decree.zoneId;
      const lead = leader(state);
      return { title: 'Rebellion', story: `${held} rises up against ${lead ? teamNames[lead] : 'its rulers'}. It is fought for again today, next to ${zone}. The week is not over.` };
    }
    case 'quiet':
      return { title: 'Calm Before the Storm', story: `No decree today. Just ${zone}, two armies and every step you take.` };
  }
}

const DirectorOutput = z.object({ option: z.number().int(), title: z.string().min(1).max(40), story: z.string().min(1).max(400) });
const DIRECTOR_SCHEMA = {
  type: 'object',
  properties: { option: { type: 'integer' }, title: { type: 'string' }, story: { type: 'string' } },
  required: ['option', 'title', 'story'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are the Director of Invade, a week-long game where two teams of friends walk in real life. Each day both teams fight for one zone of the map with the soldiers their steps earned that day (5,000 steps = 4 soldiers, 10,000 = 8, 12,000 = 10). The team with the most zone points on Sunday night wins the week.

Every morning you issue one decree for the day. Your goal: keep the week exciting and close until the final day, and get everyone walking, not only the fittest player.

You receive the state of the week and a numbered list of the decrees the rules allow today, each with the reason it is allowed. Choose exactly one by its number. You cannot change a decree or invent one; only the list counts.

How to choose:
- If one team is running away with the week, prefer a comeback decree when it is offered.
- If the week is close, prefer decrees that raise tension (double stakes late in the week, a duel between two well-matched players).
- Prefer variety: avoid what was issued on recent days.
- A quiet day is fine now and then, but not when something better fits.

Then write the announcement everyone sees on their phone and on the big screen:
- title: 1 to 3 words, like a headline.
- story: 2 or 3 short sentences, dramatic and playful, in the tone of a war chronicle. Use the players' first names and the zone names given. State the decree's exact numbers. Never shame anyone. At most one emoji. Do not invent facts.`;

/** Claude picks and writes. Structured output, so the answer is always valid JSON. */
export const claudeDirector: DirectorWriter = async (state, options, teamNames) => {
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: DIRECTOR_SCHEMA } },
    messages: [{
      role: 'user',
      content: JSON.stringify({
        teams: teamNames,
        week: { day: state.day, of: state.daysInWeek, points: state.points, pointsLeft: state.pointsLeft },
        zoneToday: state.zoneToday,
        held: state.held,
        players: state.players.map((p) => ({ id: p.id, name: p.name, team: p.team, stepsOnPreviousDays: p.recentSteps })),
        recentDecrees: state.history.slice(-3),
        options: options.map((o, i) => ({ number: i, decree: o.decree, why: o.why })),
      }),
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('director: model declined');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return DirectorOutput.parse(JSON.parse(text));
};

/**
 * Today's decree. The engine decides what is allowed; `writer` (Claude by default, none without a key)
 * picks and announces. Anything off the list falls back to the engine's choice and the template.
 */
export async function directTheDay(state: DirectorState, teamNames: Record<'white' | 'black', string>, writer?: DirectorWriter): Promise<DayDecree> {
  const options = eligibleDecrees(state);
  const write = writer ?? (process.env.ANTHROPIC_API_KEY?.trim() ? claudeDirector : null);
  if (write) {
    try {
      const out = await write(state, options, teamNames);
      const picked = options[out.option];
      if (picked) return { day: state.day, decree: picked.decree, title: out.title.trim(), story: out.story.trim(), writer: 'claude' };
      console.error(`[director] model picked option ${out.option} of ${options.length}, using the fallback`);
    } catch (e) {
      console.error(`[director] writer failed, using the fallback: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const decree = fallbackDecree(options, state.day);
  return { day: state.day, decree, ...templateAnnouncement(decree, state, teamNames), writer: 'template' };
}
