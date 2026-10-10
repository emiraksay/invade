import type { GameDay } from './types';

/** The game day (`YYYY-MM-DD`) an instant falls on, in the game's timezone. */
export function gameDayOf(instant: Date, timezone: string): GameDay {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
