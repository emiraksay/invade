import { attackOptions, type AttackOption, type BattleRecord } from '@invade/engine';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DEFAULT_MAP, summarizePlayerDay, type GameSettings, type GeneralResponse, type Nudge, type NudgeResponse, type Player, type TeamDay, type TeamId } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { MilestoneTrack } from '../components/MilestoneTrack';
import { NavBar, type Tab } from '../components/NavBar';
import { StatsBar } from '../components/StatsBar';
import { TeamList } from '../components/TeamList';
import { TonightCard } from '../components/TonightCard';
import { GeneralOrders } from '../components/GeneralOrders';
import { DemoSync } from '../components/DemoSync';
import { AttackSheet } from '../components/AttackSheet';
import { SettingsPanel } from '../components/SettingsPanel';
import { SoldiersArrive } from '../components/SoldiersArrive';
import { unseenArrival } from '../data/arrivals';
import { LogBar } from '../components/LogBar';
import type { MilestoneEvent } from '../data/events';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView, type TerritoryView } from '../map/model';
import { loadSession, type Session } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { useGameDay } from '../data/useGameDay';
import { api } from '../data/api';

export interface WalkViewProps {
  session: Session;
  teams: Record<TeamId, TeamDay>;
  settings: GameSettings;
  live: boolean;
  players?: Player[];
  events?: MilestoneEvent[];
  /** Every battle so far (oldest first) and today's game day: the map replays the war from them. */
  battles?: BattleRecord[];
  day?: string;
  /** Dev previews only: canned responses so the cards can be seen without the API. */
  nudgePreload?: NudgeResponse;
  generalPreload?: GeneralResponse;
}

const byPlayer = (r?: NudgeResponse): Record<string, Nudge> => Object.fromEntries((r?.nudges ?? []).map((n) => [n.playerId, n]));

/**
 * ☀️ Walk Phase (Figma "Base" 298:26565 + "LOG" 457:3277). Pure apart from loading the nudges: everything else comes from props.
 * Map tab: countdown, stats, the battlefield as the scoreboard, OPEN LIST (milestones, tonight,
 * sync) and the LOG bar, with no scrolling. The floating navbar switches to the Figma "Idle" team
 * panel and to Settings (Apple Health sync, SFX / Music / Notification). Teammates who need a nudge
 * get a NUDGE tag by their name (and a dot on the helmet); their row holds the message to send.
 */
