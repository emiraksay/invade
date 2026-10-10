import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MapSvg } from './MapSvg';
import type { MapView, TerritoryView } from './model';

// three.js is ~600 kB, so it loads in its own chunk, only when the 3D map is actually shown.
const Map3D = lazy(() => import('./Map3D'));

export type MapMode = 'auto' | '3d' | 'svg';

let webglProbe: boolean | null = null;
/** One probe per page load, and the probe context is released: iOS caps live WebGL contexts. */
function hasWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const c = document.createElement('canvas');
    const ctx = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    webglProbe = Boolean(ctx);
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

/** A failed chunk load or a three.js throw must never blank the screen: report it and let the parent show the SVG. */
class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[map] 3D map failed, falling back to SVG', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface BattlefieldProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** 'auto' (default): 3D when WebGL works, otherwise the SVG map. */
  mode?: MapMode;
  /** Bloom glow in 3D (projector yes, phones no by default). */
  bloom?: boolean;
}

/** The battlefield, in 3D where possible and as the 2.5D SVG everywhere else. Same props either way. */
export function Battlefield({ view, selected, onTap, mode = 'auto', bloom = false }: BattlefieldProps) {
  const webgl = useMemo(hasWebGL, []);
  const [ready, setReady] = useState(false);   // the 3D map has painted its first frame
  const [svgGone, setSvgGone] = useState(false); // the SVG finished fading out
  const [dead, setDead] = useState(false);       // 3D failed or lost its WebGL context for good
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setSvgGone(true), 450);
    return () => clearTimeout(id);
  }, [ready]);

  const use3d = !dead && (mode === '3d' || (mode === 'auto' && webgl));
  const svg = <MapSvg view={view} selected={selected} onTap={onTap} />;
  if (!use3d) return svg;
  // The three.js chunk and the first GL frame take a moment: the SVG stays on screen until the 3D
  // map has painted, then cross-fades out. The screen is never blank.
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ opacity: ready ? 1 : 0, transition: 'opacity 400ms ease' }}>
        <MapErrorBoundary onError={() => setDead(true)}>
          <Suspense fallback={null}>
            <Map3D view={view} selected={selected} onTap={onTap} onReady={() => setReady(true)} onContextDead={() => setDead(true)} bloom={bloom} />
          </Suspense>
        </MapErrorBoundary>
      </div>
      {!svgGone && (
        <div
          style={{
            position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center',
            opacity: ready ? 0 : 1, transition: 'opacity 400ms ease', pointerEvents: ready ? 'none' : undefined,
          }}
        >
          <div style={{ width: '100%', transform: 'scale(0.82)' }}>{svg}</div>
        </div>
      )}
    </div>
  );
}
