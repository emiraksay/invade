// The AI Director: every morning one decree shapes the day so the week stays close until Sunday.
// Code owns the rules: which decrees are allowed today, with which exact parameters, and what each
// one does to the result. Claude only picks one of the allowed options and tells the story.
// See docs/DIRECTOR.md.
import { stepsToSoldiers } from './steps';
import type { TeamId } from './types';

export type DecreeKind = 'quiet' | 'night_march' | 'duel' | 'all_hands' | 'double_stakes' | 'reinforcements' | 'rebellion';

/** One decree, fully specified: everything the resolver needs, nothing left to interpret. */
export type Decree =
  | { kind: 'quiet' }
  /** Steps walked from `fromHour` (local time) to midnight count double, for everyone. */
  | { kind: 'night_march'; fromHour: number }
  /** Two players of similar level, one per team: whoever walks more today wins `prize` soldiers for their team. */
  | { kind: 'duel'; a: string; b: string; prize: number }
  /** A team whose every member walks at least `minSteps` today gets `prize` extra soldiers. Both teams can earn it. */
  | { kind: 'all_hands'; minSteps: number; prize: number }
  /** Today's zone is worth `points` instead of its usual value. */
  | { kind: 'double_stakes'; points: number }
  /** The trailing team's soldiers count `percent`% more today. */
  | { kind: 'reinforcements'; team: TeamId; percent: number }
  /** A zone the leader holds revolts: it is fought for again today, next to the zone of the day. */
  | { kind: 'rebellion'; zoneId: string };

/** A decree the Director may issue today, and why the code allows it (facts for the story). */
export interface DecreeOption {
  decree: Decree;
  why: string;
}

/** A decree that was issued, for the week's history. */
export interface DecreeRecord {
  day: number;
  decree: Decree;
}

export interface DirectorPlayer {
  id: string;
  name: string;
  team: TeamId;
  /** Steps on the previous days of this week, oldest first (empty on day 1). */
  recentSteps: readonly number[];
}

export interface DirectorZone {
  id: string;
  name: string;
}

/** Everything the Director looks at in the morning. Built by the server from the week's facts. */
export interface DirectorState {
  /** 1-based day of the week; `daysInWeek` is the final. */
  day: number;
  daysInWeek: number;
  points: Record<TeamId, number>;
  /** Points still to be played, today's zone included (at its normal value). */
  pointsLeft: number;
  zoneToday: DirectorZone & { points: number };
  held: Record<TeamId, readonly DirectorZone[]>;
  players: readonly DirectorPlayer[];
  /** Decrees already issued this week, oldest first. */
  history: readonly DecreeRecord[];
}

// ---------------------------------------------------------------------------------------------
// Tuning. Small, fixed menus: the model chooses among them, it never invents a number.

export const NIGHT_MARCH_HOURS = [19, 20, 21] as const;
export const DUEL_PRIZE = 4;
/** Duellists' recent averages may differ by at most this share of the larger one. */
export const DUEL_MAX_GAP = 0.35;
export const ALL_HANDS_MIN_STEPS = [4_000, 6_000] as const;
export const ALL_HANDS_PRIZE = 4;
export const REINFORCEMENTS_PERCENT = 50;
/** Points behind (or more) before the trailing team can get reinforcements. */
export const REINFORCEMENTS_MIN_GAP = 2;
/** Comeback decrees (reinforcements, rebellion) allowed per week, in total. */
export const MAX_COMEBACKS_PER_WEEK = 2;
const COMEBACK: readonly DecreeKind[] = ['reinforcements', 'rebellion'];

const other = (t: TeamId): TeamId => (t === 'white' ? 'black' : 'white');
const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The leading team, or null on a tie. */
export function leader(state: Pick<DirectorState, 'points'>): TeamId | null {
  const { white, black } = state.points;
  return white === black ? null : white > black ? 'white' : 'black';
}

/** The week is decided when the trailing team can no longer catch up, even taking every point left. */
export function isDecided(state: Pick<DirectorState, 'points' | 'pointsLeft'>): boolean {
  const lead = leader(state);
  if (!lead) return false;
  return state.points[other(lead)] + state.pointsLeft < state.points[lead];
}