export function WalkView({ session, teams, settings, live, players = [], events = [], battles = [], day, nudgePreload, generalPreload }: WalkViewProps) {
  const [tab, setTab] = useState<Tab>('map');
  const [listOpen, setListOpen] = useState(false);
  const [picked, setPicked] = useState<TerritoryView | null>(null);
  // Attack: tap my piece -> attackable territories light up -> tap one -> the sheet.
  const [aiming, setAiming] = useState(false);
  const [target, setTarget] = useState<AttackOption | null>(null);
  // Last milestone event I tapped through on the "soldiers arrive" screen (per player, on this phone).
  const seenKey = `invade:seen-arrival:${session.game.id}:${session.player.id}`;
  const [seenId, setSeenId] = useState<number | null>(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(seenKey); } catch { /* private mode / blocked storage: no memory, fine */ }
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  const [nudges, setNudges] = useState<Record<string, Nudge>>(() => byPlayer(nudgePreload));

  // Who on my team needs a nudge: numbers from the engine, words by Claude (server). Once per open.
  useEffect(() => {
    if (nudgePreload) return;
    let alive = true;
    api.nudge(session.token).then((r) => { if (alive && r.ok) setNudges(byPlayer(r.data)); });
    return () => { alive = false; };
  }, [session.token, nudgePreload]);

  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setListOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listOpen]);

  const mine = session.player.team;
  const other = mine === 'white' ? 'black' : 'white';
  const myTeam = teams[mine];
  const me = myTeam.members.find((m) => m.player.id === session.player.id) ?? summarizePlayerDay(session.player, 0);
  const view = walkPhaseMapView(DEFAULT_MAP, teams, { myId: session.player.id, battles, today: day });
  const territories = view.teams[mine].territories;
  const options = useMemo(() => (aiming ? attackOptions(view.war, DEFAULT_MAP, session.player.id) : []), [aiming, view.war, session.player.id]);
  const targets = useMemo(() => (aiming ? new Set(options.map((o) => o.to)) : null), [aiming, options]);
  const myPiece = view.pieces.find((p) => p.isMe);
  const onTerritory = (t: TerritoryView) => {
    if (aiming) {
      const option = options.find((o) => o.to === t.id);
      if (option) setTarget(option);
      else setAiming(false);
      return;
    }
    setPicked((p) => (p?.id === t.id ? null : t));
  };
  const hint = aiming
    ? !myPiece || myPiece.soldiers <= 0
      ? 'No soldiers yet: walk to 5,000 steps to earn some'
      : options.length ? 'Tap a red territory to attack' : 'No enemy next to you'
    : picked
      ? `${picked.name} · ${settings.teamNames[picked.owner]}${picked.isHq ? ' HQ' : ''}${picked.owner === mine ? ' · your side' : ''}`
      : myPiece ? 'Tap your piece to attack' : '';
  const arrival = unseenArrival(events, session.player.id, seenId, Date.now());
  const stats = { teamSoldiers: myTeam.soldiers, mySoldiers: me.soldiers, mySteps: me.steps, territories };

  return (
    <main className="screen walk">
      {tab === 'map' && (
        <>
          <Countdown timezone={settings.timezone} />
          <StatsBar stats={stats} />
          <div className="walk-map">
            <Battlefield
              view={view}
              selected={aiming ? null : picked?.id}
              onTap={onTerritory}
              targets={targets}
              onPieceTap={() => { setPicked(null); setAiming((a) => !a); }}
            />
            <p className="subtitle walk-picked" aria-live="polite">
              {live ? hint : '○ Reconnecting…'}
            </p>
          </div>
          <button type="button" className="open-list" onClick={() => setListOpen(true)} aria-haspopup="dialog">
            Open list
          </button>
          <LogBar events={events} players={players} timezone={settings.timezone} />
        </>
      )}
      {tab === 'team' && (
        <div className="walk-scroll">
          <StatsBar stats={stats} active={null} />
          <TeamList team={teams[mine]} name={settings.teamNames[mine]} myId={session.player.id} nudges={nudges} />
          <TeamList team={teams[other]} name={settings.teamNames[other]} myId={session.player.id} dim />
        </div>
      )}
      {tab === 'settings' && <div className="walk-scroll"><SettingsPanel /></div>}
      {tab === 'map' && arrival && (
        <SoldiersArrive
          key={arrival.id}
          ev={arrival}
          teamSoldiers={myTeam.soldiers}
          onDone={() => {
            setSeenId(arrival.id); // dismiss first: storage may throw (private mode, Block All Cookies)
            try { localStorage.setItem(seenKey, String(arrival.id)); } catch { /* shown again next load, acceptable */ }
          }}
        />
      )}
      <NavBar tab={tab} alert={Object.keys(nudges).length > 0} onTab={(t) => { setTab(t); setListOpen(false); }} />

      {target && (
        <AttackSheet
          key={target.to}
          token={session.token}
          option={target}
          enemyName={settings.teamNames[other]}
          onClose={() => { setTarget(null); setAiming(false); }}
        />
      )}
      {listOpen && (
        <div className="sheet-backdrop" onClick={() => setListOpen(false)}>
          <section className="sheet" role="dialog" aria-modal="true" aria-label="Today" onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="display" style={{ margin: 0, fontSize: 22 }}>Today</h2>
              <button type="button" className="sheet-close" onClick={() => setListOpen(false)} aria-label="Close list">✕</button>
            </header>
            <GeneralOrders token={session.token} refreshKey={`${myTeam.soldiers}:${teams[other].soldiers}:${events[0]?.id ?? 0}:${battles.length}`} preload={generalPreload} />
            <MilestoneTrack me={me} />
            <TonightCard teams={teams} settings={settings} myTeam={mine} />
            <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }} href={SYNC_SHORTCUT_URL}>
              Sync from Apple Health
            </a>
            <DemoSync token={session.token} steps={me.steps} />
            <p className="subtitle" aria-live="polite">{live ? '● Live' : '○ Reconnecting…'}</p>
          </section>
        </div>
      )}
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
  return <WalkView session={session} teams={state.teams} settings={state.settings} live={state.live} players={state.players} events={state.events} battles={state.battles} day={state.day} />;
}
