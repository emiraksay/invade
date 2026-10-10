import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';

type Pref = 'sfx' | 'music' | 'notifications';
const PREFS_KEY = 'invade:prefs';
const LABEL: Record<Pref, string> = { sfx: 'SFX', music: 'Music', notifications: 'Notification' };

function loadPrefs(): Record<Pref, boolean> {
  const fallback = { sfx: true, music: true, notifications: true };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

/**
 * Figma Settings: the title, Apple Health sync (steps only ever come from the Shortcut), the
 * SFX / Music / Notification boxes (saved on this phone), Terms and the version line.
 */
export function SettingsPanel() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [terms, setTerms] = useState(false);
  const toggle = (k: Pref) => setPrefs((p) => {
    const next = { ...p, [k]: !p[k] };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  });

  return (
    <div className="settings">
      <header style={{ textAlign: 'center' }}>
        <h1 className="settings-title">Invade : Walking Game</h1>
        <p style={{ margin: '2px 0 0', fontSize: 10 }} className="muted">Play. Walk. Conquer.</p>
      </header>

      <section style={{ display: 'grid', gap: 10 }}>
        <a className="pill pill-block" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }} href={SYNC_SHORTCUT_URL}>
          Sync with Apple Health
        </a>
        <Link to="/connect" className="subtitle" style={{ color: 'var(--color-text-secondary)' }}>
          Set up or reinstall the Invade Sync Shortcut
        </Link>
      </section>

      <ul className="settings-toggles">
        {(Object.keys(LABEL) as Pref[]).map((k) => (
          <li key={k}>
            <label>
              <span>{LABEL[k]}</span>
              <input type="checkbox" className="xbox" checked={prefs[k]} onChange={() => toggle(k)} />
            </label>
          </li>
        ))}
      </ul>

      <section style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
        <button type="button" className="pill" onClick={() => setTerms((t) => !t)} aria-expanded={terms}>Terms and service</button>
        {terms && (
          <p className="subtitle" style={{ maxWidth: 320, lineHeight: 1.45 }}>
            Invade is a beta. Virtual stakes only: no real money. Your step totals come from Apple Health
            through the Invade Sync Shortcut and are used only for this game.
          </p>
        )}
      </section>

      <footer style={{ textAlign: 'center', fontSize: 13 }}>
        <strong>Thanks for playing</strong>
        <p className="muted" style={{ margin: '2px 0 0' }}>Version: 0.1 (BETA)</p>
      </footer>
    </div>
  );
}
