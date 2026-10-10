import { describe, expect, it } from 'vitest';
import { gameDayOf } from './time';

describe('gameDayOf', () => {
  it('uses the game timezone, not UTC', () => {
    // 23:30 UTC on Oct 9 is already Oct 10 in Barcelona (UTC+2).
    expect(gameDayOf(new Date('2026-10-09T23:30:00Z'), 'Europe/Madrid')).toBe('2026-10-10');
    expect(gameDayOf(new Date('2026-10-09T21:00:00Z'), 'Europe/Madrid')).toBe('2026-10-09');
  });
});
