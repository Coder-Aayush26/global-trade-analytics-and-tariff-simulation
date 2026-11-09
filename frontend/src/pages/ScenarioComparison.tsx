import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { compareScenarios } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmt = (n: any) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

export default function ScenarioComparison() {
  const [runIdsInput, setRunIdsInput] = useState('');
  const [runIds, setRunIds]           = useState<number[]>([]);

  const { data, isLoading, error } = useQuery({
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
    label: `Run ${r.run_id} / ${r.scenario_name?.slice(0, 20)}`,
    baseline_import: Number(r.baseline_import_value) / 1e9,
    estimated_import: Number(r.estimated_import_value_after) / 1e9,
    revenue_before: Number(r.estimated_revenue_before) / 1e9,
    revenue_after:  Number(r.estimated_revenue_after)  / 1e9,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Scenario Comparison</h1>
        <p>Compare multiple simulation runs side-by-side. Only compare runs with compatible baselines and model versions.</p>
      </div>

      <div className="card">
        <div className="card-title">Enter Run IDs to Compare</div>
        <div className="filter-row">
          <div className="form-group">
            <label>Run IDs (comma-separated)</label>
            <input
              value={runIdsInput}
              onChange={e => setRunIdsInput(e.target.value)}
              placeholder="e.g. 1, 2, 3"
              style={{ minWidth: '250px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCompare} disabled={!runIdsInput.trim()}>
            Compare
          </button>
        </div>
      </div>

      {data?.warnings?.length > 0 && (
        <div className="alert alert-warn">
          <b>⚠️ Comparison warnings:</b>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
            {data.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {isLoading && <div className="loading">Loading…</div>}

      {data?.results?.length > 0 && (
        <>
          <div className="card">
            <div className="card-title">Import Value Comparison (USD Billions)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis unit="B" />
                <Tooltip formatter={(v: any) => '$' + Number(v).toFixed(2) + 'B'} />
                <Legend />
                <Bar dataKey="baseline_import"  name="Baseline Import"    fill="#3b82f6" />
                <Bar dataKey="estimated_import" name="Estimated Import"   fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Revenue Comparison (USD Billions)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis unit="B" />
                <Tooltip formatter={(v: any) => '$' + Number(v).toFixed(2) + 'B'} />
                <Legend />
                <Bar dataKey="revenue_before" name="Revenue Before" fill="#22c55e" />
                <Bar dataKey="revenue_after"  name="Revenue After"  fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Detailed Results Table</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Run</th><th>Scenario</th><th>Elasticity</th>
                    <th>Importer</th><th>Exporter</th><th>Product</th>
                    <th className="text-right">t₀ %</th>
                    <th className="text-right">t₁ %</th>
                    <th className="text-right">Baseline M₀</th>
                    <th className="text-right">Est. M₁</th>
                    <th className="text-right">R₀</th>
                    <th className="text-right">R₁</th>
                    <th className="text-right">Δ Import %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>#{r.run_id}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.scenario_name}</td>
                      <td>{r.elasticity_assumption}</td>
                      <td>{r.importer_country}</td>
                      <td>{r.exporter_country}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.hs_code}</td>
                      <td className="text-right">{fmt(r.current_tariff_pct)}%</td>
                      <td className="text-right">{fmt(r.proposed_tariff_pct)}%</td>
                      <td className="text-right">${fmt(r.baseline_import_value)}</td>
                      <td className="text-right">${fmt(r.estimated_import_value_after)}</td>
                      <td className="text-right">${fmt(r.estimated_revenue_before)}</td>
                      <td className="text-right">${fmt(r.estimated_revenue_after)}</td>
                      <td className={`text-right ${Number(r.estimated_import_change_pct) < 0 ? 'text-red' : 'text-green'}`}>
                        {r.estimated_import_change_pct != null ? Number(r.estimated_import_change_pct).toFixed(2) + '%' : '—'}
                      </td>
                      <td><span className={`badge ${r.result_status === 'OK' ? 'badge-green' : 'badge-red'}`}>{r.result_status}</span></td>
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
