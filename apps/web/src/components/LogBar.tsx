import { useEffect, useState } from 'react';
import type { Player } from '@invade/engine';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { describeEvent, type MilestoneEvent } from '../data/events';

const fmt = new Intl.NumberFormat('de-DE');
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * Figma LOG bottom bar (457:3277): a black pill.
 * Left: the latest milestone of the day ("12:02 Emir +4"), live from the events table, or the clock while
 * there is none yet. Right: my steps and the red record dot, which runs the "Invade Sync" Shortcut.
 * The dot pulses harder for a minute after a new milestone lands, so a sync on stage shows up here too.
 */
export function LogBar({ steps, events = [], players = [], timezone }: { steps: number; events?: MilestoneEvent[]; players?: Player[]; timezone: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const latest = events[0];
  const fresh = latest ? now - Date.parse(latest.at) < 60_000 : false;
  const d = latest ? describeEvent(latest, players, timezone) : null;
  return (
    <div className="logbar" aria-live="polite">
      {d ? (
        <>
          <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.time}</span>
          <span className="logbar-event"><strong>{d.name}</strong> {d.gained}</span>
        </>
      ) : (
        <span>{clock(now)}</span>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
        {fmt.format(steps)} <img src={shoe} alt="steps" height={14} />
      </span>
      <a className={`logbar-dot${fresh ? ' logbar-dot-fresh' : ''}`} href={SYNC_SHORTCUT_URL} aria-label="Sync steps from Apple Health" />
    </div>
  );
}
