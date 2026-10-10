import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DEFAULT_MAP, summarizePlayerDay } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { MilestoneTrack } from '../components/MilestoneTrack';
import { StatsBar } from '../components/StatsBar';
import { TeamList } from '../components/TeamList';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView } from '../map/model';
import { loadSession } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { useGameDay } from '../data/useGameDay';

/**
 * ☀️ Walk Phase (Figma "Base" + "LOG"): countdown, stats, the battlefield as the scoreboard,
 * today's milestones, and the team list behind OPEN LIST.
 */
export function WalkPhase() {
  const session = loadSession();
  const state = useGameDay(session?.game.id);
  const [listOpen, setListOpen] = useState(false);
  if (!session) return <Navigate to="/join" replace />;

  if (state.status === 'loading') return <main className="screen"><p className="subtitle">Loading the battlefield…</p></main>;
  if (state.status === 'error' || !state.teams || !state.settings) {
    return <main className="screen"><p className="error">{state.error ?? 'Could not load the game'}</p></main>;
  }

  const { teams, settings } = state;
  const myTeam = teams[session.player.team];
  const me = myTeam.members.find((m) => m.player.id === session.player.id) ?? summarizePlayerDay(session.player, 0);
  const view = walkPhaseMapView(DEFAULT_MAP, teams);
  const territories = view.teams[session.player.team].territories;

  return (
    <main className="screen">
      <Countdown timezone={settings.timezone} />
      <StatsBar stats={{ teamSoldiers: myTeam.soldiers, mySoldiers: me.soldiers, mySteps: me.steps, territories }} />
      <Battlefield view={view} />
      <MilestoneTrack me={me} />
      <button type="button" className="pill pill-block" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
        {listOpen ? 'Close list' : 'Open list'}
      </button>
      {listOpen && (
        <>
          <TeamList team={teams.white} name={settings.teamNames.white} myId={session.player.id} />
          <TeamList team={teams.black} name={settings.teamNames.black} myId={session.player.id} />
        </>
      )}

      <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none' }} href={SYNC_SHORTCUT_URL}>
        Sync from Apple Health
      </a>
      <p className="subtitle" aria-live="polite">{state.live ? '● Live' : '○ Reconnecting…'}</p>
    </main>
  );
}
