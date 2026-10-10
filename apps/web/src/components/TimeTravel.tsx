import { useEffect } from 'react';
import type { Moment } from '../data/timeline';

const time = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso));

/**
 * The demo scrubber at the top of the big screen: replay the day moment by moment. `cursor` is null
 * when the screen is live; otherwise the index into `moments` that the screen shows. ← and → keys
 * work too. Pure: the parent derives the state from the cursor (data/timeline.ts).
 */
export function TimeTravel({ moments, cursor, timezone, onChange }: {
  moments: Moment[];
  cursor: number | null;
  timezone: string;
  onChange: (cursor: number | null) => void;
}) {
  const last = moments.length - 1;
  const back = () => onChange(cursor === null ? Math.max(0, last) : Math.max(0, cursor - 1));
  const forward = () => (cursor === null || cursor >= last ? onChange(null) : onChange(cursor + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (moments.length === 0) return null;
  const m = cursor === null ? null : moments[cursor]!;
  const btn = { background: 'none', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 12, minWidth: 48, minHeight: 48, fontSize: 24, cursor: 'pointer' } as const;
  return (
    <div className="time-travel" role="group" aria-label="Replay the day">
      <button type="button" style={btn} onClick={() => onChange(0)} aria-label="Replay from the start" title="Replay from the start">⟲</button>
      <button type="button" style={btn} onClick={back} aria-label="Earlier">‹</button>
      <span className="display" style={{ fontSize: 22, minWidth: 220, textAlign: 'center' }} aria-live="polite">
        {m ? `${time(m.at, timezone)} · ${cursor! + 1} / ${moments.length}` : 'LIVE'}
      </span>
      <button type="button" style={btn} onClick={forward} aria-label="Later">›</button>
      {m && (
        <button type="button" className="pill" style={{ minHeight: 48, fontSize: 15 }} onClick={() => onChange(null)}>
          Back to live
        </button>
      )}
    </div>
  );
}
