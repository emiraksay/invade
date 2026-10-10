import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { loadSession } from '../data/session';
import { SYNC_SHORTCUT_URL } from '../data/shortcut';

/**
 * One-time setup: install the "Invade Sync" Shortcut, which reads today's steps from Apple Health
 * and posts them with this player's private code. Web apps cannot read HealthKit; Shortcuts can.
 */
export function ConnectHealth() {
  const navigate = useNavigate();
  const session = loadSession();
  const [copied, setCopied] = useState(false);
  if (!session) return <Navigate to="/join" replace />;

  const installUrl = import.meta.env.VITE_SHORTCUT_URL;

  async function copy() {
    try {
      await navigator.clipboard.writeText(session!.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="screen">
      <h1 className="display title" style={{ fontSize: 26 }}>Connect Apple Health</h1>
      <p className="subtitle">Your steps come straight from the Health app, so every number is real.</p>

      <section className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <strong>1. Copy your private code</strong>
        <div className="code">{session.token}</div>
        <button className="pill" onClick={copy}>{copied ? 'Copied' : 'Copy code'}</button>
        <span className="muted" style={{ fontSize: 13 }}>Keep it to yourself: it's how your steps reach your team.</span>
      </section>

      <section className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <strong>2. Add the Invade Sync shortcut</strong>
        <span className="muted" style={{ fontSize: 13 }}>When it asks for your code, paste it. Allow access to Health when asked.</span>
        {installUrl
          ? <a className="pill" style={{ textAlign: 'center', textDecoration: 'none' }} href={installUrl}>Add shortcut</a>
          : <span className="error">Shortcut link not configured yet</span>}
      </section>

      <section className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <strong>3. Sync once</strong>
        <a className="pill" style={{ textAlign: 'center', textDecoration: 'none' }} href={SYNC_SHORTCUT_URL}>Sync steps now</a>
      </section>

      <button className="pill pill-block" onClick={() => navigate('/walk')}>Go to the game</button>
    </main>
  );
}
