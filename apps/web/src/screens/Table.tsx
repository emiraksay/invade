import { useSearchParams } from 'react-router-dom';
import { DEFAULT_MAP, type GameSettings, type TeamDay, type TeamId } from '@invade/engine';
import { Countdown } from '../components/Countdown';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView } from '../map/model';
import { useGameByCode } from '../data/useGameByCode';
import { useGameDay } from '../data/useGameDay';

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
      {team.members.map((m) => (
        <div key={m.player.id} className="item" style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row', fontSize: 18 }}>
          <span className={`avatar avatar-${team.team}`} style={{ width: 34, height: 34 }} />
          <strong style={{ flex: 1 }}>{m.player.name}</strong>
          <span className="muted">{fmt.format(m.steps)}</span>
          <span style={{ width: 52, textAlign: align === 'right' ? 'left' : 'right', color: light ? '#fff' : '#d9d9d9' }}>{m.soldiers} ⚔</span>
        </div>
      ))}
    </section>
  );
}

export interface TableViewProps {
  teams: Record<TeamId, TeamDay>;
  settings: GameSettings;
  live: boolean;
  code: string;
}

/** The big screen itself, pure: given today's teams it renders the countdown, both columns and the battlefield. */
export function TableView({ teams, settings, live, code }: TableViewProps) {
  const view = walkPhaseMapView(DEFAULT_MAP, teams);
  const joinUrl = `${window.location.origin}/join?code=${code}`;
  return (
    <main style={{ minHeight: '100%', padding: '32px 40px', display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ textAlign: 'center' }}>
        <h1 className="display" style={{ margin: 0, fontSize: 44, letterSpacing: '0.04em' }}>INVADE</h1>
        <div style={{ fontSize: 26 }}><Countdown timezone={settings.timezone} /></div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(420px, 1.4fr) minmax(260px, 1fr)', gap: 32, alignItems: 'start' }}>
        <TeamColumn team={teams.white} name={settings.teamNames.white} align="left" />
        <Battlefield view={view} />
        <TeamColumn team={teams.black} name={settings.teamNames.black} align="right" />
      </div>
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }} className="muted">
        <span style={{ fontSize: 16 }}>Join: <strong style={{ color: '#fff' }}>{joinUrl}</strong></span>
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
  return <TableView teams={state.teams} settings={state.settings} live={state.live} code={code} />;
}
