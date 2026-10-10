import type { TeamId } from '@invade/engine';

/** Decision 9: one campaign today, created by supabase/seed.sql. */
export const DEFAULT_GAME_CODE = 'INVADE';

/**
 * What the sign-in screen offers after a failed join or restore. The server enforces the rules
 * (one player per person, team capacity, one campaign, private codes); this only turns its answer
 * into a friendly line and the one tap that gets the player back on track.
 */
export type JoinAction =
  | { kind: 'retry' }                         // network or server hiccup: same request again
  | { kind: 'restore' }                       // name already in the game (#35): continue with the private code
  | { kind: 'otherTeam'; team: TeamId }       // this team is full: the other one has room
  | { kind: 'useDefaultCode' }                // typo in the code: today's game is INVADE
  | { kind: 'joinFresh' };                    // private code unknown: join as a new player

export interface JoinProblem {
  message: string;
  action: JoinAction | null;
}

const other = (team: TeamId): TeamId => (team === 'white' ? 'black' : 'white');

/** After POST /api/join failed with `error`, for the team the player picked. */
export function joinProblem(error: string, team: TeamId | null): JoinProblem {
  if (/already in this game/i.test(error)) {
    const who = error.split(' is already')[0];
    return { message: `${who} is already in this game. If that's you, continue with your private code.`, action: { kind: 'restore' } };
  }
  if (/^Team .* is full$/i.test(error) && team) {
    return { message: `${error}. The ${other(team)} team still has room.`, action: { kind: 'otherTeam', team: other(team) } };
  }
  if (/^No game with that code$/i.test(error)) {
    return { message: `No game with that code. Today's game is ${DEFAULT_GAME_CODE}.`, action: { kind: 'useDefaultCode' } };
  }
  if (/try again/i.test(error)) return { message: error, action: { kind: 'retry' } };
  return { message: error, action: null };
}

/** After POST /api/me failed with `error` while restoring with a private code. */
export function restoreProblem(error: string): JoinProblem {
  if (/^(Unknown|Invalid) code$/i.test(error)) {
    return {
      message: 'That private code is not in any game. Check it on your other device (Connect screen), or join as a new player.',
      action: { kind: 'joinFresh' },
    };
  }
  if (/try again/i.test(error)) return { message: error, action: { kind: 'retry' } };
  return { message: error, action: null };
}

/** The label on the single follow-up button under the message. */
export function actionLabel(action: JoinAction, teamNames?: Partial<Record<TeamId, string>>): string {
  switch (action.kind) {
    case 'retry': return 'Try again';
    case 'restore': return 'I already joined';
    case 'otherTeam': return `Join ${teamNames?.[action.team] ?? action.team} instead`;
    case 'useDefaultCode': return `Use code ${DEFAULT_GAME_CODE}`;
    case 'joinFresh': return 'Join as a new player';
  }
}
