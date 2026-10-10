import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MILESTONES } from '@invade/engine';
import { loadSession } from '../data/session';

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

/** Figma SignIn frame: title, tagline, a tip and a 1.5 s loading bar, then on to the game. */
export function Splash() {
  const navigate = useNavigate();
  const [list] = useState(tips);
  const [tip] = useState(() => Math.floor(Date.now() / 1000) % list.length);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    const t = setTimeout(() => navigate(loadSession() ? '/walk' : '/join', { replace: true }), SPLASH_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [navigate]);

  return (
    <main className="screen" style={{ height: '100dvh', justifyContent: 'space-between' }}>
      <div />
      <header style={{ textAlign: 'center' }}>
        <h1 className="display" style={{ margin: 0, fontSize: 28 }}>Invade : Walking Game</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Play. Walk. Conquer.</p>
      </header>
      <footer style={{ display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>
          <strong className="display" style={{ marginRight: 8 }}>Tip</strong>
          <span style={{ color: 'var(--color-text-secondary)' }}>{list[tip]}</span>
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
