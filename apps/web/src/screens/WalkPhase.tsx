import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DEFAULT_MAP, summarizePlayerDay } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { LogBar } from '../components/LogBar';
import { MilestoneTrack } from '../components/MilestoneTrack';
import { NavBar, type Tab } from '../components/NavBar';
import { StatsBar } from '../components/StatsBar';
import { TeamList } from '../components/TeamList';
import { TonightCard } from '../components/TonightCard';
import { NudgeCard } from '../components/NudgeCard';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView, type TerritoryView } from '../map/model';
import { loadSession } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { useGameDay } from '../data/useGameDay';

/**
 * ☀️ Walk Phase (Figma "Base" 298:26565 + "LOG" 457:3277): countdown, stats, the battlefield as the
 * scoreboard, OPEN LIST (milestones, nudge, tonight), the LOG bar with Sync, and the navbar.
 * The navbar's profile tab is the Figma "Idle" team panel.
 */
export function WalkPhase() {
  const session = loadSession();
  const state = useGameDay(session?.game.id);
  const [tab, setTab] = useState<Tab>('map');
  const [listOpen, setListOpen] = useState(false);
  const [picked, setPicked] = useState<TerritoryView | null>(null);

  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setListOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listOpen]);

  if (!session) return <Navigate to="/join" replace />;

  if (state.status === 'loading') return <main className="screen"><p className="subtitle">Loading the battlefield…</p></main>;
  if (state.status === 'error' || !state.teams || !state.settings) {
    return <main className="screen"><p className="error">{state.error ?? 'Could not load the game'}</p></main>;
  }

  const { teams, settings } = state;
  const mine = session.player.team;
  const other = mine === 'white' ? 'black' : 'white';
  const myTeam = teams[mine];
  const me = myTeam.members.find((m) => m.player.id === session.player.id) ?? summarizePlayerDay(session.player, 0);
  const view = walkPhaseMapView(DEFAULT_MAP, teams);
  const territories = view.teams[mine].territories;
  const stats = { teamSoldiers: myTeam.soldiers, mySoldiers: me.soldiers, mySteps: me.steps, territories };

  return (
    <main className="screen walk">
      {tab === 'map' ? (
        <>
          <Countdown timezone={settings.timezone} />
          <StatsBar stats={stats} />
          <div className="walk-map">
            <Battlefield view={view} selected={picked?.id} onTap={(t) => setPicked((p) => (p?.id === t.id ? null : t))} />
            <p className="subtitle walk-picked" aria-live="polite">
              {picked
                ? `${picked.name} · ${settings.teamNames[picked.owner]}${picked.isHq ? ' HQ' : ''}${picked.owner === mine ? ' · your side' : ''}`
                : state.live ? '' : '○ Reconnecting…'}
            </p>
          </div>
          <button type="button" className="open-list" onClick={() => setListOpen(true)} aria-haspopup="dialog">
            Open list
          </button>
          <LogBar steps={me.steps} />
        </>
      ) : (
        <div className="walk-scroll">
          <StatsBar stats={stats} active="soldiers" />
          <TeamList team={teams[mine]} name={settings.teamNames[mine]} myId={session.player.id} />
          <TeamList team={teams[other]} name={settings.teamNames[other]} myId={session.player.id} dim />
        </div>
      )}
      <NavBar tab={tab} onTab={(t) => { setTab(t); setListOpen(false); }} />

      {listOpen && (
        <div className="sheet-backdrop" onClick={() => setListOpen(false)}>
          <section className="sheet" role="dialog" aria-modal="true" aria-label="Today" onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="display" style={{ margin: 0, fontSize: 22 }}>Today</h2>
              <button type="button" className="sheet-close" onClick={() => setListOpen(false)} aria-label="Close list">✕</button>
            </header>
            <MilestoneTrack me={me} />
            <NudgeCard token={session.token} />
            <TonightCard teams={teams} settings={settings} myTeam={mine} />
            <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none' }} href={SYNC_SHORTCUT_URL}>
              Sync from Apple Health
            </a>
            <p className="subtitle" aria-live="polite">{state.live ? '● Live' : '○ Reconnecting…'}</p>
          </section>
        </div>
      )}
    </main>
  );
}
