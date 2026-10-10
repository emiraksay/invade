import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DEFAULT_MAP, summarizePlayerDay, type GameSettings, type NudgeResponse, type TeamDay, type TeamId } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { MilestoneTrack } from '../components/MilestoneTrack';
import { StatsBar } from '../components/StatsBar';
import { TeamList } from '../components/TeamList';
import { TonightCard } from '../components/TonightCard';
import { NudgeCard } from '../components/NudgeCard';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView, type TerritoryView } from '../map/model';
import { loadSession, type Session } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { useGameDay } from '../data/useGameDay';

/**
 * ☀️ Walk Phase (Figma "Base" + "LOG"): countdown, stats, the battlefield as the scoreboard,
 * today's milestones, the nudge, the team list behind OPEN LIST, and tonight's next step.
 */
export interface WalkViewProps {
  session: Session;
  teams: Record<TeamId, TeamDay>;
  settings: GameSettings;
  live: boolean;
  /** Dev previews only: a canned nudge response so the card can be seen without the API. */
  nudgePreload?: NudgeResponse;
}

/** The screen itself, pure: everything it shows comes from props. */
export function WalkView({ session, teams, settings, live, nudgePreload }: WalkViewProps) {
  const [listOpen, setListOpen] = useState(false);
  const [picked, setPicked] = useState<TerritoryView | null>(null);
  const myTeam = teams[session.player.team];
  const me = myTeam.members.find((m) => m.player.id === session.player.id) ?? summarizePlayerDay(session.player, 0);
  const view = walkPhaseMapView(DEFAULT_MAP, teams);
  const territories = view.teams[session.player.team].territories;

  return (
    <main className="screen">
      <Countdown timezone={settings.timezone} />
      <StatsBar stats={{ teamSoldiers: myTeam.soldiers, mySoldiers: me.soldiers, mySteps: me.steps, territories }} />
      <Battlefield view={view} selected={picked?.id} onTap={(t) => setPicked((p) => (p?.id === t.id ? null : t))} />
      <p className="subtitle" style={{ minHeight: 20 }} aria-live="polite">
        {picked
          ? `${picked.name} · ${settings.teamNames[picked.owner]}${picked.isHq ? ' HQ' : ''}${picked.owner === session.player.team ? ' · your side' : ''}`
          : 'Tap a territory'}
      </p>
      <MilestoneTrack me={me} />
      <NudgeCard token={session.token} preload={nudgePreload} />
      <button type="button" className="pill pill-block" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
        {listOpen ? 'Close list' : 'Open list'}
      </button>
      {listOpen && (
        <>
          <TeamList team={teams.white} name={settings.teamNames.white} myId={session.player.id} />
          <TeamList team={teams.black} name={settings.teamNames.black} myId={session.player.id} />
        </>
      )}
      <TonightCard teams={teams} settings={settings} myTeam={session.player.team} />

      <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }} href={SYNC_SHORTCUT_URL}>
        Sync from Apple Health
      </a>
      <p className="subtitle" aria-live="polite">{live ? '● Live' : '○ Reconnecting…'}</p>
    </main>
  );
}

export function WalkPhase() {
  const session = loadSession();
  const state = useGameDay(session?.game.id);
  if (!session) return <Navigate to="/join" replace />;
  if (state.status === 'loading') return <main className="screen"><p className="subtitle">Loading the battlefield…</p></main>;
  if (state.status === 'error' || !state.teams || !state.settings) {
    return <main className="screen"><p className="error">{state.error ?? 'Could not load the game'}</p></main>;
  }
  return <WalkView session={session} teams={state.teams} settings={state.settings} live={state.live} />;
}
