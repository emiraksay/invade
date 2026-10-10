import { useEffect, useState } from 'react';
import type { GeneralOrder, GeneralResponse, TeamId } from '@invade/engine';
import { api } from '../data/api';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';

const fmt = new Intl.NumberFormat('de-DE');

/** The numbers behind the order, so the words can always be checked against the game. */
export function orderFacts(o: GeneralOrder): string {
  switch (o.kind) {
    case 'attack': return `Attack ${o.target} · ${o.soldiers} vs ${o.defenders} · ${Math.round(o.odds * 100)}%`;
    case 'bonus': return `${fmt.format(o.stepsToGo)} steps to ${fmt.format(o.threshold)} · team bonus +${o.bonus}`;
    case 'walk': return `${fmt.format(o.stepsToGo)} steps to +${o.gain}`;
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
 * ⚔ General's orders, for the player (top of OPEN LIST on /walk). The order and its numbers come from the
 * server (engine rules); Claude writes the text. Refetches when `refreshKey` changes (a sync, a battle).
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
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.35, fontWeight: 700 }}>{state.data.text}</p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {orderFacts(state.data.order)}
            {state.data.order.kind === 'attack' && ' · View on map'}
            {state.data.writer === 'template' && ' · Claude offline'}
          </p>
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
      <strong>{name} General:</strong> {state.data.text}
      <span className="muted" style={{ fontSize: 13 }}> · {orderFacts(state.data.order)}</span>
    </p>
  );
}

/** One-line General's order on the map page itself, so the AI is visible without opening the list. Tap → the full orders. */
export function GeneralStrip({ token, refreshKey, preload, onOpen }: { token: string; refreshKey: string; preload?: GeneralResponse; onOpen: () => void }) {
  const [state] = useGeneral(() => api.general(token), refreshKey, preload);
  if (state.status !== 'ready') return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`General's orders: ${state.data.text}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 'var(--radius-item)', background: 'rgba(255,255,255,0.06)', color: 'inherit', textAlign: 'left', cursor: 'pointer',
      }}
    >
      <img src={helmet} alt="" height={16} />
      <span className="display" style={{ fontSize: 12, flex: 'none' }}>General</span>
      <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.data.text}</span>
    </button>
  );
}
