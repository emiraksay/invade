import { useEffect, useState } from 'react';
import type { ApiResult } from '@invade/engine';

/** Today's decree from the AI Director (POST /api/director): chosen once per day, same for everyone. */
interface Decree { title: string; story: string; writer: 'claude' | 'template'; decree: { kind: string } }

async function fetchDecree(code: string): Promise<Decree | null> {
  try {
    const res = await fetch('/api/director', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const json = (await res.json()) as ApiResult<Decree>;
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}

export function DecreeBanner({ code, big = false }: { code: string; big?: boolean }) {
  const [decree, setDecree] = useState<Decree | null>(null);
  const [open, setOpen] = useState(big);
  useEffect(() => {
    let alive = true;
    void fetchDecree(code).then((d) => { if (alive) setDecree(d); });
    return () => { alive = false; };
  }, [code]);
  if (!decree || decree.decree.kind === 'quiet' && !big) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="item"
      style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,0.25)', cursor: big ? 'default' : 'pointer', padding: big ? '14px 20px' : '8px 14px' }}
    >
      <span className="muted" style={{ fontSize: big ? 16 : 11, letterSpacing: '0.08em' }}>📜 THE DIRECTOR'S DECREE · TODAY</span>
      <strong className="display" style={{ display: 'block', fontSize: big ? 30 : 16, marginTop: 2 }}>{decree.title}</strong>
      {open && <span style={{ display: 'block', marginTop: 4, fontSize: big ? 18 : 13, lineHeight: 1.35 }}>{decree.story}</span>}
    </button>
  );
}
