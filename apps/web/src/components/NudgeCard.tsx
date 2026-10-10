import { useState } from 'react';
import type { Nudge, NudgeResponse } from '@invade/engine';
import { api } from '../data/api';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** Share sheet on phones, clipboard elsewhere. Returns what happened, for the button label. */
async function send(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function NudgeRow({ n }: { n: Nudge }) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  return (
    <li className="item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 15 }}>
        <strong>{n.name}</strong>
        <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {fmt.format(n.stepsToGo)} to +{n.gain} <img src={helmet} alt="soldiers" height={13} style={{ opacity: 0.7 }} />{n.unlocksBonus && ' · team bonus'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{n.message}</p>
      <button type="button" className="pill" style={{ fontSize: 15, minHeight: 44, alignSelf: 'flex-end' }} onClick={async () => setState(await send(n.message))}>
        {state === 'idle' ? 'Send' : state === 'shared' ? 'Sent' : state === 'copied' ? 'Copied' : 'Try again'}
      </button>
    </li>
  );
}

/** Figma-less for now: "Who needs a nudge?" → facts from the engine, words from Claude, one tap to send. */
export function NudgeCard({ token, preload }: { token: string; preload?: NudgeResponse }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data?: NudgeResponse; error?: string }>(
    preload ? { status: 'ready', data: preload } : { status: 'idle' },
  );

  async function load() {
    setState({ status: 'loading' });
    const r = await api.nudge(token);
    setState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', error: r.error });
  }

  if (state.status === 'idle' || state.status === 'error') {
    return (
      <section style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="pill pill-block" onClick={load}>Who needs a nudge?</button>
        {state.status === 'error' && <p className="error">{state.error}</p>}
      </section>
    );
  }
  if (state.status === 'loading') return <p className="subtitle" style={{ fontSize: 15 }}>Checking who's short of a milestone…</p>;

  const { nudges, writer } = state.data!;
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 20 }}>Nudge</h2>
        <button type="button" className="muted" style={{ background: 'none', border: 0, fontSize: 15, minHeight: 44 }} onClick={load}>Refresh</button>
      </header>
      {nudges.length === 0 && <p style={{ margin: 0, fontSize: 16 }}>Everyone on your team is at today's cap. Nothing to nudge.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {nudges.map((n) => <NudgeRow key={n.playerId} n={n} />)}
      </ul>
      {nudges.length > 0 && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {writer === 'claude' ? 'Numbers from the game, words by Claude.' : 'Numbers from the game. Claude is offline, so these are plain.'}
        </p>
      )}
    </section>
  );
}
