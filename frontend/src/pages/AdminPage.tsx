import { useQuery } from '@tanstack/react-query';
import { fetchBatches } from '../api/client';

const fmt = (n: any) => n != null ? Number(n).toLocaleString() : '—';

export default function AdminPage() {
  const { data: batches, isLoading } = useQuery({ queryKey: ['batches'], queryFn: fetchBatches });

  const dbmsArtifacts = [
    {
      title: '3NF Relational Normalization',
      badge: '13 Tables',
      color: '#38bdf8',
      desc: 'Normalized schema eliminating transitive functional dependencies across economies, HS product hierarchies, tariff schedules, and trade agreements.',
    },
    {
      title: 'Referential Integrity & Constraints',
      badge: 'ACID Enforcement',
      color: '#818cf8',
      desc: 'Foreign key cascades, non-negative trade value checks (trade_value_usd ≥ 0), percentage checks (0 ≤ rate ≤ 1), and composite unique business keys.',
    },
    {
      title: 'Temporal Tariff Versioning',
      badge: 'Audit Immutability',
      color: '#34d399',
      desc: 'Tariff policies are effective-dated using [effective_from, effective_to) ranges. Prior rates are preserved for historical reconstruction rather than overwritten.',
    },
    {
      title: 'Materialized & Standard Views',
      badge: '6 Core Views',
      color: '#f59e0b',
      desc: 'Standardized query abstractions: v_trade_summary, v_trade_balance, v_active_tariffs, v_top_partners, and v_scenario_run_summary.',
    },
    {
      title: 'PL/pgSQL Stored Functions',
      badge: '4 Functions',
      color: '#c084fc',
      desc: 'In-database calculation engines: get_effective_tariff_rate(), run_tariff_scenario(), validate_scenario(), and get_yoy_growth().',
    },
    {
      title: 'Audit Triggers & Automation',
      badge: 'PostgreSQL Triggers',
      color: '#f43f5e',
      desc: 'tariff_audit_trg records every INSERT, UPDATE, DELETE into tariff_audit with timestamp and user. Auto-timestamp triggers for updated_at fields.',
    },
    {
      title: 'High-Performance Composite Indexes',
      badge: 'B-Tree Indexes',
      color: '#06b6d4',
      desc: 'Multi-column composite indexes on (reporter_country_id, period_year, flow_direction), (product_id, period_year), and date coverage lookups.',
    },
    {
      title: 'Atomic Transaction Boundaries',
      badge: 'BEGIN / COMMIT',
      color: '#a3e635',
      desc: 'Scenario simulation runs operate strictly within database transactions ensuring complete all-or-nothing rollback on data errors.',
    },
    {
      title: 'ETL Batch & Data Quality Logging',
      badge: 'Ingestion Tracking',
      color: '#e879f9',
      desc: 'Staging table quarantine: invalid records are audited in ingestion_error rather than silently discarded, computing live rejection percentages.',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>🛠 Admin, Ingestion & DBMS Architecture</h1>
        <p>
          Inspect automated ETL pipeline ingestion batches, data quality metrics, and verify core Relational
          Database Management System (RDBMS) design concepts.
        </p>
      </div>

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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Metadata Table: ingestion_batch</span>
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
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399', fontWeight: 600 }}>
                      {fmt(b.loaded_record_count)}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: Number(b.rejected_record_count) > 0 ? '#f87171' : 'var(--text-muted)' }}>
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
          <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>PostgreSQL 18 Local Engine</span>
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
                background: 'rgba(15, 23, 42, 0.45)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{item.title}</span>
                  <span className="badge" style={{ background: `${item.color}20`, color: item.color, borderColor: `${item.color}50` }}>
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
