import { useEffect } from 'react';
import type { BattleRecord, Player } from '@invade/engine';
import { logLines, type LogLine } from '../data/log';
import type { MilestoneEvent } from '../data/events';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

function Row({ l }: { l: LogLine }) {
  return (
    <li className="log-row">
      <span className="muted" style={{ fontVariantNumeric: 'tabular-nums', width: 44 }}>{l.time}</span>
      {l.kind === 'sync' ? (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><strong>{l.name}</strong> {l.gained} soldiers</span>
          <span aria-hidden className="log-dot" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{l.steps} <img src={shoe} alt="steps" height={14} /></span>
        </>
      ) : (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>{l.name}</strong> {l.won ? 'captures' : 'fails at'} {l.territory}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
            {l.attackers} <img src={helmet} alt="attackers" height={14} /> <span className="muted">vs</span> {l.defenders} <img src={helmet} alt="defenders" height={14} style={{ opacity: 0.6 }} />
          </span>
          <span aria-hidden className="log-dot" style={{ background: l.won ? '#5bd37a' : '#e5484d' }} />
        </>
      )}
    </li>
  );
}

/**
 * Figma LOG screen (frame "LOG" in the prototype): every sync and battle of the day as rows over the map.
 * Opens from the LOG strip on the map tab. Pure apart from the Escape key: rows come from data/log.ts.
 */
export function LogSheet({ open, onClose, events, battles, players, timezone, today }: {
  open: boolean;
  onClose: () => void;
  events: MilestoneEvent[];
  battles: readonly BattleRecord[];
  players: Player[];
  timezone: string;
  today?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const lines = logLines(events, battles, players, timezone, today);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="log-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="log-title" className="display" style={{ margin: 0, fontSize: 24, textAlign: 'center' }}>Log</h2>
        {lines.length === 0 && <p className="subtitle">Nothing yet today. Sync your steps to write the first line.</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {lines.map((l) => <Row key={l.id} l={l} />)}
        </ul>
        <button type="button" className="pill pill-block" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}
