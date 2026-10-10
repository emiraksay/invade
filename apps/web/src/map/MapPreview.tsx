import { useState } from 'react';
import { LazyMap } from './LazyMap';

/** Dev-only playground (/dev/map): tune the map's look without joining a game. */
export function MapPreview() {
  const [white, setWhite] = useState(0.6);
  const [black, setBlack] = useState(0.3);
  return (
    <main className="screen">
      <h1 className="display title" style={{ fontSize: 20 }}>Map preview</h1>
      <LazyMap fill={{ white, black }} myTeam="white" height={460} />
      <label>White army {Math.round(white * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={white} onChange={(e) => setWhite(+e.target.value)} style={{ width: '100%' }} />
      </label>
      <label>Black army {Math.round(black * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={black} onChange={(e) => setBlack(+e.target.value)} style={{ width: '100%' }} />
      </label>
    </main>
  );
}
