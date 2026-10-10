import { lazy, Suspense, useMemo, useState } from 'react';
import { MapSvg } from './MapSvg';
import type { MapView, TerritoryView } from './model';

// three.js is ~600 kB, so it loads in its own chunk, only when the 3D map is actually shown.
const Map3D = lazy(() => import('./Map3D'));

export type MapMode = 'auto' | '3d' | 'svg';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface BattlefieldProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** 'auto' (default): 3D when WebGL works, otherwise the SVG map. */
  mode?: MapMode;
}

/** The battlefield, in 3D where possible and as the 2.5D SVG everywhere else. Same props either way. */
export function Battlefield({ view, selected, onTap, mode = 'auto' }: BattlefieldProps) {
  const webgl = useMemo(hasWebGL, []);
  const [ready, setReady] = useState(false);
  const use3d = mode === '3d' || (mode === 'auto' && webgl);
  const svg = <MapSvg view={view} selected={selected} onTap={onTap} />;
  if (!use3d) return svg;
  // The three.js chunk and the WebGL context take a moment on first load: keep the SVG on
  // screen until the 3D map can paint, then cross-fade. The screen is never blank.
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ opacity: ready ? 1 : 0, transition: 'opacity 400ms ease' }}>
        <Suspense fallback={null}>
          <Map3D view={view} selected={selected} onTap={onTap} onReady={() => setReady(true)} />
        </Suspense>
      </div>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', transform: 'scale(0.82)' }}>{svg}</div>
        </div>
      )}
    </div>
  );
}
