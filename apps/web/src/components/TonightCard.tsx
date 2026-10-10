import type { GameSettings, TeamDay, TeamId } from '@invade/engine';

/**
 * 🌙 Tonight: what happens when the Walk Phase ends (decision #13: the night phase is shown as the next
 * step, not built today). Numbers come from the engine's team summaries; the words are placeholders for Costi.
 */
export function TonightCard({ teams, settings, myTeam }: { teams: Record<TeamId, TeamDay>; settings: GameSettings; myTeam: TeamId }) {
  const mine = teams[myTeam];
  const theirs = teams[myTeam === 'white' ? 'black' : 'white'];
  const name = (t: TeamId) => settings.teamNames[t];
  const left = Math.max(0, mine.maxSoldiers - mine.soldiers);
  return (
    <section style={{ display: 'grid', gap: 8, padding: '14px 16px', borderRadius: 'var(--radius-item)', background: 'var(--color-surface-item)', boxShadow: 'var(--shadow-item)' }}>
      <h2 className="display" style={{ margin: 0, fontSize: 20 }}>🌙 Tonight</h2>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>
        At midnight the walk ends. <strong>{name(mine.team)}</strong> marches in <strong>{mine.soldiers}</strong> soldier{mine.soldiers === 1 ? '' : 's'},{' '}
        <strong>{name(theirs.team)}</strong> <strong>{theirs.soldiers}</strong>.
        {left > 0 && <> Your team can still earn <strong>{left}</strong> more today.</>}
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>
        Then both teams plan in secret: place, move, attack. Everyone taps Ready, and the map reveals every battle.
      </p>
    </section>
  );
}
