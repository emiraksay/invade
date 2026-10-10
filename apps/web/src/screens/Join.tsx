import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { TeamId } from '@invade/engine';
import { api } from '../data/api';
import { saveSession } from '../data/session';
import { actionLabel, DEFAULT_GAME_CODE, joinProblem, restoreProblem, type JoinProblem } from '../data/joinProblems';

/**
 * Figma "Join/Create" + team choice. Today there is one campaign (code INVADE); creating games comes later.
 * Every way the rules can say no (name taken, team full, wrong code, lost code, no connection) ends in
 * one line and one tap that puts the player back on track — see data/joinProblems.ts.
 */
export function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? '';
  const [code, setCode] = useState(params.get('code') ?? DEFAULT_GAME_CODE);
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamId | null>(null);
  const [problem, setProblem] = useState<JoinProblem | null>(notice ? { message: notice, action: null } : null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [myCode, setMyCode] = useState('');

  const showReturning = (on: boolean) => { setReturning(on); setProblem(null); };

  /** Returning player on a new device: restore their own player from their private code. */
  async function restore(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setProblem(null);
    const token = myCode.trim().toUpperCase();
    const r = await api.me(token);
    setBusy(false);
    if (!r.ok) return setProblem(restoreProblem(r.error));
    saveSession({ token, player: r.data.player, game: r.data.game });
    navigate('/walk');
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!team) return setProblem({ message: 'Pick a team', action: null });
    setBusy(true);
    setProblem(null);
    const r = await api.join({ code, name, team });
    setBusy(false);
    if (!r.ok) return setProblem(joinProblem(r.error, team));
    saveSession({ token: r.data.token, player: r.data.player, game: r.data.game });
    navigate('/lobby');
  }

  /** The one follow-up tap under a problem line. */
  function act() {
    const action = problem?.action;
    if (!action) return;
    switch (action.kind) {
      case 'retry': return returning ? restore() : submit();
      case 'restore': return showReturning(true);
      case 'joinFresh': return showReturning(false);
      case 'useDefaultCode': setCode(DEFAULT_GAME_CODE); setProblem(null); return;
      case 'otherTeam': setTeam(action.team); setProblem(null); return;
    }
  }

  /** Figma: the paste icon in the code field (Safari asks once; nothing happens if it's denied). */
  async function paste(into: (v: string) => void) {
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) into(t.toUpperCase()); } catch { /* no clipboard access */ }
  }

  const problemBlock = (
    <>
      <p className="error" role="alert">{problem?.message ?? ''}</p>
      {problem?.action && (
        <button className="pill pill-block" type="button" onClick={act} disabled={busy}>
          {actionLabel(problem.action)}
        </button>
      )}
    </>
  );

  if (returning) {
    return (
      <form className="screen" onSubmit={restore}>
        <h1 className="display title">Welcome back</h1>
        <p className="subtitle">Enter your private code (INV-…). It's on the Connect screen and in your Invade Sync shortcut.</p>
        <div className="field-row">
          <input className="field" value={myCode} onChange={(e) => setMyCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="INV-XXXX-XXXX-XXXX" aria-label="Private code" />
          <button type="button" className="field-paste" aria-label="Paste code" onClick={() => paste(setMyCode)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg></button>
        </div>
        {problemBlock}
        <button className="pill pill-block" type="submit" disabled={busy || myCode.trim().length < 8}>{busy ? 'Checking…' : 'Continue'}</button>
        <button className="pill pill-block" type="button" onClick={() => showReturning(false)}>Back</button>
      </form>
    );
  }

  return (
    <form className="screen" onSubmit={submit}>
      <h1 className="display title">Invade</h1>
      <p className="subtitle">Play. Walk. Conquer.</p>

      <label className="muted" htmlFor="code">Game code</label>
      <div className="field-row">
        <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="Enter game code" />
        <button type="button" className="field-paste" aria-label="Paste game code" onClick={() => paste(setCode)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg></button>
      </div>

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
            onClick={() => { setTeam(t); if (problem?.action?.kind === 'otherTeam') setProblem(null); }}
            style={{ outline: team === t ? '2px solid var(--color-text-primary)' : 'none', opacity: team && team !== t ? 0.5 : 1 }}
          >
            {t}
          </button>
        ))}
      </div>

      {problemBlock}
      <button className="pill pill-block" type="submit" disabled={busy || !name.trim()}>
        {busy ? 'Joining…' : 'Join game'}
      </button>
      <button className="subtitle" type="button" onClick={() => showReturning(true)} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', minHeight: 48 }}>
        I already joined (new phone or browser)
      </button>
    </form>
  );
}
