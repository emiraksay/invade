import { describe, expect, it } from 'vitest';
import { eligibleDecrees, type DirectorState } from '@invade/engine';
import { directTheDay, templateAnnouncement, type DirectorWriter } from './director';

const TEAMS = { white: 'White', black: 'Black' };
const state: DirectorState = {
  day: 5,
  daysInWeek: 7,
  points: { white: 0, black: 4 },
  pointsLeft: 3,
  zoneToday: { id: 'z5', name: 'Harbour', points: 1 },
  held: { white: [], black: [{ id: 'z2', name: 'Born' }] },
  players: [
    { id: 'varya', name: 'Varya', team: 'white', recentSteps: [8_000, 9_000] },
    { id: 'emir', name: 'Emir', team: 'black', recentSteps: [9_000, 8_500] },
  ],
  history: [],
};
const options = eligibleDecrees(state);
const indexOf = (kind: string) => options.findIndex((o) => o.decree.kind === kind);

describe('directTheDay', () => {
  it('uses the option the model picked, with its words', async () => {
    const writer: DirectorWriter = async () => ({ option: indexOf('rebellion'), title: 'Born Rises', story: 'Born revolts against Black.' });
    const d = await directTheDay(state, TEAMS, writer);
    expect(d).toEqual({ day: 5, decree: { kind: 'rebellion', zoneId: 'z2' }, title: 'Born Rises', story: 'Born revolts against Black.', writer: 'claude' });
  });

  it('falls back to the engine choice when the model picks a number that is not on the list', async () => {
    const d = await directTheDay(state, TEAMS, async () => ({ option: 99, title: 'X', story: 'Y' }));
    expect(d.writer).toBe('template');
    expect(d.decree).toEqual({ kind: 'rebellion', zoneId: 'z2' }); // the week is decided: the comeback comes first
    expect(d.story).toContain('Born');
  });

  it('falls back when the model fails', async () => {
    const d = await directTheDay(state, TEAMS, async () => { throw new Error('boom'); });
    expect(d.writer).toBe('template');
  });
});

describe('templateAnnouncement', () => {
  it('has a headline and the exact numbers for every kind', () => {
    for (const o of options) {
      const a = templateAnnouncement(o.decree, state, TEAMS);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.story.length).toBeGreaterThan(20);
    }
    expect(templateAnnouncement({ kind: 'duel', a: 'varya', b: 'emir', prize: 4 }, state, TEAMS).story).toBe('Varya vs Emir: whoever walks more today wins 4 soldiers for their team.');
  });
});
