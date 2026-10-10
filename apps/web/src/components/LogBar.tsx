import { useEffect, useState } from 'react';
import type { Player } from '@invade/engine';
import { describeEvent, type MilestoneEvent } from '../data/events';
import shoe from '../assets/icons/stat-steps-shoe.svg';

/**
 * Figma LOG bar (457:3277), the strip at the bottom of the Base screen: the latest milestone of the day,
 * "11:12 · Emir · 10.000 · +4", with arrows to walk back through earlier ones. The red dot pulses when
 * the newest event is under a minute old, so a sync on stage shows up here too.
 */
export function LogBar({ events, players, timezone }: { events: MilestoneEvent[]; players: Player[]; timezone: string }) {
  const [i, setI] = useState(0); // 0 = newest
  const newestId = events[0]?.id;
  useEffect(() => setI(0), [newestId]); // a new event snaps the bar back to it
  const ev = events[i];
  const fresh = ev && Date.now() - Date.parse(ev.at) < 60_000 && i === 0;
  const arrow = (dir: -1 | 1, label: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={!events.length || (dir === 1 ? i >= events.length - 1 : i <= 0)}
      onClick={() => setI((x) => x + dir)}
      style={{ background: 'none', border: 0, color: '#fff', fontSize: 22, width: 44, height: 44, opacity: 0.8 }}
      className="disabled:opacity-30"
    >
      {dir === 1 ? '‹' : '›'}
    </button>
  );
  return (
    <div style={{ position: 'sticky', bottom: 'calc(env(safe-area-inset-bottom) + 8px)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
      {arrow(1, 'Earlier')}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 14px', borderRadius: 12, background: '#000', border: '1px solid rgba(255,255,255,0.12)', fontSize: 14 }}>
        {ev ? (() => {
          const d = describeEvent(ev, players, timezone);
          return (
            <>
              <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.time}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><strong>{d.name}</strong> {d.gained} soldiers</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{d.steps} <img src={shoe} alt="steps" height={13} style={{ opacity: 0.8 }} /></span>
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', background: '#e5484d', boxShadow: fresh ? '0 0 10px #e5484d' : 'none', animation: fresh ? 'log-pulse 1.2s ease-in-out infinite' : undefined }} />
            </>
          );
        })() : (
          <span className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>No milestones yet today</span>
        )}
      </div>
      {arrow(-1, 'Later')}
    </div>
  );
}
