import { describe, expect, it } from 'vitest';
import { FRESH_MS, reachedMilestone, unseenArrival } from './arrivals';
import type { MilestoneEvent } from './events';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const ev = (id: number, playerId: string, agoMs: number, gained = 4): MilestoneEvent => ({
  id, at: new Date(NOW - agoMs).toISOString(), playerId, team: 'white', steps: 10_050, soldiers: 8, gained,
});

describe('unseenArrival', () => {
  it('returns my newest event when it is newer than the last one I saw', () => {
    const events = [ev(5, 'me', 1000), ev(7, 'me', 500), ev(9, 'other', 100)];
    expect(unseenArrival(events, 'me', 5, NOW)?.id).toBe(7);
  });
  it('returns nothing once I have seen my newest event', () => {
    expect(unseenArrival([ev(7, 'me', 500)], 'me', 7, NOW)).toBeNull();
  });
  it('ignores other players and events that gained nothing', () => {
    expect(unseenArrival([ev(3, 'other', 0), ev(4, 'me', 0, 0)], 'me', null, NOW)).toBeNull();
  });
  it('on a first visit only celebrates a fresh event, never an old one', () => {
    expect(unseenArrival([ev(2, 'me', 60_000)], 'me', null, NOW)?.id).toBe(2);
    expect(unseenArrival([ev(2, 'me', FRESH_MS + 1)], 'me', null, NOW)).toBeNull();
  });
});

describe('unseenArrival edge cases', () => {
  it('returns null with no events at all', () => {
    expect(unseenArrival([], 'me', null, NOW)).toBeNull();
    expect(unseenArrival([], 'me', 3, NOW)).toBeNull();
  });
  it('treats a seenId above every event id (database reset) like a first visit', () => {
    expect(unseenArrival([ev(2, 'me', 1000)], 'me', 999, NOW)?.id).toBe(2);
    expect(unseenArrival([ev(2, 'me', FRESH_MS + 1)], 'me', 999, NOW)).toBeNull();
  });
  it('picks the newest of my events even when they are not sorted', () => {
    expect(unseenArrival([ev(9, 'me', 100), ev(4, 'me', 5000), ev(7, 'me', 300)], 'me', 4, NOW)?.id).toBe(9);
  });
  it('never celebrates an event with an unparseable timestamp on a first visit', () => {
    expect(unseenArrival([{ ...ev(2, 'me', 0), at: 'not a date' }], 'me', null, NOW)).toBeNull();
  });
});

describe('reachedMilestone', () => {
  it('finds the highest milestone reached', () => {
    expect(reachedMilestone(10_050)?.steps).toBe(10_000);
    expect(reachedMilestone(12_900)?.steps).toBe(12_000);
    expect(reachedMilestone(4_999)).toBeNull();
    expect(reachedMilestone(5_000)?.steps).toBe(5_000);
    expect(reachedMilestone(12_001)?.steps).toBe(12_000);
  });
});
