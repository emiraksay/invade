import { useEffect, useState } from 'react';
import type { GeneralOrder, GeneralResponse, TeamId } from '@invade/engine';
import { api } from '../data/api';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** The numbers behind the order, so the words can always be checked against the game. */
export function orderFacts(o: GeneralOrder): string {
  switch (o.kind) {
    case 'attack': return `Attack ${o.territory} · ${o.soldiers} vs ${o.defenders} · ${Math.round(o.odds * 100)}%`;
    case 'walk': return `${fmt.format(o.stepsToGo)} steps to +${o.gain}${o.unlocksBonus ? ' · team bonus' : ''}`;
    case 'hold': return `Hold ${o.territory}`;
  }
}

type State = { status: 'loading' } | { status: 'ready'; data: GeneralResponse } | { status: 'error'; error: string };

function useGeneral(load: () => Promise<Awaited<ReturnType<typeof api.general>>>, refreshKey: string, preload?: GeneralResponse): [State, () => void] {
  const [state, setState] = useState<State>(preload ? { status: 'ready', data: preload } : { status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (preload) return;
    let cancelled = false;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' })); // keep the last order visible while refreshing
    load().then((r) => { if (!cancelled) setState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', error: r.error }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, tick, preload]);
  return [state, () => setTick((t) => t + 1)];
}

/**
 * ⚔ General's orders, for the player (top of OPEN LIST on /walk). The order and its numbers come from
 * the server (engine rules); Claude writes the lines. Refetches when `refreshKey` changes (a sync, a battle).
 */
export function GeneralOrders({ token, refreshKey, preload }: { token: string; refreshKey: string; preload?: GeneralResponse }) {
  const [state, retry] = useGeneral(() => api.general(token), refreshKey, preload);
  return (
    <section aria-label="General's orders" style={{ display: 'grid', gap: 6, padding: '12px 14px', borderRadius: 'var(--radius-item)', background: 'rgba(255,255,255,0.06)', boxShadow: 'var(--shadow-item)' }}>
      <h2 className="display" style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={helmet} alt="" height={18} /> General's orders
      </h2>
      {state.status === 'loading' && <p className="subtitle" style={{ textAlign: 'left', fontSize: 15 }}>The General is reading the map…</p>}
      {state.status === 'error' && (
        <p className="error" style={{ textAlign: 'left' }}>{state.error} <button type="button" className="muted" style={{ background: 'none', border: 0, textDecoration: 'underline', fontSize: 14 }} onClick={retry}>Try again</button></p>
      )}
      {state.status === 'ready' && (
        <>
          {state.data.lines.map((l, i) => <p key={i} style={{ margin: 0, fontSize: i === 0 ? 17 : 15, lineHeight: 1.35, fontWeight: i === 0 ? 700 : 400 }}>{l}</p>)}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{orderFacts(state.data.order)}{state.data.writer === 'template' ? ' · Claude offline' : ''}</p>
        </>
      )}
    </section>
  );
}

/** The team version for the big screen: "White General: …" under the team column. */
export function TeamGeneral({ code, team, name, refreshKey, preload }: { code: string; team: TeamId; name: string; refreshKey: string; preload?: GeneralResponse }) {
  const [state] = useGeneral(() => api.generalTeam(code, team), refreshKey, preload);
  if (state.status !== 'ready') return <p className="muted" style={{ margin: 0, fontSize: 15, minHeight: 20 }}>{state.status === 'loading' ? `${name} General is reading the map…` : ''}</p>;
  return (
    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>
      <strong>{name} General:</strong> {state.data.lines.join(' ')}
      <span className="muted" style={{ fontSize: 13 }}> · {orderFacts(state.data.order)}</span>
    </p>
  );
}
