import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TeamId } from '@invade/engine';
import { api } from '../data/api';
import { saveSession } from '../data/session';

/** Figma "Join/Create" + team choice. Today there is one campaign (code INVADE); creating games comes later. */
export function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? 'INVADE');
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamId | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [myCode, setMyCode] = useState('');

  /** Returning player on a new device: restore their own player from their private code. */
  async function restore(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const token = myCode.trim().toUpperCase();
    const r = await api.me(token);
    setBusy(false);
    if (!r.ok) return setError(r.error === 'Unknown code' ? 'That code is not in any game. Check it on your other device (Connect screen).' : r.error);
    saveSession({ token, player: r.data.player, game: r.data.game });
    navigate('/walk');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!team) return setError('Pick a team');
    setBusy(true);
    setError('');
    const r = await api.join({ code, name, team });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveSession({ token: r.data.token, player: r.data.player, game: r.data.game });
    navigate('/lobby');
  }

  if (returning) {
    return (
      <form className="screen" onSubmit={restore}>
        <h1 className="display title">Welcome back</h1>
        <p className="subtitle">Enter your private code (INV-…). It's on the Connect screen and in your Invade Sync shortcut.</p>
        <input className="field" value={myCode} onChange={(e) => setMyCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="INV-XXXX-XXXX-XXXX" />
        <p className="error" role="alert">{error}</p>
        <button className="pill pill-block" type="submit" disabled={busy || myCode.trim().length < 8}>{busy ? 'Checking…' : 'Continue'}</button>
        <button className="pill pill-block" type="button" onClick={() => { setReturning(false); setError(''); }}>Back</button>
      </form>
    );
  }

  return (
    <form className="screen" onSubmit={submit}>
      <h1 className="display title">Invade</h1>
      <p className="subtitle">Play. Walk. Conquer.</p>

      <label className="muted" htmlFor="code">Game code</label>
      <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" />

      <label className="muted" htmlFor="name">Your name</label>
      <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={14} autoComplete="given-name" placeholder="Max 14 characters" />

      <span className="muted">Your team</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['white', 'black'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="pill"
            aria-pressed={team === t}
            onClick={() => setTeam(t)}
            style={{ outline: team === t ? '2px solid var(--color-text-primary)' : 'none', opacity: team && team !== t ? 0.5 : 1 }}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="error" role="alert">{error}</p>
      <button className="pill pill-block" type="submit" disabled={busy || !name.trim()}>
        {busy ? 'Joining…' : 'Join game'}
      </button>
      <button className="subtitle" type="button" onClick={() => { setReturning(true); setError(''); }} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
        I already joined (new phone or browser)
      </button>
    </form>
  );
}
