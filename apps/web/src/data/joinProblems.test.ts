import { describe, expect, it } from 'vitest';
import { actionLabel, DEFAULT_GAME_CODE, joinProblem, restoreProblem } from './joinProblems';

describe('joinProblem: the server rule becomes a friendly line and one next tap', () => {
  it('one player per person: a taken name points to the private code', () => {
    const p = joinProblem('Emir is already in this game. Tap "I already joined" and enter your code.', 'white');
    expect(p.action).toEqual({ kind: 'restore' });
    expect(p.message).toMatch(/^Emir is already in this game/);
  });

  it('team capacity: a full team offers the other team', () => {
    const p = joinProblem('Team White is full', 'white');
    expect(p.action).toEqual({ kind: 'otherTeam', team: 'black' });
    expect(p.message).toBe('Team White is full. The black team still has room.');
    expect(actionLabel(p.action!, { black: 'Black' })).toBe('Join Black instead');
  });

  it('one campaign (decision 9): a wrong code offers today\'s code', () => {
    const p = joinProblem('No game with that code', 'black');
    expect(p.action).toEqual({ kind: 'useDefaultCode' });
    expect(p.message).toContain(DEFAULT_GAME_CODE);
  });

  it('network and server hiccups get a retry', () => {
    expect(joinProblem('No connection, try again', 'white').action).toEqual({ kind: 'retry' });
    expect(joinProblem('Something went wrong, try again', null).action).toEqual({ kind: 'retry' });
  });

  it('validation lines stay as they are, with no extra button', () => {
    expect(joinProblem('Name must be under 14 characters', 'white')).toEqual({ message: 'Name must be under 14 characters', action: null });
  });
});

describe('restoreProblem: a private code that is not in any game', () => {
  it('offers joining as a new player', () => {
    for (const e of ['Unknown code', 'Invalid code']) {
      const p = restoreProblem(e);
      expect(p.action).toEqual({ kind: 'joinFresh' });
      expect(actionLabel(p.action!)).toBe('Join as a new player');
    }
  });
  it('keeps the retry for connection problems', () => {
    expect(restoreProblem('No connection, try again').action).toEqual({ kind: 'retry' });
  });
});
