import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WorldMap from './pages/WorldMap';
import TradeExplorer from './pages/TradeExplorer';
import TariffHistory from './pages/TariffHistory';
import Simulator from './pages/Simulator';
import ScenarioComparison from './pages/ScenarioComparison';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span>🌐</span>
          <div>
            Global Trade
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tariff Simulator
            </div>
          </div>
        </div>

        <div className="sidebar-title">Analytics & Visuals</div>
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          📊 Dashboard
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          🗺️ World Map
        </NavLink>
        <NavLink to="/trade" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          🔍 Trade Explorer
        </NavLink>

        <div className="sidebar-title" style={{ marginTop: '0.75rem' }}>Policy & Simulation</div>
        <NavLink to="/tariffs" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          📋 Tariff History
        </NavLink>
        <NavLink to="/simulator" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          ⚡ Tariff Simulator
        </NavLink>
        <NavLink to="/compare" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          📈 Scenario Compare
        </NavLink>

        <div className="sidebar-title" style={{ marginTop: '0.75rem' }}>System & Governance</div>
        <NavLink to="/admin" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          🛠 Admin / ETL
        </NavLink>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/trade" element={<TradeExplorer />} />
          <Route path="/tariffs" element={<TariffHistory />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/compare" element={<ScenarioComparison />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
