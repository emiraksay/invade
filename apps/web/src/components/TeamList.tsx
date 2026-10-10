import { useState } from 'react';
import type { Nudge, PlayerDay, TeamDay } from '@invade/engine';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import caret from '../assets/icons/dropdown-caret.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** Share sheet on phones, clipboard elsewhere. */
async function share(text: string): Promise<'sent' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'sent'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function NudgeNote({ n }: { n: Nudge }) {
  const [state, setState] = useState<'idle' | 'sent' | 'copied' | 'failed'>('idle');
  return (
    <div className="nudge-note">
      <p style={{ margin: 0, fontSize: 13 }} className="muted">
        {fmt.format(n.stepsToGo)} steps to +{n.gain} soldiers{n.unlocksBonus && ' · unlocks the team bonus'}
      </p>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{n.message}</p>
      <button type="button" className="pill" style={{ fontSize: 15, minHeight: 44, justifySelf: 'end' }} onClick={async () => setState(await share(n.message))}>
        {state === 'idle' ? 'Send nudge' : state === 'sent' ? 'Sent' : state === 'copied' ? 'Copied' : 'Try again'}
      </button>
    </div>
  );
}

function Member({ m, rank, team, me, nudge }: { m: PlayerDay; rank: number; team: TeamDay['team']; me: boolean; nudge?: Nudge }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`item ${me ? 'item-me' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
      <button type="button" className="member-row" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="member-rank">{rank}</span>
        <span className={`avatar avatar-${team}`} />
        <strong style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
          {m.player.name}
          {nudge && <span className="nudge-tag">Nudge</span>}
        </strong>
        {/* Steps and soldiers at a glance; the row still opens for the next milestone and the nudge. */}
        <span className="member-glance" aria-label={`${m.steps} steps, ${m.soldiers} soldiers today`}>
          {m.steps > 0 ? fmt.format(m.steps) : '–'} <img src={shoe} alt="" height={14} />
          <span style={{ marginLeft: 6 }}>{m.soldiers}</span> <img src={helmet} alt="" height={14} />
        </span>
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
      {open && nudge && <NudgeNote n={nudge} />}
    </li>
  );
}

/**
 * Figma "Idle" team panel: team name and soldiers, then ranked members that expand to today's stats.
 * Teammates in `nudges` get a NUDGE tag (not red: red means armies/attacks in the Figma LOG);
 * opening their row shows the nudge to send.
 */
export function TeamList({ team, name, myId, dim = false, nudges = {} }: { team: TeamDay; name: string; myId: string; dim?: boolean; nudges?: Record<string, Nudge> }) {
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
        {ranked.map((m, i) => <Member key={m.player.id} m={m} rank={i + 1} team={team.team} me={m.player.id === myId} nudge={nudges[m.player.id]} />)}
      </ol>
    </section>
  );
}
