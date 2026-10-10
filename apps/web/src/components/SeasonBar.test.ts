import { describe, expect, it } from 'vitest';
import { seasonDay } from './SeasonBar';

describe('seasonDay', () => {
  it('Saturday in Madrid is day 6', () => {
    expect(seasonDay(new Date('2026-10-10T12:00:00Z'), 'Europe/Madrid')).toBe(6);
  });

  it('Sunday in Madrid is day 7, even when it is still Saturday in UTC', () => {
    // 23:30 UTC Saturday = 01:30 Sunday in Madrid (CEST, UTC+2)
    expect(seasonDay(new Date('2026-10-10T23:30:00Z'), 'Europe/Madrid')).toBe(7);
  });

  it('Monday is day 1', () => {
    expect(seasonDay(new Date('2026-10-12T10:00:00Z'), 'Europe/Madrid')).toBe(1);
  });
});
