import { lazy, Suspense } from 'react';
import type { Map3DProps } from './Map3D';

// three.js is ~600 kB: load it after the screen shell so the page appears instantly.
const Map3D = lazy(() => import('./Map3D'));

/** The battlefield with a fixed-height slot, so the layout doesn't jump while the 3D code loads. */
export function LazyMap(props: Map3DProps & { height?: number }) {
  const { height = 380, ...rest } = props;
  return (
    <div style={{ height, margin: '0 -24px', position: 'relative' }}>
      <Suspense fallback={<p className="subtitle" style={{ paddingTop: height / 2 - 10 }}>Raising the battlefield…</p>}>
        <Map3D {...rest} />
      </Suspense>
    </div>
  );
}
