import { useState } from 'react';
import { DEFAULT_MAP, MAX_SOLDIERS_PER_PLAYER, type TeamId } from '@invade/engine';
import { MapSvg } from '../map/MapSvg';
import { walkPhaseMapView, type TerritoryView } from '../map/model';

const MAX = 4 * MAX_SOLDIERS_PER_PLAYER + 4; // a full team of 4 at the cap, plus the +2B bonus

/** Dev only (`/preview/map`): the map with fake progress, so the renderer can be tuned without Supabase. */
export function MapPreview() {
  const [soldiers, setSoldiers] = useState<Record<TeamId, number>>({ white: 18, black: 6 });
  const [selected, setSelected] = useState<TerritoryView | null>(null);
  const view = walkPhaseMapView(DEFAULT_MAP, {
    white: { soldiers: soldiers.white, maxSoldiers: MAX },
    black: { soldiers: soldiers.black, maxSoldiers: MAX },
  });
  return (
    <main className="screen">
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 20, fontWeight: 700 }}>MAP PREVIEW</h1>
      <MapSvg view={view} selected={selected?.id} onTap={setSelected} />
      <p className="subtitle" style={{ minHeight: 20 }}>
        {selected ? `${selected.name} · ${selected.owner}${selected.isHq ? ' HQ' : ''} · charge ${Math.round(selected.charge * 100)}%` : 'Tap a territory'}
      </p>
      {(['white', 'black'] as TeamId[]).map((team) => (
        <label key={team} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          <span className="display">{team} · {soldiers[team]} / {MAX} soldiers</span>
          <input type="range" min={0} max={MAX} value={soldiers[team]} onChange={(e) => setSoldiers({ ...soldiers, [team]: Number(e.target.value) })} />
        </label>
      ))}
    </main>
  );
}
