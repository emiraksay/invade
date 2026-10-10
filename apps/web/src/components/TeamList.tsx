import type { TeamDay } from '@invade/engine';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';
import shoe from '../assets/icons/stat-steps-shoe.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** Figma "Idle" team panel: members with today's steps and soldiers, plus the team bonus. */
export function TeamList({ team, name, myId }: { team: TeamDay; name: string; myId: string }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 22 }}>{name}</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {team.soldiers} <img src={helmet} alt="soldiers" height={15} /> {team.bonus > 0 && <span className="muted">(+{team.bonus} team bonus)</span>}
        </span>
      </header>
      {team.members.length === 0 && <p className="muted" style={{ margin: 0 }}>Nobody has joined yet.</p>}
      {team.members.map((m) => (
        <div key={m.player.id} className={`item ${m.player.id === myId ? 'item-me' : ''}`}>
          <span className={`avatar avatar-${team.team}`} />
          <strong style={{ flex: 1 }}>{m.player.name}</strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{fmt.format(m.steps)} <img src={shoe} alt="steps" height={13} style={{ opacity: 0.7 }} /></span>
          <span style={{ width: 48, display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>{m.soldiers} <img src={helmet} alt="soldiers" height={14} /></span>
        </div>
      ))}
    </section>
  );
}
