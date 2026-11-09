import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCountries, fetchProducts, fetchTradeBalance, fetchTopPartners } from '../api/client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  return n.toFixed(0);
};

export default function Dashboard() {
  const [countryId, setCountryId] = useState('');
  const [yearFrom, setYearFrom]   = useState('2020');
  const [yearTo, setYearTo]       = useState('2023');

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });

  const { data: balance, isLoading: loadBal } = useQuery({
    queryKey: ['balance', countryId, yearFrom, yearTo],
    queryFn:  () => fetchTradeBalance({ country_id: countryId, year_from: yearFrom, year_to: yearTo }),
    enabled: !!countryId,
  });

  const { data: topExport } = useQuery({
    queryKey: ['topExport', countryId, yearFrom, yearTo],
    queryFn:  () => fetchTopPartners({ reporter_id: countryId, flow: 'EXPORT', year_from: yearFrom, year_to: yearTo, limit: 5 }),
    enabled: !!countryId,
  });

  const { data: topImport } = useQuery({
    queryKey: ['topImport', countryId, yearFrom, yearTo],
    queryFn:  () => fetchTopPartners({ reporter_id: countryId, flow: 'IMPORT', year_from: yearFrom, year_to: yearTo, limit: 5 }),
    enabled: !!countryId,
  });

  const latestYear = balance?.[balance.length - 1];

  return (
    <div>
      <div className="page-header">
        <h1>Trade Dashboard</h1>
        <p>High-level trade summary for a selected reporting country.</p>
      </div>

      <div className="filter-row">
        <div className="form-group">
          <label>Reporter Country</label>
          <select value={countryId} onChange={e => setCountryId(e.target.value)}>
            <option value="">— Select —</option>
            {countries?.map((c: any) => (
              <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Year From</label>
          <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} min="2000" max="2030" />
        </div>
        <div className="form-group">
          <label>Year To</label>
          <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)} min="2000" max="2030" />
        </div>
      </div>

      {!countryId && (
        <div className="alert alert-info">Select a reporter country to view trade statistics.</div>
      )}

      {countryId && latestYear && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Exports (latest yr)</div>
            <div className="stat-value">${fmt(Number(latestYear.exports_usd))}</div>
            <div className="stat-sub">Year {latestYear.period_year}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Imports (latest yr)</div>
            <div className="stat-value">${fmt(Number(latestYear.imports_usd))}</div>
            <div className="stat-sub">Year {latestYear.period_year}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trade Balance</div>
            <div className={`stat-value ${Number(latestYear.trade_balance_usd) >= 0 ? 'text-green' : 'text-red'}`}>
              ${fmt(Number(latestYear.trade_balance_usd))}
            </div>
            <div className="stat-sub">Exports − Imports</div>
          </div>
        </div>
      )}

      {balance?.length > 0 && (
        <div className="card">
          <div className="card-title">Trade Balance Over Time (USD)</div>
          <div className="alert alert-info" style={{marginBottom:'0.75rem', fontSize:'0.8rem'}}>
            ℹ️ Reported balance using same reporter for both import and export flows. Source: data loaded in DB.
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={balance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period_year" />
              <YAxis tickFormatter={v => '$'+fmt(v)} />
              <Tooltip formatter={(v: any) => '$'+fmt(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="exports_usd" stroke="#3b82f6" name="Exports" dot={false} />
              <Line type="monotone" dataKey="imports_usd" stroke="#f97316" name="Imports" dot={false} />
              <Line type="monotone" dataKey="trade_balance_usd" stroke="#22c55e" name="Balance" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {topExport?.length > 0 && (
          <div className="card">
            <div className="card-title">Top 5 Export Partners</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topExport} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => '$'+fmt(v)} />
                <YAxis type="category" dataKey="partner_country" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => '$'+fmt(Number(v))} />
                <Bar dataKey="total_value_usd" fill="#3b82f6" name="Export Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {topImport?.length > 0 && (
          <div className="card">
            <div className="card-title">Top 5 Import Sources</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topImport} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => '$'+fmt(v)} />
                <YAxis type="category" dataKey="partner_country" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => '$'+fmt(Number(v))} />
                <Bar dataKey="total_value_usd" fill="#f97316" name="Import Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
