import { useQuery } from '@tanstack/react-query';
import { fetchBatches } from '../api/client';

const fmt = (n: any) => n != null ? Number(n).toLocaleString() : '—';

export default function AdminPage() {
  const { data: batches, isLoading } = useQuery({ queryKey: ['batches'], queryFn: fetchBatches });

  return (
    <div>
      <div className="page-header">
        <h1>Admin / ETL Monitor</h1>
        <p>Inspect data ingestion batches and data quality metrics.</p>
      </div>

      <div className="alert alert-info">
        ℹ️ Each ingestion batch records how many rows were loaded vs rejected. 
        Rejected rows are logged with reasons and never silently discarded.
      </div>

      {isLoading && <div className="loading">Loading…</div>}

      {batches?.length > 0 && (
        <div className="card">
          <div className="card-title">Ingestion Batches ({batches.length})</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Source</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th className="text-right">Input</th>
                  <th className="text-right">Loaded</th>
                  <th className="text-right">Rejected</th>
                  <th className="text-right">Rejection %</th>
                  <th>Error Summary</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b: any) => (
                  <tr key={b.batch_id}>
                    <td>#{b.batch_id}</td>
                    <td>{b.source_name}</td>
                    <td style={{ fontSize: '0.8rem' }}>{b.started_at ? new Date(b.started_at).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{b.completed_at ? new Date(b.completed_at).toLocaleString() : '—'}</td>
                    <td>
                      <span className={`badge ${b.batch_status === 'COMPLETED' ? 'badge-green' : b.batch_status === 'FAILED' ? 'badge-red' : 'badge-yellow'}`}>
                        {b.batch_status}
                      </span>
                    </td>
                    <td className="text-right">{fmt(b.input_record_count)}</td>
                    <td className="text-right">{fmt(b.loaded_record_count)}</td>
                    <td className="text-right">{fmt(b.rejected_record_count)}</td>
                    <td className={`text-right ${Number(b.rejection_rate_pct) > 10 ? 'text-red' : ''}`}>
                      {b.rejection_rate_pct != null ? b.rejection_rate_pct + '%' : '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{b.error_summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">DBMS Evidence Notes</div>
        <ul style={{ lineHeight: '1.9', fontSize: '0.9rem', color: '#374151', paddingLeft: '1.2rem' }}>
          <li>✅ <b>Schema:</b> 13 tables — 3NF normalized with PKs, FKs, check constraints, and business unique keys</li>
          <li>✅ <b>Views:</b> 6 reusable views (trade balance, top partners, product summary, tariff history, scenario latest run, comparison)</li>
          <li>✅ <b>Stored Functions:</b> <code>get_effective_tariff_rate</code>, <code>run_tariff_scenario</code>, <code>validate_scenario</code>, <code>get_yoy_growth</code></li>
          <li>✅ <b>Triggers:</b> Audit trigger on <code>tariff_policy</code> → <code>tariff_audit</code> (I/U/D); auto-updated_at triggers</li>
          <li>✅ <b>Transactions:</b> Scenario creation is atomic; simulation run rolls back on failure</li>
          <li>✅ <b>Indexes:</b> Composite indexes on reporter/year/flow, product/year, partner, tariff scope/dates</li>
          <li>✅ <b>Analytics Queries:</b> 12 SQL queries including CTEs, window functions (LAG, RANK), aggregations</li>
          <li>✅ <b>ETL:</b> Staging → validation → deduplication → batch tracking with rejection counts</li>
          <li>✅ <b>Temporal data:</b> Tariff records use effective_from/effective_to — history preserved, not overwritten</li>
          <li>✅ <b>Simulation:</b> Constant-elasticity model with stored assumptions, labelled estimates</li>
        </ul>
      </div>
    </div>
  );
}
