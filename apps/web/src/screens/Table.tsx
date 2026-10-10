import { useSearchParams } from 'react-router-dom';
import { DEFAULT_MAP, type BattleRecord, type GameSettings, type Player, type TeamDay, type TeamId } from '@invade/engine';
import { describeEvent, type MilestoneEvent } from '../data/events';
import { Countdown } from '../components/Countdown';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView } from '../map/model';
import { useGameByCode } from '../data/useGameByCode';
import { useGameDay } from '../data/useGameDay';
import { JoinQr } from '../components/JoinQr';
import { Spotlight } from '../components/Spotlight';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** One team's column on the big screen: total, bonus, members with today's steps and soldiers. */
function TeamColumn({ team, name, align }: { team: TeamDay; name: string; align: 'left' | 'right' }) {
  const light = team.team === 'white';
  return (
    <section style={{ display: 'grid', gap: 14, alignContent: 'start', textAlign: align }}>
      <header>
        <h2 className="display" style={{ margin: 0, fontSize: 40 }}>{name}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700 }}>
          {team.soldiers} <span style={{ fontSize: 18, fontWeight: 400 }} className="muted">soldiers today</span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          {fmt.format(team.steps)} steps{team.bonus > 0 && <> · +{team.bonus} team bonus</>}
        </p>
      </header>
      {team.members.length === 0 && <p className="muted" style={{ margin: 0 }}>Nobody yet.</p>}
      {[...team.members].sort((a, b) => b.soldiers - a.soldiers || b.steps - a.steps).map((m) => (
        <div key={m.player.id} className="item" style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row', fontSize: 18 }}>
          <span className={`avatar avatar-${team.team}`} style={{ width: 34, height: 34 }} />
          <strong style={{ flex: 1 }}>{m.player.name}</strong>
          <span className="muted">{fmt.format(m.steps)}</span>
          <span style={{ width: 56, display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: align === 'right' ? 'flex-start' : 'flex-end', color: light ? '#fff' : '#d9d9d9' }}>
            {m.soldiers} <img src={helmet} alt="soldiers" height={15} />
          </span>
        </div>
      ))}
    </section>
  );
}

export interface TableViewProps {
  teams: Record<TeamId, TeamDay>;
  /** Every battle so far (oldest first) and today's game day: the map replays the war from them. */
  battles?: BattleRecord[];
  today?: string;
  settings: GameSettings;
  live: boolean;
  code: string;
  players?: Player[];
  events?: MilestoneEvent[];
}

/** The last few milestones, newest first: the projector's ticker under the map. */
function Feed({ events, players, timezone }: { events: MilestoneEvent[]; players: Player[]; timezone: string }) {
  if (events.length === 0) return <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 15 }}>No milestones yet today.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, fontSize: 16 }}>
      {events.slice(0, 4).map((ev, i) => {
        const d = describeEvent(ev, players, timezone);
        return (
          <li key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', opacity: i === 0 ? 1 : 0.6 }}>
            <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.time}</span>
            <span><strong>{d.name}</strong> crossed {d.steps} steps, <strong>{d.gained}</strong> soldiers for {ev.team === 'white' ? 'White' : 'Black'}</span>
            {i === 0 && <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#e5484d' }} />}
          </li>
        );
      })}
    </ul>
  );
}

/** The big screen itself, pure: given today's teams it renders the countdown, both columns and the battlefield. */
export function TableView({ teams, settings, live, code, players = [], events = [], battles = [], today }: TableViewProps) {
  const view = walkPhaseMapView(DEFAULT_MAP, teams, { battles, today });
  const joinUrl = `${window.location.origin}/join?code=${code}`;
  return (
    <main style={{ minHeight: '100%', padding: '32px 40px', display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ textAlign: 'center' }}>
        <p className="display" style={{ margin: 0, fontSize: 44, letterSpacing: '0.04em' }}>INVADE</p>
        <Countdown timezone={settings.timezone} size={26} />
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(420px, 1.4fr) minmax(260px, 1fr)', gap: 32, alignItems: 'start' }}>
        <TeamColumn team={teams.white} name={settings.teamNames.white} align="left" />
        <div style={{ display: 'grid', gap: 8 }}>
          <Battlefield view={view} bloom />
          <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>● a player and the soldiers they carry today · numbers = garrison</p>
          <Feed events={events} players={players} timezone={settings.timezone} />
        </div>
        <TeamColumn team={teams.black} name={settings.teamNames.black} align="right" />
      </div>
      <Spotlight events={events} players={players} teamNames={settings.teamNames} />
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }} className="muted">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <JoinQr url={joinUrl} />
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="display" style={{ fontSize: 18, color: '#fff' }}>Scan to join</span>
            <span style={{ fontSize: 15 }}>{joinUrl}</span>
            <span style={{ fontSize: 13 }}>Name, team, done. No app, no account.</span>
          </div>
        </div>
        <span aria-live="polite" style={{ fontSize: 14 }}>{live ? '● Live' : '○ Reconnecting…'}</span>
      </footer>
    </main>
  );
}

/**
 * Table view (`/table`): the Figma Base screen, large, for the Mac at the judges' table.
 * No session: it finds the campaign by code (default INVADE, or `?code=`), then shows the same live
 * data the phones see. Updates within a second via Realtime.
 */
export function Table() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? 'INVADE').toUpperCase();
  const lookup = useGameByCode(code);
  const state = useGameDay(lookup.game?.id);

  const error = lookup.error ?? (state.status === 'error' ? state.error : undefined);
  if (error) return <main className="screen"><p className="error">{error}</p></main>;
  if (!lookup.game || state.status !== 'ready' || !state.teams || !state.settings) {
    return <main className="screen"><p className="subtitle">Loading the battlefield…</p></main>;
  }
  return <TableView teams={state.teams} settings={state.settings} live={state.live} code={code} players={state.players} events={state.events} battles={state.battles} today={state.day} />;
}
