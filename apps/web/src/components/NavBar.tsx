import navPlayers from '../assets/icons/navbar-players-active.svg';
import navMap from '../assets/icons/navbar-map-active.svg';
import navSettings from '../assets/icons/navbar-settings-active.svg';

export type Tab = 'team' | 'map' | 'settings';

const ART: Record<Tab, string> = { team: navPlayers, map: navMap, settings: navSettings };

/**
 * Figma Navbar (348:2309): profile, map, settings. The exported art already draws the active icon,
 * so the buttons are transparent tap zones over it. It floats over the bottom of the screen.
 * `alert` puts a white dot on the helmet when a teammate needs a nudge.
 */
export function NavBar({ tab, onTab, alert = false }: { tab: Tab; onTab: (t: Tab) => void; alert?: boolean }) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 12px)', zIndex: 5, width: 'var(--size-navbar-w)', height: 'var(--size-navbar-h)', margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: `url("${ART[tab]}") center / 100% 100% no-repeat`,
      }}
    >
      <button type="button" className="nav-zone" aria-label={alert ? 'Teams (someone needs a nudge)' : 'Teams'} aria-current={tab === 'team' ? 'page' : undefined} onClick={() => onTab('team')}>
        {alert && <span className="nudge-dot nav-dot" aria-hidden />}
      </button>
      <button type="button" className="nav-zone" aria-label="Map" aria-current={tab === 'map' ? 'page' : undefined} onClick={() => onTab('map')} />
      <button type="button" className="nav-zone" aria-label="Settings" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => onTab('settings')} />
    </nav>
  );
}
