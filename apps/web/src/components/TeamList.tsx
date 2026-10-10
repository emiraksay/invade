import type { TeamDay } from '@invade/engine';

const fmt = new Intl.NumberFormat('de-DE');

/** Figma "Idle" team panel: members with today's steps and soldiers, plus the team bonus. */
export function TeamList({ team, name, myId }: { team: TeamDay; name: string; myId: string }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 22 }}>{name}</h2>
        <span>{team.soldiers} ⚔ {team.bonus > 0 && <span className="muted">(+{team.bonus} team bonus)</span>}</span>
      </header>
      {team.members.length === 0 && <p className="muted" style={{ margin: 0 }}>Nobody has joined yet.</p>}
      {team.members.map((m) => (
        <div key={m.player.id} className={`item ${m.player.id === myId ? 'item-me' : ''}`}>
          <span className={`avatar avatar-${team.team}`} />
          <strong style={{ flex: 1 }}>{m.player.name}</strong>
          <span>{fmt.format(m.steps)} 👟</span>
          <span style={{ width: 44, textAlign: 'right' }}>{m.soldiers} ⚔</span>
        </div>
      ))}
    </section>
  );
}
