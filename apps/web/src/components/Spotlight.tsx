import { useEffect, useRef, useState } from 'react';
import type { Player, TeamId } from '@invade/engine';
import { spotlightFor, type BattleEvent, type MilestoneEvent, type Spotlight as SpotlightItem } from '../data/events';

const SHOW_MS = 4000;
const FADE_MS = 500;

/**
 * Big-screen spotlight: when a NEW event arrives (after mount, so a reload never replays the day), shout it
 * for ~4 s, headline ≥ 48 px, in the team's colour, then fade. Overlapping events queue one after another.
 * pointer-events: none, so it never blocks the map. Reduced motion: no fade, still shown for 4 s.
 */
export function Spotlight({ events, players, teamNames }: {
  /** Newest first. */
  events: readonly (MilestoneEvent | BattleEvent)[];
  players: readonly Player[];
  teamNames: Record<TeamId, string>;
}) {
  const seen = useRef<number | null>(null); // highest event id already on screen when we mounted / shown since
  const [queue, setQueue] = useState<SpotlightItem[]>([]);
  const [current, setCurrent] = useState<SpotlightItem | null>(null);
  const [fading, setFading] = useState(false);

  // New events -> queue (oldest first so the order on stage is the order they happened).
  const newestId = events[0]?.id ?? 0;
  useEffect(() => {
    if (seen.current === null) { seen.current = newestId; return; } // first render: nothing to replay
    const fresh = events.filter((e) => e.id > (seen.current ?? 0)).sort((a, b) => a.id - b.id);
    if (fresh.length === 0) return;
    seen.current = newestId;
    setQueue((q) => [...q, ...fresh.map((e) => spotlightFor(e, players, teamNames))]);
  }, [newestId, events, players, teamNames]);

  // Show the queue one item at a time.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next!);
    setFading(false);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeAt = setTimeout(() => setFading(true), reduced ? SHOW_MS : SHOW_MS - FADE_MS);
    const doneAt = setTimeout(() => setCurrent(null), SHOW_MS);
    return () => { clearTimeout(fadeAt); clearTimeout(doneAt); };
  }, [current, queue]);

  if (!current) return null;
  const white = current.team === 'white';
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`spotlight ${fading ? 'spotlight-out' : 'spotlight-in'}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', pointerEvents: 'none',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div style={{
        maxWidth: '80vw', padding: '28px 48px', borderRadius: 24, textAlign: 'center',
        background: white ? '#f4f2ec' : '#000', color: white ? '#111' : '#fff',
        border: `4px solid ${white ? '#fff' : '#3a3a40'}`, boxShadow: `0 0 60px ${white ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.8)'}`,
      }}>
        <p className="display" style={{ margin: 0, fontSize: 'clamp(48px, 6vw, 88px)', lineHeight: 1.05, letterSpacing: '0.02em', textShadow: 'none' }}>{current.headline}</p>
        <p style={{ margin: '12px 0 0', fontSize: 'clamp(22px, 2.4vw, 34px)', opacity: 0.8 }}>{current.sub}</p>
      </div>
    </div>
  );
}
