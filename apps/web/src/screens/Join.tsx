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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!team) return setError('Pick a team');
    setBusy(true);
    setError('');
    const r = await api.join({ code, name, team });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveSession({ token: r.data.token, player: r.data.player, game: r.data.game });
    navigate('/connect');
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
    </form>
  );
}
