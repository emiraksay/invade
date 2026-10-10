import { useEffect, useState } from 'react';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import barracks from '../assets/icons/stat-territories-castle.svg';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';
import { reachedMilestone } from '../data/arrivals';
import type { MilestoneEvent } from '../data/events';

const fmt = new Intl.NumberFormat('de-DE');
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MARCH_MS = 1400; // soldiers walk along the arrow and the barracks counts up
const MARCH_DELAY_MS = 500;
const ARM_MS = 600; // a stray tap right after it appears must not dismiss it

/**
 * Figma "Base" conversion frames: the screen dims, my steps (shoe) march along the arrow into the
 * team's barracks, the barracks count rises, then TAP TO CONTINUE. Our rule is milestones, not the
 * frame's flat 1000/1 (decision #3), so the arrow is labelled with the milestone that was crossed.
 */
export function SoldiersArrive({ ev, teamSoldiers, onDone }: { ev: MilestoneEvent; teamSoldiers: number; onDone: () => void }) {
  // Snapshot the numbers once: a teammate's Realtime refresh mid-march must not restart the count-up.
  const [target] = useState(teamSoldiers);
  const before = Math.max(0, target - ev.gained);
  const [shown, setShown] = useState(reducedMotion ? target : before);
  const [done, setDone] = useState(reducedMotion);
  const [armed, setArmed] = useState(reducedMotion);
  const milestone = reachedMilestone(ev.steps);

  useEffect(() => {
    const id = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const start = performance.now() + MARCH_DELAY_MS;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / MARCH_MS));
      setShown(Math.round(before + (target - before) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [before, target]);

  // Escape closes too (keyboard users, and a way out if a tap ever fails).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const dismiss = () => { if (armed || done) onDone(); };

  return (
    <div className="arrive" role="dialog" aria-modal="true" aria-label={`+${ev.gained} soldiers for your team`} onClick={dismiss}>
      <div className="arrive-row">
        <div className="arrive-stat">
          <img src={shoe} alt="Your steps" height={40} />
          <span>{fmt.format(ev.steps)}</span>
        </div>
        <div className="arrive-arrow">
          {!reducedMotion && Array.from({ length: Math.min(ev.gained, 6) }, (_, i) => (
            <img key={i} src={helmet} alt="" className="arrive-soldier" style={{ animationDelay: `${MARCH_DELAY_MS + i * 180}ms` }} />
          ))}
          <svg viewBox="0 0 64 20" width="64" height="20" aria-hidden><path d="M0 10h54M46 2l10 8-10 8" stroke="#fff" strokeWidth="4" fill="none" /></svg>
          <small>{milestone ? `${fmt.format(milestone.steps)} → +${ev.gained}` : `+${ev.gained}`}</small>
        </div>
        <div className="arrive-stat">
          <img src={barracks} alt="Team soldiers" height={40} />
          <span>{shown}</span>
        </div>
      </div>
      <p className="arrive-gain">+{ev.gained} soldiers march into your barracks</p>
      <p className="arrive-tap" style={{ opacity: done ? 1 : 0 }} aria-live="polite">
        {done ? `Your team now has ${target} soldiers. Tap to continue` : ''}
      </p>
    </div>
  );
}
