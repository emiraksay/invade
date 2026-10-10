import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';
import { clearSession, loadSession } from '../data/session';
import { HowToPlay } from './HowToPlay';

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
  const [howTo, setHowTo] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const token = loadSession()?.token ?? '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* no clipboard access: the code is selectable */ }
  };
  const signOut = () => { clearSession(); navigate('/join', { replace: true }); };
  const toggle = (k: Pref) => setPrefs((p) => {
    const next = { ...p, [k]: !p[k] };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
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

      <ul className="settings-rows">
        <li>
          <span>How to play</span>
          <button type="button" className="settings-control" onClick={() => setHowTo(true)}>Open</button>
        </li>
        {token && (
          <li>
            <span>My code</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <code style={{ userSelect: 'all', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{token}</code>
              <button type="button" className="settings-control" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </span>
          </li>
        )}
        <li>
          <span>Sync shortcut</span>
          <a className="settings-control" href={SYNC_SHORTCUT_URL}>Run</a>
        </li>
        <li>
          <span>Sign out</span>
          <button type="button" className="settings-control" onClick={signOut}>Sign out</button>
        </li>
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
      <HowToPlay open={howTo} onClose={() => setHowTo(false)} />
      <style>{ROW_CSS}</style>
    </div>
  );
}

/* Figma Settings rows: label left, control right (scoped here so global.css stays untouched). */
const ROW_CSS = `
.settings-rows { list-style: none; margin: 0 auto; padding: 0; display: grid; gap: 10px; width: min(100%, 320px); }
.settings-rows li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; font-size: 18px; font-weight: 700; }
.settings-control {
  flex: none; min-height: 36px; padding: 6px 14px; border: 1.5px solid #fff; border-radius: 2px;
  background: transparent; color: #fff; font: 600 13px var(--font-body); text-transform: uppercase;
  text-decoration: none; cursor: pointer; display: inline-flex; align-items: center;
}
.settings-control:active { transform: translateY(1px); }
`;
