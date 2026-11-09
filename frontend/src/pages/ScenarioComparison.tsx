import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { compareScenarios } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmt = (n: any) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

export default function ScenarioComparison() {
  const [runIdsInput, setRunIdsInput] = useState('1');
  const [runIds, setRunIds]           = useState<number[]>([1]);

  const { data, isLoading } = useQuery({
    queryKey: ['compare', runIds],
    queryFn:  () => compareScenarios(runIds),
    enabled:  runIds.length > 0,
  });

  const handleCompare = () => {
    const ids = runIdsInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    setRunIds(ids);
  };

  // Prepare chart data
  const chartData = data?.results?.map((r: any) => ({
    label: `Run #${r.run_id} (${r.scenario_name?.slice(0, 15)}...)`,
    baseline_import: Number(r.baseline_import_value) / 1e9,
    estimated_import: Number(r.estimated_import_value_after) / 1e9,
    revenue_before: Number(r.estimated_revenue_before) / 1e9,
    revenue_after:  Number(r.estimated_revenue_after)  / 1e9,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>📈 Scenario Comparison & Sensitivity Analysis</h1>
        <p>
          Evaluate counterfactual trade outcomes across multiple policy simulations side-by-side.
          Compares bilateral import volumes, revenue deviations, and effective protection impacts.
        </p>
      </div>

      <div className="card">
        <div className="card-title">Enter Simulation Run IDs for Comparative Evaluation</div>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Run IDs (Comma-separated integers)</label>
            <input
              value={runIdsInput}
              onChange={e => setRunIdsInput(e.target.value)}
              placeholder="e.g. 1, 2, 3"
              style={{ minWidth: '280px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCompare} disabled={!runIdsInput.trim()}>
            ⚡ Execute Comparison
          </button>
        </div>
      </div>

      {data?.warnings?.length > 0 && (
        <div className="alert alert-warn">
          <div>
            <b>⚠️ Analytical Warnings / Heterogeneity:</b>
            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem' }}>
              {data.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading">
          <div className="loading-spinner" />
          <p>Compiling cross-scenario simulation metrics...</p>
        </div>
      )}

      {data?.results?.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Import Value Deviation (USD Billions)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis unit="B" stroke="#94a3b8" />
                  <Tooltip formatter={(v: any) => '$' + Number(v).toFixed(2) + 'B'} />
                  <Legend />
                  <Bar dataKey="baseline_import"  name="Baseline M₀"    fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="estimated_import" name="Estimated M₁"   fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Fiscal Revenue Impact (USD Billions)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis unit="B" stroke="#94a3b8" />
                  <Tooltip formatter={(v: any) => '$' + Number(v).toFixed(2) + 'B'} />
                  <Legend />
                  <Bar dataKey="revenue_before" name="Baseline Rev R₀" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue_after"  name="Simulated Rev R₁"  fill="#c084fc" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Multi-Run Detailed Metrics View</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparison Route: /api/scenarios/compare</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Scenario</th>
                    <th>Elasticity (ε)</th>
                    <th>Importer</th>
                    <th>Exporter</th>
                    <th>Product</th>
                    <th className="text-right">Current t₀</th>
                    <th className="text-right">Simulated t₁</th>
                    <th className="text-right">Baseline M₀</th>
                    <th className="text-right">Est. M₁</th>
                    <th className="text-right">Baseline R₀</th>
                    <th className="text-right">Est. R₁</th>
                    <th className="text-right">Δ Import %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>#{r.run_id}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.scenario_name}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.elasticity_assumption}</td>
                      <td>{r.importer_country}</td>
                      <td>{r.exporter_country}</td>
                      <td style={{ fontSize: '0.82rem' }}>HS {r.hs_code}</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(r.current_tariff_pct)}%</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', fontWeight: 600 }}>
                        {fmt(r.proposed_tariff_pct)}%
                      </td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>${fmt(r.baseline_import_value)}</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8', fontWeight: 600 }}>
                        ${fmt(r.estimated_import_value_after)}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>${fmt(r.estimated_revenue_before)}</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399', fontWeight: 600 }}>
                        ${fmt(r.estimated_revenue_after)}
                      </td>
                      <td
                        className={`text-right ${Number(r.estimated_import_change_pct) < 0 ? 'text-red' : 'text-green'}`}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                      >
                        {r.estimated_import_change_pct != null ? `${Number(r.estimated_import_change_pct) > 0 ? '+' : ''}${Number(r.estimated_import_change_pct).toFixed(2)}%` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${r.result_status === 'OK' ? 'badge-green' : 'badge-red'}`}>
                          {r.result_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
