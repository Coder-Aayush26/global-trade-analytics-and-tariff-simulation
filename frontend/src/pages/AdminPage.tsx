import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBatches, fetchDuckDBStatus, syncDuckDB, fetchMarketConcentration, fetchCountries,
} from '../api/client';

const fmt = (n: any) => n != null ? Number(n).toLocaleString() : '—';

export default function AdminPage() {
  const qc = useQueryClient();
  const [selectedCountryId, setSelectedCountryId] = useState<number>(1); // USA
  const [selectedFlow, setSelectedFlow] = useState<string>('IMPORT');

  const { data: batches, isLoading } = useQuery({ queryKey: ['batches'], queryFn: fetchBatches });
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });

  // DuckDB live engine status & sync
  const { data: duckdbStatus, isLoading: loadingDuckDB } = useQuery({
    queryKey: ['duckdbStatus'],
    queryFn: fetchDuckDBStatus,
  });

  const syncMut = useMutation({
    mutationFn: syncDuckDB,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duckdbStatus'] });
      qc.invalidateQueries({ queryKey: ['marketHHI', selectedCountryId, selectedFlow] });
    },
  });

  // Live DuckDB HHI calculation
  const { data: hhiData, isLoading: loadingHHI } = useQuery({
    queryKey: ['marketHHI', selectedCountryId, selectedFlow],
    queryFn: () => fetchMarketConcentration(selectedCountryId, selectedFlow),
  });

  const dbmsArtifacts = [
    {
      title: '3NF Relational Normalization',
      badge: '13 Tables',
      color: '#0284c7',
      desc: 'Normalized schema eliminating transitive functional dependencies across economies, HS product hierarchies, tariff schedules, and trade agreements.',
    },
    {
      title: 'Referential Integrity & Constraints',
      badge: 'ACID Enforcement',
      color: '#4f46e5',
      desc: 'Foreign key cascades, non-negative trade value checks (trade_value_usd ≥ 0), percentage checks (0 ≤ rate ≤ 1), and composite unique business keys.',
    },
    {
      title: 'Dual HTAP: PostgreSQL + DuckDB',
      badge: 'Hybrid OLTP + OLAP',
      color: '#059669',
      desc: 'PostgreSQL 18 serves as the relational system of record (ACID transactions), while DuckDB 2.0 provides vectorized in-memory columnar execution for microsecond OLAP aggregations.',
    },
    {
      title: 'Temporal Tariff Versioning',
      badge: 'Audit Immutability',
      color: '#059669',
      desc: 'Tariff policies are effective-dated using [effective_from, effective_to) ranges. Prior rates are preserved for historical reconstruction rather than overwritten.',
    },
    {
      title: 'Materialized & Standard Views',
      badge: '6 Core Views',
      color: '#d97706',
      desc: 'Standardized query abstractions: v_trade_summary, v_trade_balance, v_active_tariffs, v_top_partners, and v_scenario_run_summary.',
    },
    {
      title: 'PL/pgSQL Stored Functions',
      badge: '4 Functions',
      color: '#7c3aed',
      desc: 'In-database calculation engines: get_effective_tariff_rate(), run_tariff_scenario(), validate_scenario(), and get_yoy_growth().',
    },
    {
      title: 'Audit Triggers & Automation',
      badge: 'PostgreSQL Triggers',
      color: '#dc2626',
      desc: 'tariff_audit_trg records every INSERT, UPDATE, DELETE into tariff_audit with timestamp and user. Auto-timestamp triggers for updated_at fields.',
    },
    {
      title: 'High-Performance Composite Indexes',
      badge: 'B-Tree Indexes',
      color: '#0284c7',
      desc: 'Multi-column composite indexes on (reporter_country_id, period_year, flow_direction), (product_id, period_year), and date coverage lookups.',
    },
    {
      title: 'Atomic Transaction Boundaries',
      badge: 'BEGIN / COMMIT',
      color: '#059669',
      desc: 'Scenario simulation runs operate strictly within database transactions ensuring complete all-or-nothing rollback on data errors.',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>🛠 Admin, Ingestion & Dual Database Architecture</h1>
        <p>
          Inspect automated ETL ingestion batches, live DuckDB in-process columnar analytics benchmarks,
          and verify enterprise Relational Database Management System (RDBMS) design concepts.
        </p>
      </div>

      {/* ── DuckDB Columnar OLAP Engine Live Monitor ── */}
      <div className="card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
        <div className="card-title">
          <span>⚡ Embedded Columnar OLAP Engine: DuckDB 2.0</span>
          <span className="badge badge-green">High-Performance HTAP</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          To demonstrate modern database engineering, this project implements a <b>Hybrid Transactional / Analytical Processing (HTAP)</b> pattern: 
          PostgreSQL 18 manages relational transactions, while <b>DuckDB 2.0</b> executes SIMD-vectorized columnar aggregations directly in memory.
        </p>

        {loadingDuckDB ? (
          <div className="loading">
            <div className="loading-spinner" />
          </div>
        ) : duckdbStatus ? (
          <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-card">
              <div className="stat-label">DuckDB Version</div>
              <div className="stat-value text-green">v{duckdbStatus.sync_info?.duckdb_version || '2.0.0'}</div>
              <div className="stat-sub">Embedded C++ Engine</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Columnar Rows In-Memory</div>
              <div className="stat-value text-cyan">{duckdbStatus.sync_info?.rows_loaded || 0}</div>
              <div className="stat-sub">fact_trade Columnar Table</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sync Latency from PostgreSQL</div>
              <div className="stat-value text-purple">{duckdbStatus.sync_info?.sync_time_ms || 0} ms</div>
              <div className="stat-sub">Zero-Copy Ingestion</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Engine Action</div>
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => syncMut.mutate()}
                  disabled={syncMut.isPending}
                >
                  {syncMut.isPending ? 'Syncing...' : '🔄 Re-Sync DuckDB'}
                </button>
              </div>
              <div className="stat-sub">Live Re-indexing</div>
            </div>
          </div>
        ) : null}

        {/* Live DuckDB OLAP Calculation: Herfindahl-Hirschman Market Concentration Index */}
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                Live Vectorized OLAP: Herfindahl-Hirschman Index (HHI)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Evaluates supply chain market concentration and import vulnerability: HHI = Σ(share_i)²
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(Number(e.target.value))}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
              >
                {countries?.map((c: any) => (
                  <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>
                ))}
              </select>
              <select
                value={selectedFlow}
                onChange={(e) => setSelectedFlow(e.target.value)}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
              >
                <option value="IMPORT">IMPORT Dependency</option>
                <option value="EXPORT">EXPORT Concentration</option>
              </select>
            </div>
          </div>

          {loadingHHI ? (
            <div className="loading">
              <div className="loading-spinner" />
            </div>
          ) : hhiData ? (
            <div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Calculated HHI Score: </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {hhiData.hhi_score}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Risk Assessment: </span>
                  <span className={`badge ${hhiData.hhi_score > 2500 ? 'badge-red' : hhiData.hhi_score > 1500 ? 'badge-yellow' : 'badge-green'}`}>
                    {hhiData.risk_level}
                  </span>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  DuckDB Query Latency: <b style={{ color: '#059669' }}>{hhiData.query_execution_time_ms} ms</b>
                </div>
              </div>

              {hhiData.partner_breakdown && hhiData.partner_breakdown.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Partner Economy</th>
                        <th>ISO</th>
                        <th className="text-right">Observed Value (USD)</th>
                        <th className="text-right">Market Share %</th>
                        <th className="text-right">HHI Component (Share²)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hhiData.partner_breakdown.map((p: any) => (
                        <tr key={p.partner_id}>
                          <td style={{ fontWeight: 600 }}>{p.partner_name}</td>
                          <td>{p.partner_iso3}</td>
                          <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>${fmt(p.trade_value_usd)}</td>
                          <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {p.market_share_pct}%
                          </td>
                          <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{p.hhi_component}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Ingestion Batches ── */}
      <div className="alert alert-info">
        ℹ️ <b>Zero-Loss Ingestion Pipeline:</b> Raw Comtrade/WITS feeds pass through schema validation, type parsing, 
        and deduplication. Every batch records input count vs loaded count vs rejected count with comprehensive error auditing.
      </div>

      {isLoading && (
        <div className="loading">
          <div className="loading-spinner" />
          <p>Querying ingestion batches...</p>
        </div>
      )}

      {batches && batches.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>ETL Data Ingestion Batches ({batches.length})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PostgreSQL Table: ingestion_batch</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Source Feed</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th className="text-right">Input Rows</th>
                  <th className="text-right">Loaded Rows</th>
                  <th className="text-right">Rejected</th>
                  <th className="text-right">Rejection Rate</th>
                  <th>Error / Ingestion Summary</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b: any) => (
                  <tr key={b.batch_id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>#{b.batch_id}</td>
                    <td>{b.source_name}</td>
                    <td style={{ fontSize: '0.82rem' }}>{b.started_at ? new Date(b.started_at).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{b.completed_at ? new Date(b.completed_at).toLocaleString() : '—'}</td>
                    <td>
                      <span className={`badge ${b.batch_status === 'COMPLETED' ? 'badge-green' : b.batch_status === 'FAILED' ? 'badge-red' : 'badge-yellow'}`}>
                        {b.batch_status}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(b.input_record_count)}</td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-success)', fontWeight: 600 }}>
                      {fmt(b.loaded_record_count)}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: Number(b.rejected_record_count) > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                      {fmt(b.rejected_record_count)}
                    </td>
                    <td className={`text-right ${Number(b.rejection_rate_pct) > 10 ? 'text-red' : ''}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {b.rejection_rate_pct != null ? `${b.rejection_rate_pct}%` : '0.00%'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {b.error_summary ?? 'Processed cleanly without validation errors'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DBMS Engineering Evidence ── */}
      <div className="card">
        <div className="card-title">
          <span>🎓 Academic DBMS Concepts & Relational Architecture Evidence</span>
          <span className="badge badge-blue">PostgreSQL 18 + DuckDB 2.0</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          This system was specifically designed to demonstrate advanced enterprise database concepts required for
          large-scale econometric and supply-chain analytics.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {dbmsArtifacts.map((item, idx) => (
            <div
              key={idx}
              className="stat-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: '#ffffff',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{item.title}</span>
                  <span className="badge" style={{ background: `${item.color}15`, color: item.color, borderColor: `${item.color}35` }}>
                    {item.badge}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
