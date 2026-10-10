import navPlayers from '../assets/icons/navbar-players-active.svg';
import navMap from '../assets/icons/navbar-map-active.svg';

export type Tab = 'team' | 'map';

const ART: Record<Tab, string> = { team: navPlayers, map: navMap };

/**
 * Figma Navbar (348:2309): profile, map, settings. The exported art already draws the active icon,
 * so the buttons are transparent tap zones over it. Settings has no screen yet, so it stays inert.
 */
export function NavBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: 'relative', width: 'var(--size-navbar-w)', height: 'var(--size-navbar-h)', margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: `url("${ART[tab]}") center / 100% 100% no-repeat`,
      }}
    >
      <button type="button" className="nav-zone" aria-label="Teams" aria-current={tab === 'team' ? 'page' : undefined} onClick={() => onTab('team')} />
      <button type="button" className="nav-zone" aria-label="Map" aria-current={tab === 'map' ? 'page' : undefined} onClick={() => onTab('map')} />
      <button type="button" className="nav-zone" aria-label="Settings (coming later)" disabled />
    </nav>
  );
}
