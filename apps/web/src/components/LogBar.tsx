import { useEffect, useState } from 'react';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';

const fmt = new Intl.NumberFormat('de-DE');
const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * Figma LOG bottom bar (457:3277): a black pill with the time, my steps and a red record dot.
 * The dot runs the "Invade Sync" Shortcut, so a fresh Apple Health total is one tap away.
 */
export function LogBar({ steps }: { steps: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="logbar">
      <span>{clock(now)}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {fmt.format(steps)} <img src={shoe} alt="steps" height={14} />
      </span>
      <a className="logbar-dot" href={SYNC_SHORTCUT_URL} aria-label="Sync steps from Apple Health" />
    </div>
  );
}
