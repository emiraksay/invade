import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_MAP, MILESTONES } from '@invade/engine';
import { api } from '../data/api';
import { clearSession, loadSession } from '../data/session';
import { MapSvg } from '../map/MapSvg';
import { walkPhaseMapView } from '../map/model';

const SPLASH_MS = 1500;
const fmt = (n: number) => n.toLocaleString('en-US');

/** Tips use the engine's milestone table so they never drift from the rules. */
function tips(): string[] {
  const [first, second] = MILESTONES;
  const out: string[] = [];
  if (first) out.push(`${fmt(first.steps)} steps = ${first.soldiers} soldiers`);
  if (second) out.push(`Your whole team over ${fmt(second.steps / 1000)}k = +bonus`);
  out.push('Attack a neighbour: odds = your soldiers ÷ (yours + theirs)');
  return out;
}

/** The Figma island, before anyone has walked: both halves dark, HQs lifted. */
const ISLAND = walkPhaseMapView(DEFAULT_MAP, {
  white: { soldiers: 0, maxSoldiers: 1, members: [] },
  black: { soldiers: 0, maxSoldiers: 1, members: [] },
});

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Where the splash sends the player, checked against the server while the bar fills:
 * no session → join; a session the server still knows → walk; a session the server has
 * forgotten (reseeded game, deleted player) → join, with a line that says why. If the server
 * can't be reached the session is kept: the Walk screen shows its own retry.
 */
export async function splashTarget(): Promise<{ to: string; notice?: string }> {
  const session = loadSession();
  if (!session) return { to: '/join' };
  const r = await api.me(session.token);
  if (!r.ok && /^(Unknown|Invalid) code$/i.test(r.error)) {
    clearSession();
    return { to: '/join', notice: 'Your player is no longer in the game. Join again, or enter your private code.' };
  }
  return { to: '/walk' };
}

/** Figma SignIn frame: title, tagline, the island, a tip and a 1.5 s loading bar, then on to the game. */
export function Splash() {
  const navigate = useNavigate();
  const [list] = useState(tips);
  const [tip] = useState(() => Math.floor(Date.now() / 1000) % list.length);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let alive = true;
    const raf = requestAnimationFrame(() => setFilled(true));
    Promise.all([delay(SPLASH_MS), splashTarget()]).then(([, target]) => {
      if (alive) navigate(target.to, { replace: true, state: target.notice ? { notice: target.notice } : undefined });
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [navigate]);

  return (
    <main className="screen" style={{ height: '100dvh', justifyContent: 'space-between', overflow: 'hidden' }}>
      <header style={{ textAlign: 'center', paddingTop: 24 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 28 }}>Invade : Walking Game</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Play. Walk. Conquer.</p>
      </header>
      <div className="splash-island" aria-hidden>
        <MapSvg view={ISLAND} />
      </div>
      <footer style={{ display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, textAlign: 'center' }}>
          <strong className="display" style={{ display: 'block', fontSize: 18 }}>Tip</strong>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>{list[tip]}</span>
        </p>
        <div
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={filled ? 100 : 0}
          style={{ height: 4, borderRadius: 2, background: 'var(--color-track)', overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: filled ? '100%' : '0%',
              background: 'var(--color-track-fill)',
              transition: `width ${SPLASH_MS}ms linear`,
            }}
          />
        </div>
      </footer>
    </main>
  );
}
