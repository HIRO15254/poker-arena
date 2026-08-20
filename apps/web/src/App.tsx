import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { LeaderboardPage } from "./pages/Leaderboard";
import { PlayPage } from "./pages/Play";
import { BotsPage } from "./pages/Bots";
import { TablesPage } from "./pages/Tables";
import { TableDetailPage } from "./pages/TableDetail";
import { HandsPage } from "./pages/Hands";
import { HandReplayPage } from "./pages/HandReplay";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<LeaderboardPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/tables/:id" element={<TableDetailPage />} />
          <Route path="/hands" element={<HandsPage />} />
          <Route path="/hands/:id" element={<HandReplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
