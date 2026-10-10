import { useState } from 'react';
import { DEFAULT_MAP, summarizeTeamDay, type GameSettings, type Player, type StepReport, type TeamId } from '@invade/engine';
import { TableView } from './Table';
import { Battlefield, type MapMode } from '../map/Battlefield';
import { walkPhaseMapView, type TerritoryView } from '../map/model';

// A full team of 4: the engine says what their daily maximum is (no rule re-implemented here).
const FULL_TEAM: Player[] = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, team: 'white' }));
const MAX = summarizeTeamDay('white', FULL_TEAM, [], '2026-10-10').maxSoldiers;

/** Dev only (`/preview/map`): the map with fake progress, so the renderer can be tuned without Supabase. */
export function MapPreview() {
  const [soldiers, setSoldiers] = useState<Record<TeamId, number>>({ white: 18, black: 6 });
  const [selected, setSelected] = useState<TerritoryView | null>(null);
  const [mode, setMode] = useState<MapMode>('auto');
  const [bloom, setBloom] = useState(false);
  const view = walkPhaseMapView(DEFAULT_MAP, {
    white: { soldiers: soldiers.white, maxSoldiers: MAX },
    black: { soldiers: soldiers.black, maxSoldiers: MAX },
  });
  return (
    <main className="screen">
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 20, fontWeight: 700 }}>MAP PREVIEW</h1>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {(['auto', '3d', 'svg'] as MapMode[]).map((m) => (
          <button key={m} type="button" className="pill" style={{ fontSize: 14, opacity: mode === m ? 1 : 0.5 }} onClick={() => setMode(m)}>{m}</button>
        ))}
        <button type="button" className="pill" style={{ fontSize: 14, opacity: bloom ? 1 : 0.5 }} onClick={() => setBloom((b) => !b)}>bloom</button>
      </div>
      <Battlefield view={view} selected={selected?.id} onTap={setSelected} mode={mode} bloom={bloom} />
      <p className="subtitle" style={{ minHeight: 20 }}>
        {selected ? `${selected.name} · ${selected.owner}${selected.isHq ? ' HQ' : ''} · charge ${Math.round(selected.charge * 100)}%` : 'Tap a territory'}
      </p>
      {(['white', 'black'] as TeamId[]).map((team) => (
        <label key={team} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          <span className="display" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {team} · {soldiers[team]} / {MAX} soldiers
            <button type="button" className="pill" style={{ fontSize: 13, minHeight: 36, padding: '4px 14px' }} onClick={() => setSoldiers({ ...soldiers, [team]: Math.min(MAX, soldiers[team] + 4) })}>
              + sync (+4)
            </button>
          </span>
          <input type="range" min={0} max={MAX} value={soldiers[team]} onChange={(e) => setSoldiers({ ...soldiers, [team]: Number(e.target.value) })} />
        </label>
      ))}
    </main>
  );
}

const FAKE_PLAYERS: Player[] = [
  { id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'w2', name: 'Costi', team: 'white' },
  { id: 'w3', name: 'Varvara', team: 'white' }, { id: 'b1', name: 'Emir', team: 'black' },
  { id: 'b2', name: 'Hasan', team: 'black' }, { id: 'b3', name: 'Selin', team: 'black' },
];
const FAKE_STEPS: Record<string, number> = { w1: 11_240, w2: 6_120, w3: 3_400, b1: 12_900, b2: 4_980, b3: 0 };
const FAKE_SETTINGS: GameSettings = {
  campaignDays: 30, winThreshold: 0.51, walkPhaseHours: 24, timezone: 'Europe/Madrid', teamNames: { white: 'White', black: 'Black' },
};

/** Dev only (`/preview/table`): the projector view with fake players, no Supabase. */
export function TablePreview() {
  const day = '2026-10-10';
  const reports: StepReport[] = FAKE_PLAYERS.map((p) => ({ playerId: p.id, day, steps: FAKE_STEPS[p.id] ?? 0, source: 'demo', reportedAt: day }));
  const teams = {
    white: summarizeTeamDay('white', FAKE_PLAYERS, reports, day),
    black: summarizeTeamDay('black', FAKE_PLAYERS, reports, day),
  };
  return <TableView teams={teams} settings={FAKE_SETTINGS} live code="INVADE" />;
}
