import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConnectHealth } from './screens/ConnectHealth';
import { Join } from './screens/Join';
import { WalkPhase } from './screens/WalkPhase';
import { Splash } from './screens/Splash';
import { Lobby } from './screens/Lobby';
import { MapPreview, TablePreview, WalkPreview } from './screens/MapPreview';
import { Table } from './screens/Table';

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
        {import.meta.env.DEV && <Route path="/preview/map" element={<MapPreview />} />}
        {import.meta.env.DEV && <Route path="/preview/table" element={<TablePreview />} />}
        {import.meta.env.DEV && <Route path="/preview/walk" element={<WalkPreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
