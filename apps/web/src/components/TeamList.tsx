import { useState } from 'react';
import type { PlayerDay, TeamDay } from '@invade/engine';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import caret from '../assets/icons/dropdown-caret.svg';

const fmt = new Intl.NumberFormat('de-DE');

function Member({ m, rank, team, me }: { m: PlayerDay; rank: number; team: TeamDay['team']; me: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`item ${me ? 'item-me' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
      <button type="button" className="member-row" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="member-rank">{rank}</span>
        <span className={`avatar avatar-${team}`} />
        <strong style={{ flex: 1, textAlign: 'left' }}>{m.player.name}</strong>
        <img src={caret} alt="" width={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>
      {open && (
        <dl className="member-stats">
          <div><dt><img src={shoe} alt="Steps today" height={16} /></dt><dd>{fmt.format(m.steps)}</dd></div>
          <div><dt><img src={helmet} alt="Soldiers today" height={16} /></dt><dd>{m.soldiers}</dd></div>
          <div>
            <dt aria-label="Next milestone" style={{ width: 20, textAlign: 'center' }}>→</dt>
            <dd>{m.next ? `${fmt.format(m.next.stepsToGo)} steps to +${m.next.gain}` : 'Max army today'}</dd>
          </div>
        </dl>
      )}
    </li>
  );
}

/** Figma "Idle" team panel: team name and soldiers, then ranked members that expand to today's stats. */
export function TeamList({ team, name, myId, dim = false }: { team: TeamDay; name: string; myId: string; dim?: boolean }) {
  const ranked = [...team.members].sort((a, b) => b.steps - a.steps);
  return (
    <section style={{ display: 'grid', gap: 10, opacity: dim ? 0.55 : 1 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 22 }}>{name}</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
          <img src={helmet} alt="Team soldiers today" height={24} /> {team.soldiers}
        </span>
      </header>
      {team.bonus > 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Includes +{team.bonus} team bonus</p>}
      {team.members.length === 0 && <p className="muted" style={{ margin: 0 }}>Nobody has joined yet.</p>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {ranked.map((m, i) => <Member key={m.player.id} m={m} rank={i + 1} team={team.team} me={m.player.id === myId} />)}
      </ol>
    </section>
  );
}
