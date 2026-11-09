import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TradeExplorer from './pages/TradeExplorer';
import TariffHistory from './pages/TariffHistory';
import Simulator from './pages/Simulator';
import ScenarioComparison from './pages/ScenarioComparison';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">🌐 Global Trade<br />Tariff Simulator</div>
        <NavLink to="/"              className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>📊 Dashboard</NavLink>
        <NavLink to="/trade"         className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>🔍 Trade Explorer</NavLink>
        <NavLink to="/tariffs"       className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>📋 Tariff History</NavLink>
        <NavLink to="/simulator"     className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>⚡ Tariff Simulator</NavLink>
        <NavLink to="/compare"       className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>📈 Scenario Compare</NavLink>
        <NavLink to="/admin"         className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>🛠 Admin / ETL</NavLink>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/trade"     element={<TradeExplorer />} />
          <Route path="/tariffs"   element={<TariffHistory />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/compare"   element={<ScenarioComparison />} />
          <Route path="/admin"     element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
