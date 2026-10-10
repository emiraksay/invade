import { useCallback, useEffect, useState } from 'react';
import { MILESTONES } from '@invade/engine';

const SEEN_KEY = 'invade.howto.seen.v1';
const fmt = (n: number) => n.toLocaleString('en-US');

function milestoneLine(): string {
  return MILESTONES.map((m, i) => `${fmt(m.steps)} → ${m.soldiers}${i === MILESTONES.length - 1 ? ' (max)' : ''}`).join(' · ');
}

function bonusLine(): string {
  const ks = MILESTONES.slice(0, 2).map((m) => `${fmt(m.steps / 1000)}k`);
  return `Team bonus: extra soldiers when everyone on your team passes ${ks.join(' / ')}.`;
}

/** The rules in six lines, as a bottom sheet. Numbers come from the engine. */
export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const lines = [
    'A season is one week. Sunday midnight is the final.',
    `Walk: your Apple Health steps become soldiers. ${milestoneLine()}.`,
    bonusLine(),
    'The island has 7 zones of different sizes: bigger zones are worth more of the map.',
    'Tap an enemy zone next to yours to attack: win chance = your soldiers ÷ (yours + defenders). Win it and it is yours.',
    'The AI General tells you the best move.',
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="howto-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="howto-title" className="display" style={{ margin: 0, fontSize: 24, textAlign: 'center' }}>How to play</h2>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 12, fontSize: 15, lineHeight: 1.4 }}>
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ol>
        <button type="button" className="pill pill-block" onClick={onClose} autoFocus>Got it</button>
      </section>
    </div>
  );
}

/** Opens How to play once per device. Returns [open, close]. */
export function useFirstVisitHowTo(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) === null; } catch { return false; }
  });
  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: shows again next visit */ }
  }, []);
  return [open, close];
}
