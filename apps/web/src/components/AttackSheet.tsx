import { useState } from 'react';
import { attackOdds, type AttackOption, type AttackResponse } from '@invade/engine';
import { api } from '../data/api';

const pct = (p: number) => `${Math.round(p * 100)}%`;

/**
 * The attack sheet (cousin's Sctech Attack frame + Wireframe): "You vs Enemy", pick how many of my
 * soldiers go in, see the odds live, Confirm / Cancel. The server rolls the battle; the map flips by
 * Realtime. Odds come from the engine's attackOdds, the same function the server uses.
 */
export function AttackSheet({ token, option, enemyName, onClose }: {
  token: string;
  option: AttackOption;
  /** The defending team's display name. */
  enemyName: string;
  onClose: () => void;
}) {
  const [soldiers, setSoldiers] = useState(option.maxAttackers);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttackResponse | null>(null);
  const p = attackOdds(soldiers, option.defenders);

  async function confirm() {
    setSending(true);
    setError(null);
    const res = await api.attack(token, option.to, soldiers);
    setSending(false);
    if (res.ok) setResult(res.data);
    else setError(res.error);
  }

  return (
    <div className="sheet-backdrop" onClick={sending ? undefined : onClose}>
      <section
        className={`sheet attack-sheet${result && !result.won ? ' attack-lost' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Attack ${option.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 22 }}>Attack {option.name}</h2>
          <button type="button" className="sheet-close" onClick={onClose} disabled={sending} aria-label="Close">✕</button>
        </header>

        {result ? (
          <div className="attack-result" aria-live="assertive">
            <p className="display attack-verdict">{result.won ? 'Conquered!' : 'Defeated'}</p>
            <p className="subtitle">
              {result.won
                ? `${option.name} is yours. ${result.attackersLeft} soldiers hold it.`
                : `${enemyName} held ${option.name} with ${result.defendersLeft} left.`}
              {' '}Odds were {pct(result.p)}.
            </p>
            <button type="button" className="pill pill-block" onClick={onClose}>Back to the map</button>
          </div>
        ) : (
          <>
            <div className="attack-versus">
              <div><span className="attack-count">{soldiers}</span><span className="subtitle">You</span></div>
              <span className="display">vs</span>
              <div><span className="attack-count">{option.defenders}</span><span className="subtitle">{enemyName}</span></div>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="subtitle">Soldiers to send (1–{option.maxAttackers})</span>
              <input
                type="range"
                min={1}
                max={option.maxAttackers}
                value={soldiers}
                disabled={sending || option.maxAttackers <= 1}
                onChange={(e) => setSoldiers(Number(e.target.value))}
              />
            </label>
            <div className="attack-odds" aria-live="polite">
              <div className="attack-odds-bar"><span style={{ width: pct(p) }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>You {pct(p)}</span>
                <span>{enemyName} {pct(1 - p)}</span>
              </div>
            </div>
            <p className="error" role="alert">{error ?? ''}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" className="pill" onClick={onClose} disabled={sending}>Cancel</button>
              <button type="button" className="pill attack-confirm" onClick={confirm} disabled={sending}>
                {sending ? 'Attacking…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
