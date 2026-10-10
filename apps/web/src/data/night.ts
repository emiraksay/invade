import { DEFAULT_MAP, territoryShare, warState, type BattleRecord, type GameDay, type GameSettings, type MapDef, type Player, type TeamDay, type TeamId } from '@invade/engine';
import { battleShout, spotlightFor, type Spotlight } from './events';

/** One battle of the night, in the order it happened, with the words the big screen shouts. */
export interface RevealAct extends Spotlight {
  won: boolean;
  odds: number;
  at: string;
  territory: string;
}

export interface NightReveal {
  day: GameDay;
  attacks: number;
  captures: number;
  acts: RevealAct[];
  /** Territory share in percent before tonight's battles and after them. */
  before: Record<TeamId, number>;
  after: Record<TeamId, number>;
}

const pct = (x: number) => Math.round(x * 100);

/**
 * Decision 5: the night phase is a reveal. Today attacks resolve the moment they are made, so the
 * reveal replays the day's battles in order and shows what the map looked like before and after.
 * Pure: everything comes from the engine's battle records.
 */
export function nightReveal(input: {
  battles: readonly BattleRecord[];
  players: readonly Player[];
  teams: Record<TeamId, TeamDay>;
  settings: Pick<GameSettings, 'teamNames'>;
  day: GameDay;
  map?: MapDef;
}): NightReveal {
  const { battles, players, teams, settings, day, map = DEFAULT_MAP } = input;
  const tonight = battles.filter((b) => b.day === day).sort((a, b) => a.id - b.id);
  const earlier = battles.filter((b) => !tonight.includes(b));
  const earned = Object.fromEntries([...teams.white.members, ...teams.black.members].map((m) => [m.player.id, m.soldiers]));
  const share = (list: readonly BattleRecord[]): Record<TeamId, number> => {
    const war = warState(map, players, earned, list, day);
    return { white: pct(territoryShare(war, 'white')), black: pct(territoryShare(war, 'black')) };
  };
  const acts = tonight.map((b) => {
    const shout = battleShout(b, map);
    return { ...spotlightFor(shout, players, settings.teamNames), won: b.won, odds: b.p, at: b.at, territory: shout.territory };
  });
  return { day, attacks: acts.length, captures: acts.filter((a) => a.won).length, acts, before: share(earlier), after: share(battles) };
}
