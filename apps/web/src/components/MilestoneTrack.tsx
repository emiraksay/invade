import { MILESTONES, STEP_CAP, type PlayerDay } from '@invade/engine';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** Progress through today's milestones (5k / 10k / 12k), straight from the engine's PlayerDay. */
export function MilestoneTrack({ me }: { me: PlayerDay }) {
  const pct = Math.min(1, me.steps / STEP_CAP) * 100;
  return (
    <section aria-label="Today's milestones" style={{ display: 'grid', gap: 10 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--color-track)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--color-track-fill)', transition: 'width 600ms ease' }} />
        {MILESTONES.map((m) => (
          <span key={m.steps} style={{
            position: 'absolute', top: -5, left: `calc(${(m.steps / STEP_CAP) * 100}% - 9px)`, width: 18, height: 18, borderRadius: '50%',
            background: me.steps >= m.steps ? 'var(--color-text-primary)' : 'var(--color-track)', border: '2px solid var(--color-text-primary)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
        <span>0</span>
        {MILESTONES.map((m) => (
          <span key={m.steps} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {fmt.format(m.steps)} · {m.soldiers} <img src={helmet} alt="soldiers" height={11} style={{ opacity: 0.7 }} />
          </span>
        ))}
      </div>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 15 }}>
        {me.steps === 0 && "You haven't walked yet today. Every step counts."}
        {me.steps > 0 && me.next && <>{fmt.format(me.next.stepsToGo)} steps to <strong>+{me.next.gain} soldiers</strong></>}
        {!me.next && <strong>Max army today. All 10 soldiers earned.</strong>}
      </p>
    </section>
  );
}
