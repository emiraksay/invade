import { useState } from 'react';
import { api } from '../data/api';

const STEP = 2_500;
const fmt = new Intl.NumberFormat('de-DE');

/** Demo day only: judges can't install the Apple Health Shortcut at the table, so this posts a demo total
 *  through the same API (`source: 'demo'`, keep-max like a real sync). Rendered only when VITE_DEMO_SYNC=1. */
export const DEMO_SYNC_ENABLED = import.meta.env.VITE_DEMO_SYNC === '1';

export function DemoSync({ token, steps }: { token: string; steps: number }) {
  const [state, setState] = useState<{ busy: boolean; note?: string; error?: string }>({ busy: false });
  if (!DEMO_SYNC_ENABLED) return null;

  async function walk() {
    setState({ busy: true });
    const r = await api.steps({ token, steps: steps + STEP, source: 'demo' });
    if (!r.ok) return setState({ busy: false, error: r.error });
    setState({ busy: false, note: r.data.gained > 0 ? `+${r.data.gained} soldiers!` : `${fmt.format(r.data.steps)} steps, keep going` });
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button type="button" className="pill pill-block" disabled={state.busy} onClick={walk} style={{ opacity: 0.85 }}>
        {state.busy ? 'Walking…' : `Demo: walk ${fmt.format(STEP)} steps`}
      </button>
      <p className="subtitle" style={{ minHeight: 18, fontSize: 13 }} aria-live="polite">
        {state.error ?? state.note ?? 'Judges only: pretends you walked. Real players use the Shortcut.'}
      </p>
    </div>
  );
}
