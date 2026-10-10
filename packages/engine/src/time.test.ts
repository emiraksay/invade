import { describe, expect, it } from 'vitest';
import { gameDayOf, secondsUntilDayEnd } from './time';

describe('gameDayOf', () => {
  it('uses the game timezone, not UTC', () => {
    // 23:30 UTC on Oct 9 is already Oct 10 in Barcelona (UTC+2).
    expect(gameDayOf(new Date('2026-10-09T23:30:00Z'), 'Europe/Madrid')).toBe('2026-10-10');
    expect(gameDayOf(new Date('2026-10-09T21:00:00Z'), 'Europe/Madrid')).toBe('2026-10-09');
  });
});

describe('secondsUntilDayEnd', () => {
  it('counts down to midnight in the game timezone', () => {
    // 22:00 UTC = 00:00 Madrid -> a full day left; 21:59:00 UTC = 23:59 Madrid -> 60 s left.
    expect(secondsUntilDayEnd(new Date('2026-10-09T22:00:00Z'), 'Europe/Madrid')).toBe(86_400);
    expect(secondsUntilDayEnd(new Date('2026-10-09T21:59:00Z'), 'Europe/Madrid')).toBe(60);
  });
});
