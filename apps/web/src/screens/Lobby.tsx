import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { TeamDay, TeamId } from '@invade/engine';
import { loadSession } from '../data/session';
import { useGameDay } from '../data/useGameDay';

const fmt = new Intl.NumberFormat('de-DE');

/** One team list in the Figma MatchLobby style (PlayerItem rows; you highlighted). */
function LobbyTeam({ team, name, myId }: { team: TeamDay; name: string; myId: string }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2 className="display" style={{ margin: 0, fontSize: 22 }}>{name}</h2>
      {team.members.length === 0 && <p className="muted" style={{ margin: 0 }}>Waiting for players…</p>}
      {team.members.map((m, i) => (
        <div key={m.player.id} className={`item ${m.player.id === myId ? 'item-me' : ''}`}>
          <span className="muted" style={{ width: 16 }}>{i + 1}</span>
          <span className={`avatar avatar-${team.team}`} />
          <strong style={{ flex: 1 }}>{m.player.name}{m.player.id === myId ? ' (you)' : ''}</strong>
          <span className="muted">{m.steps > 0 ? `${fmt.format(m.steps)} 👟` : 'not synced'}</span>
        </div>
      ))}
    </section>
  );
}

/**
 * Figma MatchLobby (347:1048 / 310:2139): both teams live, the game code to invite friends,
 * then into the battle. Players pick their team at Join; switching teams comes with game creation.
 */
export function Lobby() {
  const navigate = useNavigate();
  const session = loadSession();
  const state = useGameDay(session?.game.id);
  const [copied, setCopied] = useState(false);
  if (!session) return <Navigate to="/join" replace />;

  const invite = `${window.location.origin}/join?code=${session.game.code}`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Invade', text: 'Join my team in Invade: walk to conquer.', url: invite });
      else { await navigator.clipboard.writeText(invite); setCopied(true); }
    } catch { /* user cancelled the share sheet */ }
  }

  const me = state.teams?.[session.player.team].members.find((m) => m.player.id === session.player.id);
  const enter = () => navigate(me && me.steps > 0 ? '/walk' : '/connect');
  const order: TeamId[] = [session.player.team, session.player.team === 'white' ? 'black' : 'white'];

  return (
    <main className="screen">
      <h1 className="display title" style={{ fontSize: 30 }}>Lobby</h1>
      <p className="subtitle">You're on <strong>{state.settings?.teamNames[session.player.team] ?? session.player.team}</strong>. Get your friends in.</p>

      {state.status === 'loading' && <p className="subtitle">Loading teams…</p>}
      {state.status === 'error' && <p className="error">{state.error}</p>}
      {state.teams && state.settings && order.map((t) => (
        <LobbyTeam key={t} team={state.teams![t]} name={state.settings!.teamNames[t]} myId={session.player.id} />
      ))}

      <div className="code" aria-label="Game code">{session.game.code}</div>
      <button className="pill pill-block" type="button" onClick={share}>{copied ? 'Invite link copied' : 'Invite friends'}</button>
      <button className="pill pill-block" type="button" onClick={enter}>Enter battlefield</button>
      <p className="subtitle" aria-live="polite">{state.live ? '● Live' : '○ Connecting…'}</p>
    </main>
  );
}
