import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { loadSession } from './data/session';
import { ConnectHealth } from './screens/ConnectHealth';
import { Join } from './screens/Join';
import { WalkPhase } from './screens/WalkPhase';
import { MapPreview } from './map/MapPreview';

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
        {import.meta.env.DEV && <Route path="/dev/map" element={<MapPreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
