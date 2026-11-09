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
  Line,
  Marker,
} from 'react-simple-maps';
import { geoInterpolate } from 'd3-geo';
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

type MapLayer = 'scope' | 'balance' | 'volume' | 'bloc';
type ProjectionType = 'geoEqualEarth' | 'geoMercator' | 'geoOrthographic';
type ArcFilter = 'all' | 'export' | 'import';
type ArcSpeed = 'normal' | 'fast' | 'static';

export interface TradeArc {
  id: string;
  partnerName: string;
  partnerIso3: string;
  partnerEmoji: string;
  from: [number, number];
  to: [number, number];
  flow: 'export' | 'import';
  value: number;
  rank: number;
  points: Array<[number, number]>;
  strokeWidth: number;
}

// Compute great-circle geodesic curve coordinates
function getGeodesicPoints(from: [number, number], to: [number, number], steps: number = 28): Array<[number, number]> {
  try {
    const interpolator = geoInterpolate(from, to);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(interpolator(i / steps));
    }
    return pts;
  } catch {
    return [from, to];
  }
}

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
  const [selectedYear, setSelectedYear] = useState<number>(2023);
  const [mapLayer, setMapLayer] = useState<MapLayer>('scope');
  const [projection, setProjection] = useState<ProjectionType>('geoEqualEarth');
  const [showArcs, setShowArcs] = useState<boolean>(true);
  const [arcFilter, setArcFilter] = useState<ArcFilter>('all');
  const [arcSpeed, setArcSpeed] = useState<ArcSpeed>('normal');
  const [showHubLabels, setShowHubLabels] = useState<boolean>(true);
  const [hoveredArc, setHoveredArc] = useState<TradeArc | null>(null);
  const [arcTooltipPos, setArcTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // List of seeded database countries
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

  // Live PostgreSQL Trade Parameters
  const isDbCountry = Boolean(selectedCountry?.dbId);

  const { data: balanceData, isLoading: loadingBalance } = useQuery({
    queryKey: ['mapBalance', selectedCountry?.dbId, selectedYear],
    queryFn: () =>
      fetchTradeBalance({
        country_id: selectedCountry!.dbId,
        year_from: 2018,
        year_to: selectedYear,
      }),
    enabled: isDbCountry,
  });

  const { data: topExports } = useQuery({
    queryKey: ['mapTopExports', selectedCountry?.dbId, selectedYear],
    queryFn: () =>
      fetchTopPartners({
        reporter_id: selectedCountry!.dbId,
        flow: 'EXPORT',
        year_from: selectedYear,
        year_to: selectedYear,
        limit: 5,
      }),
    enabled: isDbCountry,
  });

  const { data: topImports } = useQuery({
    queryKey: ['mapTopImports', selectedCountry?.dbId, selectedYear],
    queryFn: () =>
      fetchTopPartners({
        reporter_id: selectedCountry!.dbId,
        flow: 'IMPORT',
        year_from: selectedYear,
        year_to: selectedYear,
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

  // Compute realistic Great-Circle geodesic trade network arcs
  const tradeArcs = useMemo(() => {
    if (!showArcs || !isDbCountry || !selectedCountry.coordinates) return [];
    const arcs: TradeArc[] = [];

    if (arcFilter === 'all' || arcFilter === 'export') {
      topExports?.forEach((p: any, idx: number) => {
        const partnerMeta = getCountryMetadata(p.partner_country);
        if (partnerMeta.coordinates) {
          const val = Number(p.total_value_usd);
          arcs.push({
            id: `exp-${p.partner_iso3 || idx}`,
            partnerName: p.partner_country,
            partnerIso3: partnerMeta.iso3,
            partnerEmoji: partnerMeta.flagEmoji,
            from: selectedCountry.coordinates,
            to: partnerMeta.coordinates,
            flow: 'export',
            value: val,
            rank: p.partner_rank ?? idx + 1,
            points: getGeodesicPoints(selectedCountry.coordinates, partnerMeta.coordinates, 28),
            strokeWidth: Math.max(1.8, Math.min(5.2, Math.sqrt(val / 1e9) * 0.44)),
          });
        }
      });
    }

    if (arcFilter === 'all' || arcFilter === 'import') {
      topImports?.forEach((p: any, idx: number) => {
        const partnerMeta = getCountryMetadata(p.partner_country);
        if (partnerMeta.coordinates) {
          const val = Number(p.total_value_usd);
          arcs.push({
            id: `imp-${p.partner_iso3 || idx}`,
            partnerName: p.partner_country,
            partnerIso3: partnerMeta.iso3,
            partnerEmoji: partnerMeta.flagEmoji,
            from: partnerMeta.coordinates,
            to: selectedCountry.coordinates,
            flow: 'import',
            value: val,
            rank: p.partner_rank ?? idx + 1,
            points: getGeodesicPoints(partnerMeta.coordinates, selectedCountry.coordinates, 28),
            strokeWidth: Math.max(1.8, Math.min(5.2, Math.sqrt(val / 1e9) * 0.44)),
          });
        }
      });
    }

    return arcs;
  }, [showArcs, isDbCountry, selectedCountry, topExports, topImports, arcFilter]);

  // Color resolver according to active choropleth layer (Light Theme Palette)
  const getCountryFill = (meta: CountryMeta, isSelected: boolean) => {
    if (isSelected) return '#f59e0b'; // Active selection: Vibrant Amber

    switch (mapLayer) {
      case 'balance':
        if (meta.defaultBalanceStatus === 'surplus') return '#a7f3d0'; // Light Emerald
        if (meta.defaultBalanceStatus === 'deficit') return '#fecaca'; // Light Rose
        return '#f1f5f9';

      case 'volume':
        if (meta.volumeTier === 'mega') return '#7dd3fc'; // Sky
        if (meta.volumeTier === 'high') return '#c7d2fe'; // Iris
        if (meta.volumeTier === 'medium') return '#e2e8f0';
        return '#f8fafc';

      case 'bloc':
        if (meta.tradeBloc === 'USMCA') return '#bae6fd';
        if (meta.tradeBloc === 'European Union') return '#c7d2fe';
        if (meta.tradeBloc === 'RCEP' || meta.tradeBloc === 'ASEAN / RCEP') return '#fde68a';
        if (meta.tradeBloc === 'Mercosur') return '#a7f3d0';
        if (meta.tradeBloc?.includes('CPTPP')) return '#ddd6fe';
        return '#e2e8f0';

      case 'scope':
      default:
        return meta.dbId ? '#c7d2fe' : '#e2e8f0';
    }
  };

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
        <h1>🗺️ Accurate World Trade Cartography & Network Intelligence</h1>
        <p>
          Standard Natural Earth projection displaying sovereign geographic borders. Click any country to query
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
            gap: '0.85rem',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          {/* Choropleth Layer Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '0.2rem' }}>
              CHOROPLETH LAYER:
            </span>
            <button
              className={`country-chip ${mapLayer === 'scope' ? 'active' : ''}`}
              onClick={() => setMapLayer('scope')}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
            >
              Relational DB Scope
            </button>
            <button
              className={`country-chip ${mapLayer === 'balance' ? 'active' : ''}`}
              onClick={() => setMapLayer('balance')}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
            >
              Surplus vs Deficit
            </button>
            <button
              className={`country-chip ${mapLayer === 'volume' ? 'active' : ''}`}
              onClick={() => setMapLayer('volume')}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
            >
              Trade Volume Tiers
            </button>
            <button
              className={`country-chip ${mapLayer === 'bloc' ? 'active' : ''}`}
              onClick={() => setMapLayer('bloc')}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
            >
              Trade Blocs
            </button>
          </div>

          {/* Tools: Arcs, Projection, Year & Zoom Controls */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Trade Arcs Toggle */}
            <button
              className={`btn btn-sm ${showArcs ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowArcs(!showArcs)}
              title="Toggle Bilateral Trade Flow Network Arcs"
            >
              {showArcs ? '🌐 Trade Arcs: ON' : '🌐 Trade Arcs: OFF'}
            </button>

            {/* Arc Filter Mode */}
            {showArcs && (
              <select
                value={arcFilter}
                onChange={(e) => setArcFilter(e.target.value as ArcFilter)}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--glass-border-light)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                title="Filter Arc Flow Direction"
              >
                <option value="all">Arcs: All (Exp & Imp)</option>
                <option value="export">Arcs: Exports Only (🟢)</option>
                <option value="import">Arcs: Imports Only (🟡)</option>
              </select>
            )}

            {/* Arc Flow Velocity */}
            {showArcs && (
              <select
                value={arcSpeed}
                onChange={(e) => setArcSpeed(e.target.value as ArcSpeed)}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--glass-border-light)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                title="Flow Velocity"
              >
                <option value="normal">Laser Speed: Normal</option>
                <option value="fast">Laser Speed: High</option>
                <option value="static">Laser Speed: Static</option>
              </select>
            )}

            {/* Hub Labels Toggle */}
            {showArcs && (
              <button
                className={`btn btn-sm ${showHubLabels ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => setShowHubLabels(!showHubLabels)}
                title="Toggle Partner Badges on Map"
                style={{ fontSize: '0.78rem' }}
              >
                🏷️ {showHubLabels ? 'Labels: ON' : 'Labels: OFF'}
              </button>
            )}

            {/* Projection Toggle */}
            <select
              value={projection}
              onChange={(e) => setProjection(e.target.value as ProjectionType)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--glass-border-light)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontWeight: 600,
              }}
              title="Cartographic Projection"
            >
              <option value="geoOrthographic">🌍 3D Spherical Globe</option>
              <option value="geoEqualEarth">🗺️ Equal Earth (2D)</option>
              <option value="geoMercator">🧭 Mercator</option>
            </select>

            {/* Observation Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--glass-border-light)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              <option value={2023}>Year 2023</option>
              <option value={2022}>Year 2022</option>
              <option value={2021}>Year 2021</option>
              <option value={2020}>Year 2020</option>
              <option value={2019}>Year 2019</option>
              <option value={2018}>Year 2018</option>
            </select>

            {/* Zoom Controls */}
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

        {/* Floating Mini HUD on Top-Right */}
        <div
          style={{
            position: 'absolute',
            top: '4.8rem',
            right: '1.75rem',
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(14px)',
            border: '1px solid var(--glass-border-light)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            zIndex: 30,
            maxWidth: '240px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
            Selected Economy HUD
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {selectedCountry.flagEmoji} {selectedCountry.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
            ISO: {selectedCountry.iso3} · {selectedCountry.region}
          </div>
          {latestTrade && (
            <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Exports:</span> <b style={{ color: '#059669' }}>${fmt(Number(latestTrade.exports_usd))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', marginTop: '0.2rem' }}>
                <span>Imports:</span> <b style={{ color: '#d97706' }}>${fmt(Number(latestTrade.imports_usd))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', marginTop: '0.2rem' }}>
                <span>Balance:</span>{' '}
                <b className={Number(latestTrade.trade_balance_usd) >= 0 ? 'text-green' : 'text-red'}>
                  ${fmt(Number(latestTrade.trade_balance_usd))}
                </b>
              </div>
            </div>
          )}
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

        {/* Real Accurate Cartographic SVG Map Canvas with Network Arcs */}
        <div className="map-svg-container world-map-viewport">
          {/* Arc Hover Telemetry Card */}
          {hoveredArc && arcTooltipPos && (
            <div
              className="arc-telemetry-badge"
              style={{ left: `${arcTooltipPos.x}px`, top: `${arcTooltipPos.y}px` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span>{hoveredArc.flow === 'export' ? '🚢 Outbound Export Corridor' : '📦 Inbound Import Supply Corridor'}</span>
                <span
                  style={{
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    background: hoveredArc.flow === 'export' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                    color: hoveredArc.flow === 'export' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${hoveredArc.flow === 'export' ? '#10b981' : '#f59e0b'}`,
                  }}
                >
                  Partner Rank #{hoveredArc.rank}
                </span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                {hoveredArc.flow === 'export'
                  ? `${selectedCountry.flagEmoji} ${selectedCountry.name} ➔ ${hoveredArc.partnerEmoji} ${hoveredArc.partnerName}`
                  : `${hoveredArc.partnerEmoji} ${hoveredArc.partnerName} ➔ ${selectedCountry.flagEmoji} ${selectedCountry.name}`}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Bilateral Trade Value: <b style={{ color: '#f8fafc' }}>${fmt(hoveredArc.value)} USD</b>
              </div>
            </div>
          )}

          <ComposableMap
            projection={projection}
            projectionConfig={{
              scale: projection === 'geoOrthographic' ? 240 : projection === 'geoEqualEarth' ? 165 : 115,
              rotate:
                projection === 'geoOrthographic' && selectedCountry?.coordinates
                  ? [-selectedCountry.coordinates[0], -selectedCountry.coordinates[1] * 0.65, 0]
                  : [0, 0, 0],
              center: [0, 0],
            }}
            style={{ width: '100%', height: '100%', outline: 'none' }}
          >
            <defs>
              {/* Photorealistic Ocean Depth Gradients */}
              <radialGradient id="ocean-depth" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="65%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
              {/* Photon Bloom Glow for Laser Arcs */}
              <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* 3D Celestial Atmosphere Halo Filter */}
              <filter id="halo-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 3D Globe Atmosphere Rim (rendered only in Orthographic Mode) */}
            {projection === 'geoOrthographic' && (
              <circle
                cx={400}
                cy={225}
                r={242}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3}
                opacity={0.35}
                filter="url(#halo-glow)"
                pointerEvents="none"
              />
            )}

            <ZoomableGroup
              zoom={position.zoom}
              center={projection === 'geoOrthographic' ? [0, 0] : position.coordinates}
              onMoveEnd={(pos) => {
                if (pos.coordinates && projection !== 'geoOrthographic') {
                  setPosition({ coordinates: pos.coordinates, zoom: pos.zoom });
                } else if (pos.zoom) {
                  setPosition((prev) => ({ ...prev, zoom: pos.zoom }));
                }
              }}
            >
              <Sphere
                stroke="#94a3b8"
                strokeWidth={projection === 'geoOrthographic' ? 0.9 : 0.5}
                id="sphere"
                fill={projection === 'geoOrthographic' ? 'url(#ocean-depth)' : 'rgba(240, 249, 255, 0.4)'}
              />
              <Graticule stroke="#cbd5e1" strokeWidth={0.5} step={[30, 30]} opacity={0.7} />
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
                        fill={getCountryFill(meta, isSelected)}
                        stroke={
                          isSelected
                            ? '#ffffff'
                            : isDb
                            ? '#4f46e5'
                            : '#94a3b8'
                        }
                        strokeWidth={isSelected ? 2.0 : isDb ? 1.0 : 0.6}
                        style={{
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'fill 0.2s ease, stroke 0.2s ease',
                        }}
                        className="rsm-geography"
                      />
                    );
                  })
                }
              </Geographies>

              {/* 1. Underlying Soft Glow Geodesic Corridor (Interactive Hover Target) */}
              {tradeArcs.map((arc) => (
                <Line
                  key={`arc-glow-${arc.id}`}
                  coordinates={arc.points}
                  stroke={arc.flow === 'export' ? '#10b981' : '#f59e0b'}
                  strokeWidth={arc.strokeWidth + 3.2}
                  strokeLinecap="round"
                  className="trade-arc-glow"
                  onMouseEnter={(evt) => {
                    setHoveredArc(arc);
                    setArcTooltipPos({ x: evt.clientX, y: evt.clientY - 12 });
                  }}
                  onMouseMove={(evt) => {
                    setArcTooltipPos({ x: evt.clientX, y: evt.clientY - 12 });
                  }}
                  onMouseLeave={() => {
                    setHoveredArc(null);
                    setArcTooltipPos(null);
                  }}
                />
              ))}

              {/* 2. Crisp Pulsing Laser Stream with Directional Motion */}
              {tradeArcs.map((arc) => {
                const isSelectedArc = hoveredArc?.id === arc.id;
                const animClass =
                  arcSpeed === 'fast'
                    ? arc.flow === 'export'
                      ? 'trade-arc-stream trade-arc-stream-fast-export'
                      : 'trade-arc-stream trade-arc-stream-fast-import'
                    : arcSpeed === 'normal'
                    ? arc.flow === 'export'
                      ? 'trade-arc-stream trade-arc-stream-export'
                      : 'trade-arc-stream trade-arc-stream-import'
                    : 'trade-arc-stream';

                return (
                  <Line
                    key={`arc-stream-${arc.id}`}
                    coordinates={arc.points}
                    stroke={
                      isSelectedArc
                        ? '#0284c7'
                        : arc.flow === 'export'
                        ? '#059669'
                        : '#d97706'
                    }
                    strokeWidth={isSelectedArc ? arc.strokeWidth + 1.4 : arc.strokeWidth}
                    className={animClass}
                    filter="url(#arc-glow)"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              {/* 3. Connected Trade Hubs with Animated Radar Pulse Beacons */}
              {tradeArcs.map((arc) => {
                const hubCoords = arc.flow === 'export' ? arc.to : arc.from;
                const isExp = arc.flow === 'export';
                return (
                  <Marker key={`hub-${arc.id}`} coordinates={hubCoords}>
                    <circle
                      r={4}
                      fill="none"
                      stroke={isExp ? '#10b981' : '#f59e0b'}
                      className="radar-hub-ring"
                    />
                    <circle
                      r={3.8}
                      fill={isExp ? '#10b981' : '#f59e0b'}
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                    {showHubLabels && (
                      <text
                        y={-10}
                        textAnchor="middle"
                        className="hub-label-text"
                      >
                        {arc.partnerEmoji} {arc.partnerIso3} (${fmt(arc.value)})
                      </text>
                    )}
                  </Marker>
                );
              })}

              {/* 4. Origin Selected Country Hub with Multi-Tier Sonar Rings */}
              {selectedCountry.coordinates && (
                <Marker coordinates={selectedCountry.coordinates}>
                  <circle r={6} fill="none" stroke="#0284c7" className="selected-hub-ring" />
                  <circle r={6.5} fill="#0284c7" stroke="#ffffff" strokeWidth={2} />
                  <circle r={2.5} fill="#ffffff" />
                  {showHubLabels && (
                    <text
                      y={-14}
                      textAnchor="middle"
                      className="hub-label-text"
                      style={{ fontSize: '11px', fill: '#0369a1' }}
                    >
                      📍 {selectedCountry.flagEmoji} {selectedCountry.iso3} (Origin)
                    </text>
                  )}
                </Marker>
              )}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Quick Country Selector Chips */}
        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.4rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Direct Jump to Economy ({filteredChips.length} shown)
            </div>
            <input
              type="text"
              placeholder="🔍 Search economy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.25rem 0.65rem',
                fontSize: '0.78rem',
                minWidth: '160px',
                background: 'var(--bg-input)',
                border: '1px solid var(--glass-border-light)',
                borderRadius: '6px',
                color: '#fff',
                outline: 'none',
              }}
            />
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
                    {selectedCountry.tradeBloc && (
                      <span className="badge badge-yellow">Trade Bloc: {selectedCountry.tradeBloc}</span>
                    )}
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
                        <div className="stat-sub">Reporting Year: {selectedYear}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Total Imports (USD)</div>
                        <div className="stat-value text-amber">${fmt(Number(latestTrade.imports_usd))}</div>
                        <div className="stat-sub">Reporting Year: {selectedYear}</div>
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
                        <span>📈 Multi-Year Trade Trajectory: {selectedCountry.name} (2020–{selectedYear})</span>
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
                      <div className="card-title">🔼 Top 5 Export Destination Partners (Year {selectedYear})</div>
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
                          No bilateral export observations recorded for {selectedYear}.
                        </p>
                      )}
                    </div>

                    {/* Top Import Sources */}
                    <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 0 }}>
                      <div className="card-title">🔽 Top 5 Import Source Partners (Year {selectedYear})</div>
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
                          No bilateral import observations recorded for {selectedYear}.
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
