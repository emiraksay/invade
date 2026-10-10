import { territoryShare, type TeamId, type WarState } from '@invade/engine';

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Day of the season week in `timezone`: Monday = 1 … Sunday = 7 (the final). */
export function seasonDay(date: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(date);
  return WEEKDAY[name] ?? 1;
}

/** "DAY 6 OF 7 · SUNDAY IS THE FINAL" plus the White | Black share of the map. */
export function SeasonBar({ war, teamNames, timezone, big = false }: {
  war: WarState;
  teamNames: Record<TeamId, string>;
  timezone: string;
  big?: boolean;
}) {
  const day = seasonDay(new Date(), timezone);
  const white = Math.round(territoryShare(war, 'white') * 100);
  const black = Math.round(territoryShare(war, 'black') * 100);
  const fs = big ? 28 : 13;

  return (
    <section style={{ display: 'grid', gap: big ? 12 : 6 }} aria-label="Season">
      <p className="display" style={{ margin: 0, fontSize: big ? 36 : 15, textAlign: 'center' }}>
        {day === 7 ? 'Day 7 of 7 · Final day' : `Day ${day} of 7 · Sunday is the final`}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fs, fontWeight: 700, textTransform: 'uppercase' }}>
        <span>{teamNames.white} {white}%</span>
        <span>{black}% {teamNames.black}</span>
      </div>
      <div
        role="img"
        aria-label={`${teamNames.white} ${white}%, ${teamNames.black} ${black}%`}
        style={{
          display: 'flex', height: big ? 22 : 10, borderRadius: big ? 11 : 5, overflow: 'hidden',
          background: 'var(--color-track)', border: '1px solid var(--color-text-muted)',
        }}
      >
        <div style={{ width: `${white}%`, background: 'var(--color-team-white)' }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: `${black}%`, background: '#3a3532' }} />
      </div>
    </section>
  );
}
