import castle from '../assets/icons/stat-territories-castle.svg';
import helmet from '../assets/icons/stat-soldiers-helmet.svg';
import shoe from '../assets/icons/stat-steps-shoe.svg';
import flag from '../assets/icons/stat-flags.svg';

export interface Stats {
  teamSoldiers: number;
  mySoldiers: number;
  mySteps: number;
  territories: number;
}

const fmt = new Intl.NumberFormat('de-DE'); // Figma shows 9.321

/**
 * Figma PlayerInfo bar. The active stat is bright, the others dimmed (Walk Phase highlights steps);
 * `active={null}` shows all four bright, as on the Idle team panel.
 */
export function StatsBar({ stats, active = 'steps' }: { stats: Stats; active?: 'castle' | 'soldiers' | 'steps' | 'flags' | null }) {
  const items = [
    { key: 'castle', icon: castle, label: 'Team soldiers today', value: stats.teamSoldiers },
    { key: 'soldiers', icon: helmet, label: 'My soldiers today', value: stats.mySoldiers },
    { key: 'steps', icon: shoe, label: 'My steps today', value: stats.mySteps },
    { key: 'flags', icon: flag, label: 'Territories held', value: stats.territories },
  ] as const;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', margin: 0, textAlign: 'center' }}>
      {items.map((it) => (
        <div key={it.key} style={{ opacity: active === null || it.key === active ? 1 : 0.35, transition: 'opacity 200ms' }}>
          <dt><img src={it.icon} alt={it.label} height={26} /></dt>
          <dd style={{ margin: '4px 0 0', fontSize: 'var(--font-size-stat)' }}>{fmt.format(it.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
