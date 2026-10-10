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
        {installUrl
          ? <a className="pill" style={{ textAlign: 'center', textDecoration: 'none' }} href={installUrl}>Add shortcut</a>
          : <span className="error">Shortcut link not configured yet</span>}
        <span className="muted" style={{ fontSize: 13 }}>
          Tap <b>Add Shortcut</b>. Then open <b>Invade Sync</b> in the Shortcuts app and replace
          <b> PASTE-YOUR-CODE-HERE</b> in the first card (Text) with your code from step 1.
        </span>
      </section>

      <section className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <strong>3. Sync once</strong>
        <a className="pill" style={{ textAlign: 'center', textDecoration: 'none' }} href={SYNC_SHORTCUT_URL}>Sync steps now</a>
        <span className="muted" style={{ fontSize: 13 }}>
          The first time, allow <b>Steps</b> in Health and allow the connection to invade.vercel.app.
          Your steps appear in the game within seconds.
        </span>
      </section>

      <section className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <strong>4. Sync automatically (recommended)</strong>
        <span className="muted" style={{ fontSize: 13 }}>
          Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b> → pick a time, Daily, <b>Run Immediately</b> →
          Run Shortcut <b>Invade Sync</b>. Add a few times (e.g. 10:00, 12:00, 14:00, 15:30).
        </span>
      </section>

      <button className="pill pill-block" onClick={() => navigate('/walk')}>Go to the game</button>
    </main>
  );
}