/** The duel pairs worth offering: one player per team, active, of similar level; closest first. */
export function duelPairs(state: Pick<DirectorState, 'players'>, max = 3): Array<{ a: DirectorPlayer; b: DirectorPlayer; gap: number }> {
  const whites = state.players.filter((p) => p.team === 'white' && avg(p.recentSteps) > 0);
  const blacks = state.players.filter((p) => p.team === 'black' && avg(p.recentSteps) > 0);
  const pairs: Array<{ a: DirectorPlayer; b: DirectorPlayer; gap: number }> = [];
  for (const a of whites) for (const b of blacks) {
    const x = avg(a.recentSteps), y = avg(b.recentSteps);
    const gap = Math.abs(x - y) / Math.max(x, y);
    if (gap <= DUEL_MAX_GAP) pairs.push({ a, b, gap });
  }
  pairs.sort((p, q) => p.gap - q.gap || p.a.id.localeCompare(q.a.id) || p.b.id.localeCompare(q.b.id));
  // Nobody duels twice in one offer.
  const used = new Set<string>();
  return pairs.filter((p) => (used.has(p.a.id) || used.has(p.b.id) ? false : (used.add(p.a.id), used.add(p.b.id), true))).slice(0, max);
}

/**
 * The decrees the Director may issue today, with their exact parameters. The rules of fairness
 * live here: no kind twice in a row, comebacks only for the trailing team and at most twice a
 * week, a rebellion only once the week would otherwise be decided. "quiet" is always allowed.
 */
export function eligibleDecrees(state: DirectorState): DecreeOption[] {
  const out: DecreeOption[] = [{ decree: { kind: 'quiet' }, why: 'No decree today: a plain battle.' }];
  const yesterday = state.history.find((h) => h.day === state.day - 1)?.decree.kind;
  const comebacks = state.history.filter((h) => COMEBACK.includes(h.decree.kind)).length;
  const allow = (kind: DecreeKind) => kind !== yesterday && (!COMEBACK.includes(kind) || comebacks < MAX_COMEBACKS_PER_WEEK);
  const lead = leader(state);
  const gap = lead ? state.points[lead] - state.points[other(lead)] : 0;
  const isFinal = state.day === state.daysInWeek;

  if (allow('night_march')) {
    for (const fromHour of NIGHT_MARCH_HOURS) {
      out.push({ decree: { kind: 'night_march', fromHour }, why: `Steps from ${fromHour}:00 count double for everyone.` });
    }
  }
  if (allow('duel')) {
    for (const { a, b } of duelPairs(state)) {
      out.push({
        decree: { kind: 'duel', a: a.id, b: b.id, prize: DUEL_PRIZE },
        why: `${a.name} (${Math.round(avg(a.recentSteps))} a day) vs ${b.name} (${Math.round(avg(b.recentSteps))} a day): closest match this week.`,
      });
    }
  }
  if (allow('all_hands')) {
    for (const minSteps of ALL_HANDS_MIN_STEPS) {
      out.push({ decree: { kind: 'all_hands', minSteps, prize: ALL_HANDS_PRIZE }, why: `A team where everyone walks ${minSteps}+ gets +${ALL_HANDS_PRIZE} soldiers.` });
    }
  }
  // Raise the stakes late in the week, while the result is still open.
  if (allow('double_stakes') && state.day >= 3 && !isDecided(state)) {
    out.push({ decree: { kind: 'double_stakes', points: state.zoneToday.points * 2 }, why: `${state.zoneToday.name} is worth ${state.zoneToday.points * 2} points instead of ${state.zoneToday.points}.` });
  }
  if (lead && allow('reinforcements') && gap >= REINFORCEMENTS_MIN_GAP && !isFinal) {
    const trailing = other(lead);
    out.push({
      decree: { kind: 'reinforcements', team: trailing, percent: REINFORCEMENTS_PERCENT },
      why: `${trailing} is ${gap} points behind: their soldiers count ${REINFORCEMENTS_PERCENT}% more today.`,
    });
  }
  // The plot twist: only when the trailing team could no longer win, so the week stays alive.
  if (lead && allow('rebellion') && isDecided(state)) {
    for (const zone of state.held[lead]) {
      out.push({ decree: { kind: 'rebellion', zoneId: zone.id }, why: `${lead} has the week won. ${zone.name} revolts and is fought for again today.` });
    }
  }
  return out;
}

/** Same decree, same parameters? (The model's pick must match an allowed option exactly.) */
export function sameDecree(a: Decree, b: Decree): boolean {
  return JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
}

/** The model's pick if it is one of today's options, otherwise null (then the fallback is used). */
export function validateDecree(pick: unknown, options: readonly DecreeOption[]): Decree | null {
  if (!pick || typeof pick !== 'object') return null;
  return options.find((o) => sameDecree(o.decree, pick as Decree))?.decree ?? null;
}

