import { MILESTONES } from '@invade/engine';
import type { MilestoneEvent } from './events';

/** On a first visit (nothing seen yet) only a milestone this recent still gets its arrival screen. */
export const FRESH_MS = 10 * 60_000;

/**
 * The milestone to celebrate with the "soldiers arrive" screen: my newest milestone event that I
 * haven't seen yet. `seenId` is the last event id I tapped through (null on a first visit, when only
 * a fresh event counts, so old ones are never replayed).
 */
export function unseenArrival(events: readonly MilestoneEvent[], myId: string, seenId: number | null, now: number): MilestoneEvent | null {
  const mine = events.filter((e) => e.playerId === myId && e.gained > 0);
  const newest = mine.reduce<MilestoneEvent | null>((best, e) => (!best || e.id > best.id ? e : best), null);
  if (!newest) return null;
  // No memory, or a memory from a reset database (seenId above every id): only a fresh event counts.
  if (seenId === null || seenId > newest.id) return now - Date.parse(newest.at) < FRESH_MS ? newest : null;
  return newest.id > seenId ? newest : null;
}

/** The highest milestone a step total has reached (the one this event crossed), e.g. 10.050 → 10.000. */
export function reachedMilestone(steps: number) {
  return [...MILESTONES].reverse().find((m) => steps >= m.steps) ?? null;
}
