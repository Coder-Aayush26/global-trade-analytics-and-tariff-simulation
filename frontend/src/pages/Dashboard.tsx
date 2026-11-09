import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCountries, fetchTradeBalance, fetchTopPartners, fetchYoYGrowth,
} from '../api/client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area,
} from 'recharts';

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  return n.toLocaleString();
};

export default function Dashboard() {
  const [countryId, setCountryId] = useState('1'); // Default to USA (1) for immediate high-impact visuals
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

  const { data: yoyGrowth } = useQuery({
    queryKey: ['yoyGrowth', countryId],
    queryFn:  () => fetchYoYGrowth({ country_id: countryId, flow: 'EXPORT' }),
    enabled: !!countryId,
  });

  const latestYear = balance?.[balance.length - 1];
  const selectedCountryObj = countries?.find((c: any) => String(c.country_id) === String(countryId));

  const totalVolume = latestYear ? Number(latestYear.exports_usd) + Number(latestYear.imports_usd) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>📊 Relational Trade Dashboard</h1>
        <p>High-level macroeconomic trade overview, bilateral partner dependencies, and multi-year balance trends.</p>
      </div>

      {/* Filter Row */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label>Reporting Economy</label>
            <select value={countryId} onChange={e => setCountryId(e.target.value)}>
              <option value="">— Select Country —</option>
              {countries?.map((c: any) => (
                <option key={c.country_id} value={c.country_id}>
                  {c.country_name} ({c.iso3})
                </option>
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
      </div>

      {!countryId && (
        <div className="alert alert-info">
          ℹ️ Select a reporting country above to analyze historical trade parameters.
        </div>
      )}

      {/* KPI Stats Grid */}
      {countryId && latestYear && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Exports (USD)</div>
            <div className="stat-value text-green">${fmt(Number(latestYear.exports_usd))}</div>
            <div className="stat-sub">Reporting Year: {latestYear.period_year}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Imports (USD)</div>
            <div className="stat-value text-amber">${fmt(Number(latestYear.imports_usd))}</div>
            <div className="stat-sub">Reporting Year: {latestYear.period_year}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trade Balance</div>
            <div className={`stat-value ${Number(latestYear.trade_balance_usd) >= 0 ? 'text-green' : 'text-red'}`}>
              ${fmt(Number(latestYear.trade_balance_usd))}
            </div>
            <div className="stat-sub">{Number(latestYear.trade_balance_usd) >= 0 ? 'Surplus (Exports > Imports)' : 'Deficit (Imports > Exports)'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gross Trade Volume</div>
            <div className="stat-value text-purple">${fmt(totalVolume)}</div>
            <div className="stat-sub">Bilateral Exchange Pool</div>
          </div>
        </div>
      )}

      {/* Main Trade Balance Area Chart */}
      {balance?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>📈 Multi-Year Trade Balance Flow: {selectedCountryObj?.country_name || 'Selected Country'}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source: UN Comtrade Observations</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={balance}>
              <defs>
                <linearGradient id="colorExports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorImports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
              <XAxis dataKey="period_year" stroke="#94a3b8" />
              <YAxis tickFormatter={v => '$' + fmt(v)} stroke="#94a3b8" />
              <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="exports_usd" stroke="#10b981" strokeWidth={2.2} fill="url(#colorExports)" name="Exports (USD)" />
              <Area type="monotone" dataKey="imports_usd" stroke="#f59e0b" strokeWidth={2.2} fill="url(#colorImports)" name="Imports (USD)" />
              <Line type="monotone" dataKey="trade_balance_usd" stroke="#38bdf8" strokeWidth={2.5} name="Net Balance" strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top 5 Partners Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {topExport?.length > 0 && (
          <div className="card">
            <div className="card-title">🔼 Top 5 Export Destination Partners</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={topExport} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
                <XAxis type="number" tickFormatter={v => '$' + fmt(v)} stroke="#94a3b8" />
                <YAxis type="category" dataKey="partner_country" width={110} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
                <Bar dataKey="total_value_usd" fill="#10b981" radius={[0, 4, 4, 0]} name="Export Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {topImport?.length > 0 && (
          <div className="card">
            <div className="card-title">🔽 Top 5 Import Source Partners</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={topImport} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
                <XAxis type="number" tickFormatter={v => '$' + fmt(v)} stroke="#94a3b8" />
                <YAxis type="category" dataKey="partner_country" width={110} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
                <Bar dataKey="total_value_usd" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Import Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Year-over-Year Growth Stored Function Chart (if available) */}
      {yoyGrowth && yoyGrowth.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-title">
            <span>⚡ Stored Function: Year-over-Year Export Growth (<code>get_yoy_growth</code>)</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yoyGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="period_year" stroke="#94a3b8" />
              <YAxis unit="%" stroke="#94a3b8" />
              <Tooltip formatter={(v: any) => Number(v).toFixed(2) + '%'} />
              <Bar dataKey="yoy_growth_pct" fill="#a855f7" radius={[4, 4, 0, 0]} name="YoY Export Growth %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