/**
 * The decree to use when the model is unavailable or answered nonsense. Deterministic: same state,
 * same decree. Comebacks first when they are allowed, then raise the stakes, then a duel, then a
 * night march, else a quiet day.
 */
export function fallbackDecree(options: readonly DecreeOption[], day: number): Decree {
  const first = (kind: DecreeKind) => options.find((o) => o.decree.kind === kind)?.decree;
  const nights = options.filter((o) => o.decree.kind === 'night_march');
  return (
    first('rebellion') ??
    first('reinforcements') ??
    first('double_stakes') ??
    first('duel') ??
    nights[day % Math.max(1, nights.length)]?.decree ??
    { kind: 'quiet' }
  );
}

// ---------------------------------------------------------------------------------------------
// Resolution: what a decree does to the day's battle. Pure; the server feeds it the day's facts.

export interface DayFacts {
  /** Every player's total steps today. */
  steps: Record<string, number>;
  /** Steps each player walked from the night-march hour to midnight (only needed for night_march). */
  stepsAfterHour?: Record<string, number>;
  players: readonly Pick<DirectorPlayer, 'id' | 'team'>[];
}

export interface DecreeEffect {
  /** Soldiers each team brings to today's battle after the decree. */
  soldiers: Record<TeamId, number>;
  /** What today's zone is worth. */
  points: number;
  /** A zone fought for again today (rebellion), if any. */
  extraZoneId: string | null;
  /** One line per effect for the results screen, e.g. "Duel: Varya won, +4 for White". */
  notes: string[];
}

/**
 * Applies a decree to the day. Base soldiers are the usual milestones per player (`stepsToSoldiers`);
 * team bonuses and other modifiers are added by the caller to `soldiers` before or after, as the
 * weekly rules decide.
 */
export function applyDecree(decree: Decree, facts: DayFacts, zonePoints: number): DecreeEffect {
  const soldiersOf = (id: string) => {
    const steps = facts.steps[id] ?? 0;
    if (decree.kind !== 'night_march') return stepsToSoldiers(steps);
    const late = Math.min(steps, facts.stepsAfterHour?.[id] ?? 0);
    return stepsToSoldiers(steps + late); // the late steps count twice
  };
  const soldiers: Record<TeamId, number> = { white: 0, black: 0 };
  for (const p of facts.players) soldiers[p.team] += soldiersOf(p.id);
  const notes: string[] = [];
  let points = zonePoints;
  let extraZoneId: string | null = null;

  switch (decree.kind) {
    case 'duel': {
      const a = facts.players.find((p) => p.id === decree.a), b = facts.players.find((p) => p.id === decree.b);
      if (!a || !b) break;
      const sa = facts.steps[a.id] ?? 0, sb = facts.steps[b.id] ?? 0;
      if (sa === sb) { notes.push('Duel: a draw, no prize.'); break; }
      const winner = sa > sb ? a : b;
      soldiers[winner.team] += decree.prize;
      notes.push(`Duel: ${winner.id} won, +${decree.prize} for ${winner.team}.`);
      break;
    }
    case 'all_hands': {
      for (const team of ['white', 'black'] as TeamId[]) {
        const members = facts.players.filter((p) => p.team === team);
        if (members.length && members.every((p) => (facts.steps[p.id] ?? 0) >= decree.minSteps)) {
          soldiers[team] += decree.prize;
          notes.push(`All hands: every ${team} player walked ${decree.minSteps}+, +${decree.prize}.`);
        }
      }
      break;
    }
    case 'double_stakes':
      points = decree.points;
      notes.push(`Double stakes: today's zone is worth ${decree.points}.`);
      break;
    case 'reinforcements': {
      const before = soldiers[decree.team];
      soldiers[decree.team] = Math.round(before * (1 + decree.percent / 100));
      notes.push(`Reinforcements: ${decree.team} ${before} → ${soldiers[decree.team]}.`);
      break;
    }
    case 'rebellion':
      extraZoneId = decree.zoneId;
      notes.push(`Rebellion: ${decree.zoneId} is fought for again.`);
      break;
    case 'night_march':
      notes.push(`Night march: steps from ${decree.fromHour}:00 counted double.`);
      break;
    case 'quiet':
      break;
  }
  return { soldiers, points, extraZoneId, notes };
}
