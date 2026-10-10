import { Navigate } from 'react-router-dom';
import { DEFAULT_MAP, summarizePlayerDay } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { MilestoneTrack } from '../components/MilestoneTrack';
import { StatsBar } from '../components/StatsBar';
import { TeamList } from '../components/TeamList';
import { loadSession } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { useGameDay } from '../data/useGameDay';

/**
 * ☀️ Walk Phase (Figma "Base" + "LOG"). Skeleton version: real data end to end.
 * The 3D map replaces the team panels' position as the centrepiece in the next step.
 */
export function WalkPhase() {
  const session = loadSession();
  const state = useGameDay(session?.game.id);
  if (!session) return <Navigate to="/join" replace />;

  if (state.status === 'loading') return <main className="screen"><p className="subtitle">Loading the battlefield…</p></main>;
  if (state.status === 'error' || !state.teams || !state.settings) {
    return <main className="screen"><p className="error">{state.error ?? 'Could not load the game'}</p></main>;
  }

  const { teams, settings } = state;
  const myTeam = teams[session.player.team];
  const me = myTeam.members.find((m) => m.player.id === session.player.id) ?? summarizePlayerDay(session.player, 0);
  const territories = DEFAULT_MAP.territories.filter((t) => t.team === session.player.team).length;

  return (
    <main className="screen">
      <Countdown timezone={settings.timezone} />
      <StatsBar stats={{ teamSoldiers: myTeam.soldiers, mySoldiers: me.soldiers, mySteps: me.steps, territories }} />
      <MilestoneTrack me={me} />
      <TeamList team={teams.white} name={settings.teamNames.white} myId={session.player.id} />
      <TeamList team={teams.black} name={settings.teamNames.black} myId={session.player.id} />

      <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none' }} href={SYNC_SHORTCUT_URL}>
        Sync from Apple Health
      </a>
      <p className="subtitle" aria-live="polite">{state.live ? '● Live' : '○ Reconnecting…'}</p>
    </main>
  );
}
