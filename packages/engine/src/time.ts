import type { GameDay } from './types';

/** The game day (`YYYY-MM-DD`) an instant falls on, in the game's timezone. */
export function gameDayOf(instant: Date, timezone: string): GameDay {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Seconds left until the current game day ends (midnight in the game's timezone). */
export function secondsUntilDayEnd(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return 86_400 - (get('hour') * 3600 + get('minute') * 60 + get('second'));
}
