// Steps -> soldiers. Numbers come from the cousin's MVP balancing table (Figma "Balancing" frame).
import type { GameDay, Milestone, NextMilestone, Player, PlayerDay, StepReport, TeamDay, TeamId } from './types';

/** Cumulative daily milestones. Steps beyond the last one earn nothing (the daily cap). */
export const MILESTONES: readonly Milestone[] = [
  { steps: 5_000, soldiers: 4 },
  { steps: 10_000, soldiers: 8 },
  { steps: 12_000, soldiers: 10 },
];

export const STEP_CAP = 12_000;
export const MAX_SOLDIERS_PER_PLAYER = 10;

/** Upper bound accepted from a device for one day; anything above is treated as bad data. */
export const MAX_PLAUSIBLE_DAILY_STEPS = 100_000;

export function stepsToSoldiers(steps: number): number {
  let soldiers = 0;
  for (const m of MILESTONES) if (steps >= m.steps) soldiers = m.soldiers;
  return soldiers;
}

export function nextMilestone(steps: number): NextMilestone | null {
  const current = stepsToSoldiers(steps);
  const milestone = MILESTONES.find((m) => steps < m.steps);
  if (!milestone) return null;
  return { milestone, stepsToGo: milestone.steps - steps, gain: milestone.soldiers - current };
}

/**
 * Team bonus when *every* member reaches a milestone: +B at 5k, +2B at 10k,
 * with B = max(1, floor(teamSize / 2)). For a pair that is the MVP's +1 / +2.
 */
export function teamBonus(memberSteps: readonly number[]): number {
  if (memberSteps.length === 0) return 0;
  const unit = Math.max(1, Math.floor(memberSteps.length / 2));
  const lowest = Math.min(...memberSteps);
  if (lowest >= 10_000) return 2 * unit;
  if (lowest >= 5_000) return unit;
  return 0;
}

/** Idempotent merge rule for step reports: the higher cumulative value wins. */
export function mergeSteps(stored: number | null | undefined, incoming: number): number {
  return Math.max(stored ?? 0, incoming);
}

/** Soldiers gained by moving from `before` to `after` steps (0 if no milestone crossed). */
export function soldiersGained(before: number, after: number): number {
  return Math.max(0, stepsToSoldiers(after) - stepsToSoldiers(before));
}

export function summarizePlayerDay(player: Player, steps: number): PlayerDay {
  return { player, steps, soldiers: stepsToSoldiers(steps), next: nextMilestone(steps) };
}

/** Everything the Walk screen needs about one team for one day, derived from stored reports. */
export function summarizeTeamDay(
  team: TeamId,
  players: readonly Player[],
  reports: readonly StepReport[],
  day: GameDay,
): TeamDay {
  const members = players
    .filter((p) => p.team === team)
    .map((p) => {
      const steps = reports
        .filter((r) => r.playerId === p.id && r.day === day)
        .reduce((max, r) => mergeSteps(max, r.steps), 0);
      return summarizePlayerDay(p, steps);
    });
  const memberSteps = members.map((m) => m.steps);
  const memberSoldiers = members.reduce((sum, m) => sum + m.soldiers, 0);
  const bonus = teamBonus(memberSteps);
  const unit = members.length === 0 ? 0 : Math.max(1, Math.floor(members.length / 2));
  return {
    team,
    members,
    steps: memberSteps.reduce((a, b) => a + b, 0),
    memberSoldiers,
    bonus,
    soldiers: memberSoldiers + bonus,
    maxSoldiers: members.length * MAX_SOLDIERS_PER_PLAYER + 2 * unit,
  };
}
