import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Graticule,
  Sphere,
} from 'react-simple-maps';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { CountryMeta, getCountryMetadata, COUNTRY_METADATA } from '../components/worldMapData';
import { fetchTradeBalance, fetchTopPartners, fetchTariffs } from '../api/client';

const TOPO_JSON_URL = '/countries-110m.json';

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  return n.toLocaleString();
};

export default function WorldMap() {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState<CountryMeta>(
    COUNTRY_METADATA['United States of America']
  );
  const [hoveredCountry, setHoveredCountry] = useState<CountryMeta | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 15],
    zoom: 1,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // List of seeded database countries for quick access chips
  const seededCountries = useMemo(() => {
    return Object.values(COUNTRY_METADATA).filter((c) => c.dbId !== undefined);
  }, []);

  const filteredChips = useMemo(() => {
    if (!searchQuery) return seededCountries;
    return Object.values(COUNTRY_METADATA).filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.iso3.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, seededCountries]);

  // Live PostgreSQL Trade Parameters for the selected economy
  const isDbCountry = Boolean(selectedCountry?.dbId);

  const { data: balanceData, isLoading: loadingBalance } = useQuery({
    queryKey: ['mapBalance', selectedCountry?.dbId],
    queryFn: () =>
      fetchTradeBalance({
        country_id: selectedCountry!.dbId,
        year_from: 2020,
        year_to: 2023,
      }),
    enabled: isDbCountry,
  });

  const { data: topExports } = useQuery({
    queryKey: ['mapTopExports', selectedCountry?.dbId],
    queryFn: () =>
      fetchTopPartners({
        reporter_id: selectedCountry!.dbId,
        flow: 'EXPORT',
        year_from: 2020,
        year_to: 2023,
        limit: 5,
      }),
    enabled: isDbCountry,
  });

  const { data: topImports } = useQuery({
    queryKey: ['mapTopImports', selectedCountry?.dbId],
    queryFn: () =>
      fetchTopPartners({
        reporter_id: selectedCountry!.dbId,
        flow: 'IMPORT',
        year_from: 2020,
        year_to: 2023,
        limit: 5,
      }),
    enabled: isDbCountry,
  });

  const { data: activeTariffs } = useQuery({
    queryKey: ['mapTariffs', selectedCountry?.dbId],
    queryFn: () =>
      fetchTariffs({
        importer_id: selectedCountry!.dbId,
      }),
    enabled: isDbCountry,
  });

  const latestTrade = balanceData && balanceData.length > 0 ? balanceData[balanceData.length - 1] : null;

  const handleZoomIn = () => {
    if (position.zoom >= 4) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom * 1.4 }));
  };

  const handleZoomOut = () => {
    if (position.zoom <= 0.8) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom / 1.4 }));
  };

  const handleReset = () => {
    setPosition({ coordinates: [0, 15], zoom: 1 });
  };

  return (
    <div>
      <div className="page-header">
        <h1>🗺️ Accurate World Trade Cartography</h1>
        <p>
          Standard Natural Earth projection displaying real sovereign borders. Click any country to query
          historical trade balances, bilateral trade partner dependencies, and statutory tariff policies.
        </p>
      </div>

      {/* ── World Map Container ── */}
      <div className="world-map-wrapper">
        {/* Top Control Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          {/* Map Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.82rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: '#312e81',
                  border: '1.5px solid #818cf8',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#ffffff', fontWeight: 600 }}>Relational Database Economies (12)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: '#1e2333',
                  border: '1px solid #3b4258',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Global Sovereign Economies (165+)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: '#0284c7',
                  border: '1.5px solid #ffffff',
                  boxShadow: '0 0 8px #0284c7',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#ffffff', fontWeight: 700 }}>Selected Economy</span>
            </span>
          </div>

          {/* Search & Zoom Controls */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Filter country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.38rem 0.75rem',
                fontSize: '0.82rem',
                minWidth: '180px',
                background: 'var(--bg-input)',
                border: '1px solid var(--glass-border-light)',
                borderRadius: '6px',
                color: '#fff',
                outline: 'none',
              }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleZoomIn} title="Zoom In">
              +
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleZoomOut} title="Zoom Out">
              −
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleReset} title="Reset View">
              Reset
            </button>
          </div>
        </div>

        {/* Hover Floating Tooltip */}
        {hoveredCountry && tooltipPos && (
          <div
            className="map-tooltip-box"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
            }}
          >
            <span>{hoveredCountry.flagEmoji} </span>
            <span>{hoveredCountry.name} </span>
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>({hoveredCountry.iso3})</span>
            {hoveredCountry.dbId && (
              <span className="badge badge-green" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>
                ✓ Relational Data Active
              </span>
            )}
          </div>
        )}

        {/* Real Accurate Cartographic SVG Map */}
        <div className="map-svg-container">
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{
              scale: 165,
              center: [0, 0],
            }}
            style={{ width: '100%', height: '100%', outline: 'none' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={(pos) => {
                if (pos.coordinates) {
                  setPosition({ coordinates: pos.coordinates, zoom: pos.zoom });
                }
              }}
            >
              <Sphere stroke="#1a1e2c" strokeWidth={0.5} id="sphere" fill="transparent" />
              <Graticule stroke="#151926" strokeWidth={0.5} />
              <Geographies geography={TOPO_JSON_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const countryName = geo.properties.name;
                    const meta = getCountryMetadata(countryName);
                    const isSelected = selectedCountry?.name === meta.name;
                    const isDb = Boolean(meta.dbId);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => setSelectedCountry(meta)}
                        onMouseEnter={(evt) => {
                          setHoveredCountry(meta);
                          const rect = evt.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseMove={(evt) => {
                          setTooltipPos({ x: evt.clientX, y: evt.clientY - 15 });
                        }}
                        onMouseLeave={() => {
                          setHoveredCountry(null);
                          setTooltipPos(null);
                        }}
                        fill={
                          isSelected
                            ? '#0284c7'
                            : isDb
                            ? '#312e81'
                            : '#1c202d'
                        }
                        stroke={
                          isSelected
                            ? '#ffffff'
                            : isDb
                            ? '#818cf8'
                            : '#2b3245'
                        }
                        strokeWidth={isSelected ? 1.8 : isDb ? 0.9 : 0.5}
                        style={{
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        className="rsm-geography"
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Quick Country Selector Chips */}
        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.35rem',
            }}
          >
            Direct Jump to Economy ({filteredChips.length} shown)
          </div>
          <div className="country-chips-grid">
            {filteredChips.map((c) => (
              <button
                key={c.name}
                className={`country-chip ${selectedCountry?.name === c.name ? 'active' : ''}`}
                onClick={() => setSelectedCountry(c)}
              >
                <span>{c.flagEmoji}</span>
                <span>{c.name}</span>
                {c.dbId && (
                  <span className="badge badge-green" style={{ padding: '0.05rem 0.35rem', fontSize: '0.65rem' }}>
                    #{c.dbId}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selected Country Parameters Intelligence Panel ── */}
      {selectedCountry && (
        <div className="country-intelligence-panel">
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
              borderBottom: '1px solid var(--glass-border)',
              paddingBottom: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '2.5rem' }}>{selectedCountry.flagEmoji}</span>
                <div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {selectedCountry.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">ISO: {selectedCountry.iso3} / {selectedCountry.iso2}</span>
                    <span className="badge badge-purple">Region: {selectedCountry.region}</span>
                    <span className="badge badge-gray">{selectedCountry.incomeGroup}</span>
                    {selectedCountry.dbId ? (
                      <span className="badge badge-green">✓ Relational Database Entity (ID: {selectedCountry.dbId})</span>
                    ) : (
                      <span className="badge badge-yellow">Sovereign Trading Partner</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/simulator')}>
                ⚡ Simulate Tariff Policy
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/trade')}>
                🔍 Bilateral Trades
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/tariffs')}>
                📋 Tariff Schedules
              </button>
            </div>
          </div>

          {/* Database Live Parameters */}
          {isDbCountry ? (
            <div>
              {loadingBalance ? (
                <div className="loading">
                  <div className="loading-spinner" />
                  <p>Querying relational database parameters for {selectedCountry.name}...</p>
                </div>
              ) : (
                <>
                  {/* KPI Stat Cards (High Contrast Emerald / Amber / Cyan / Purple) */}
                  {latestTrade && (
                    <div className="stat-grid">
                      <div className="stat-card">
                        <div className="stat-label">Total Exports (USD)</div>
                        <div className="stat-value text-green">${fmt(Number(latestTrade.exports_usd))}</div>
                        <div className="stat-sub">Reporting Year: {latestTrade.period_year}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Total Imports (USD)</div>
                        <div className="stat-value text-amber">${fmt(Number(latestTrade.imports_usd))}</div>
                        <div className="stat-sub">Reporting Year: {latestTrade.period_year}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Net Trade Balance</div>
                        <div className={`stat-value ${Number(latestTrade.trade_balance_usd) >= 0 ? 'text-green' : 'text-red'}`}>
                          ${fmt(Number(latestTrade.trade_balance_usd))}
                        </div>
                        <div className="stat-sub">
                          {Number(latestTrade.trade_balance_usd) >= 0 ? 'Surplus (Exports > Imports)' : 'Deficit (Imports > Exports)'}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Gross Economic Scale</div>
                        <div className="stat-value text-purple" style={{ fontSize: '1.45rem' }}>
                          {selectedCountry.gdpEstimate}
                        </div>
                        <div className="stat-sub">{selectedCountry.incomeGroup}</div>
                      </div>
                    </div>
                  )}

                  {/* Multi-Year Trade Flow Chart */}
                  {balanceData && balanceData.length > 0 && (
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div className="card-title">
                        <span>📈 Multi-Year Trade Trajectory: {selectedCountry.name} (2020–2023)</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source: UN Comtrade / WITS</span>
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={balanceData}>
                          <defs>
                            <linearGradient id="mapExportsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="mapImportsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
                          <XAxis dataKey="period_year" stroke="#94a3b8" />
                          <YAxis tickFormatter={(v) => '$' + fmt(v)} stroke="#94a3b8" />
                          <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
                          <Area
                            type="monotone"
                            dataKey="exports_usd"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#mapExportsGrad)"
                            name="Exports (USD)"
                          />
                          <Area
                            type="monotone"
                            dataKey="imports_usd"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fill="url(#mapImportsGrad)"
                            name="Imports (USD)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Top Partners Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                      gap: '1.25rem',
                      marginTop: '1.25rem',
                    }}
                  >
                    {/* Top Export Destinations */}
                    <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 0 }}>
                      <div className="card-title">🔼 Top 5 Export Destination Partners</div>
                      {topExports && topExports.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={topExports} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
                            <XAxis type="number" tickFormatter={(v) => '$' + fmt(v)} stroke="#94a3b8" />
                            <YAxis
                              type="category"
                              dataKey="partner_country"
                              width={110}
                              tick={{ fontSize: 11, fill: '#cbd5e1' }}
                            />
                            <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
                            <Bar dataKey="total_value_usd" fill="#10b981" radius={[0, 4, 4, 0]} name="Export Value" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No bilateral export observations recorded.
                        </p>
                      )}
                    </div>

                    {/* Top Import Sources */}
                    <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 0 }}>
                      <div className="card-title">🔽 Top 5 Import Source Partners</div>
                      {topImports && topImports.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={topImports} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
                            <XAxis type="number" tickFormatter={(v) => '$' + fmt(v)} stroke="#94a3b8" />
                            <YAxis
                              type="category"
                              dataKey="partner_country"
                              width={110}
                              tick={{ fontSize: 11, fill: '#cbd5e1' }}
                            />
                            <Tooltip formatter={(v: any) => '$' + fmt(Number(v))} />
                            <Bar dataKey="total_value_usd" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Import Value" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No bilateral import observations recorded.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Active Tariffs Table */}
                  {activeTariffs && activeTariffs.length > 0 && (
                    <div
                      className="card"
                      style={{ background: 'var(--bg-surface)', marginTop: '1.25rem', marginBottom: 0 }}
                    >
                      <div className="card-title">📜 Active Effective Tariff Policies for {selectedCountry.name}</div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Scope & Preference</th>
                              <th>Tariff Type</th>
                              <th className="text-right">Rate %</th>
                              <th>Effective Range</th>
                              <th>Policy Schedule Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeTariffs.slice(0, 5).map((t: any) => (
                              <tr key={t.tariff_policy_id}>
                                <td>
                                  {t.exporter_country_id ? (
                                    <span className="badge badge-green">Preferential Bilateral</span>
                                  ) : (
                                    <span className="badge badge-gray">General / MFN</span>
                                  )}
                                </td>
                                <td>{t.tariff_type}</td>
                                <td
                                  className="text-right"
                                  style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontWeight: 700,
                                    color: '#38bdf8',
                                  }}
                                >
                                  {Number(t.tariff_rate_pct).toFixed(2)}%
                                </td>
                                <td style={{ fontSize: '0.82rem' }}>
                                  {t.effective_from} → {t.effective_to ?? 'Active (Indefinite)'}
                                </td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                  {t.policy_note ?? 'Standard statutory schedule line'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Non-seeded Sovereign Economy Profile */
            <div>
              <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
                ℹ️ <b>Sovereign Economy Profile:</b> {selectedCountry.name} is an active international trade actor in{' '}
                {selectedCountry.region}. Bilateral trade observations for this market can be registered through the
                ETL Ingestion Pipeline or dynamically simulated in the Tariff Simulator.
              </div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Estimated Economic Scale</div>
                  <div className="stat-value text-purple">{selectedCountry.gdpEstimate}</div>
                  <div className="stat-sub">World Bank Macro Indicators</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Major Export Commodities</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', marginTop: '0.6rem' }}>
                    {selectedCountry.majorProducts}
                  </div>
                  <div className="stat-sub">Harmonized System Chapters</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Income Group Classification</div>
                  <div className="stat-value text-cyan" style={{ fontSize: '1.35rem' }}>
                    {selectedCountry.incomeGroup}
                  </div>
                  <div className="stat-sub">{selectedCountry.region}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
