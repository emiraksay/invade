import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { loadSession } from './data/session';
import { ConnectHealth } from './screens/ConnectHealth';
import { Join } from './screens/Join';
import { WalkPhase } from './screens/WalkPhase';
import { MapPreview, TablePreview } from './screens/MapPreview';
import { Table } from './screens/Table';

/** Signed-in players (session on this device) go to the game; everyone else joins first. */
function Home() {
  return <Navigate to={loadSession() ? '/walk' : '/join'} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/connect" element={<ConnectHealth />} />
        <Route path="/walk" element={<WalkPhase />} />
        <Route path="/table" element={<Table />} />
        {import.meta.env.DEV && <Route path="/preview/map" element={<MapPreview />} />}
        {import.meta.env.DEV && <Route path="/preview/table" element={<TablePreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
