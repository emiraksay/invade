import { DemoWeek } from './screens/DemoWeek';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConnectHealth } from './screens/ConnectHealth';
import { Join } from './screens/Join';
import { WalkPhase } from './screens/WalkPhase';
import { Splash } from './screens/Splash';
import { Lobby } from './screens/Lobby';
import { MapPreview, NightPreview, TablePreview, WalkPreview } from './screens/MapPreview';
import { Table } from './screens/Table';
import { NightReveal } from './screens/NightReveal';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/join" element={<Join />} />
        <Route path="/connect" element={<ConnectHealth />} />
        <Route path="/walk" element={<WalkPhase />} />
        <Route path="/table" element={<Table />} />
        <Route path="/night" element={<NightReveal />} />
        <Route path="/demo" element={<DemoWeek />} />
        {import.meta.env.DEV && <Route path="/preview/map" element={<MapPreview />} />}
        {import.meta.env.DEV && <Route path="/preview/table" element={<TablePreview />} />}
        {import.meta.env.DEV && <Route path="/preview/walk" element={<WalkPreview />} />}
        {import.meta.env.DEV && <Route path="/preview/night" element={<NightPreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
