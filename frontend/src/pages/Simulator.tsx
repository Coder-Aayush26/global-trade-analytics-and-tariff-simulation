import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCountries, fetchProducts, createScenario, validateScenario, runSimulation, fetchScenarios, fetchRuns, fetchResults } from '../api/client';

const fmt = (n: any) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

export default function Simulator() {
  const qc = useQueryClient();

  // Create scenario form
  const [scenarioName, setScenarioName] = useState('');
  const [description,  setDescription]  = useState('');
  const [basePeriod,   setBasePeriod]   = useState('2022');
  const [importerId,   setImporterId]   = useState('');
  const [exporterId,   setExporterId]   = useState('');
  const [productId,    setProductId]    = useState('');
  const [proposedRate, setProposedRate] = useState('');

  // Run form
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [elasticity,         setElasticity]          = useState('-0.5');
  const [selectedRunId,      setSelectedRunId]       = useState('');

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });
  const { data: scenarios } = useQuery({ queryKey: ['scenarios'], queryFn: fetchScenarios });

  const { data: runs } = useQuery({
    queryKey: ['runs', selectedScenarioId],
    queryFn:  () => fetchRuns(Number(selectedScenarioId)),
    enabled:  !!selectedScenarioId,
  });

  const { data: results } = useQuery({
    queryKey: ['results', selectedRunId],
    queryFn:  () => fetchResults(Number(selectedRunId)),
    enabled:  !!selectedRunId,
  });

  const { data: validation } = useQuery({
    queryKey: ['validate', selectedScenarioId],
    queryFn:  () => validateScenario(Number(selectedScenarioId)),
    enabled:  !!selectedScenarioId,
  });

  const createMut = useMutation({
    mutationFn: () => createScenario({
      scenario_name:   scenarioName,
      description:     description,
      baseline_period: Number(basePeriod),
      tariffs: [{
        importer_country_id:  Number(importerId),
        exporter_country_id:  Number(exporterId),
        product_id:           Number(productId),
        proposed_tariff_rate: Number(proposedRate) / 100,
      }],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios'] }); alert('Scenario created!'); },
    onError: (e: any) => alert('Error: ' + (e.response?.data?.detail ?? e.message)),
  });

  const runMut = useMutation({
    mutationFn: () => runSimulation(Number(selectedScenarioId), { elasticity_assumption: Number(elasticity), model_version: '1.0' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['runs', selectedScenarioId] });
      setSelectedRunId(String(data.run_id));
    },
    onError: (e: any) => alert('Simulation failed: ' + (e.response?.data?.detail ?? e.message)),
  });

  return (
    <div>
      <div className="page-header">
        <h1>Tariff Simulator</h1>
        <p>Create what-if scenarios, run simulations, and view estimated results.</p>
      </div>

      <div className="alert alert-warn">
        ⚠️ <b>Assumptions:</b> Constant-elasticity model. M₁ = M₀ × ((1+t₁)/(1+t₀))^ε.
        Fixed world price, full pass-through. Results are estimates, not forecasts.
        Elasticity ε is user-defined. Missing baseline or tariff = labelled as MISSING.
      </div>

      {/* Create Scenario */}
      <div className="card">
        <div className="card-title">1. Create a New Scenario</div>
        <div className="filter-row">
          <div className="form-group">
            <label>Scenario Name *</label>
            <input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="e.g. India Smartphone Tariff Hike" style={{minWidth:'260px'}} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" style={{minWidth:'200px'}} />
          </div>
          <div className="form-group">
            <label>Baseline Year *</label>
            <input type="number" value={basePeriod} onChange={e => setBasePeriod(e.target.value)} min="2000" max="2030" />
          </div>
        </div>
        <div className="filter-row">
          <div className="form-group">
            <label>Importer *</label>
            <select value={importerId} onChange={e => setImporterId(e.target.value)}>
              <option value="">— Select —</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Exporter *</label>
            <select value={exporterId} onChange={e => setExporterId(e.target.value)}>
              <option value="">— Select —</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Product *</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">— Select —</option>
              {products?.map((p: any) => <option key={p.product_id} value={p.product_id}>{p.hs_code} – {p.product_description.slice(0,40)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Proposed Tariff Rate (%) *</label>
            <input type="number" value={proposedRate} onChange={e => setProposedRate(e.target.value)} placeholder="e.g. 30" min="0" max="300" step="0.1" />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !scenarioName || !importerId || !exporterId || !productId || !proposedRate}
          >
            {createMut.isPending ? 'Creating…' : 'Create Scenario'}
          </button>
        </div>
      </div>

      {/* Run Simulation */}
      <div className="card">
        <div className="card-title">2. Select Scenario & Run Simulation</div>
        <div className="filter-row">
          <div className="form-group">
            <label>Scenario</label>
            <select value={selectedScenarioId} onChange={e => { setSelectedScenarioId(e.target.value); setSelectedRunId(''); }}>
              <option value="">— Select —</option>
              {scenarios?.map((s: any) => (
                <option key={s.scenario_id} value={s.scenario_id}>{s.scenario_name} (#{s.scenario_id})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Elasticity (ε, ≤ 0)</label>
            <input type="number" value={elasticity} onChange={e => setElasticity(e.target.value)} min="-5" max="0" step="0.1" />
          </div>
          <button
            className="btn btn-success"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending || !selectedScenarioId}
          >
            {runMut.isPending ? 'Running…' : '▶ Run Simulation'}
          </button>
        </div>

        {validation?.issues?.length > 0 && (
          <div>
            {validation.issues.map((i: any, idx: number) => (
              <div key={idx} className={`alert ${i.severity === 'ERROR' ? 'alert-error' : i.severity === 'WARNING' ? 'alert-warn' : 'alert-info'}`}>
                <b>{i.severity}</b>: {i.description}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runs list */}
      {runs?.length > 0 && (
        <div className="card">
          <div className="card-title">3. Simulation Runs</div>
          <table>
            <thead>
              <tr><th>Run ID</th><th>Run At</th><th>Status</th><th>Elasticity</th><th>Model</th><th>Action</th></tr>
            </thead>
            <tbody>
              {runs.map((r: any) => (
                <tr key={r.run_id} style={{ background: selectedRunId === String(r.run_id) ? '#eff6ff' : '' }}>
                  <td>#{r.run_id}</td>
                  <td>{new Date(r.run_at).toLocaleString()}</td>
                  <td><span className={`badge ${r.run_status === 'COMPLETED' ? 'badge-green' : 'badge-red'}`}>{r.run_status}</span></td>
                  <td>{r.elasticity_assumption}</td>
                  <td>{r.model_version}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => setSelectedRunId(String(r.run_id))}>View Results</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results */}
      {results?.length > 0 && (
        <div className="card">
          <div className="card-title">4. Simulation Results — Run #{selectedRunId}</div>
          <div className="alert alert-info" style={{fontSize:'0.8rem'}}>
            M₀ = baseline import value · t₀ = current tariff · t₁ = proposed tariff · M₁ = estimated import value · R₀ = M₀×t₀ · R₁ = M₁×t₁
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Importer</th><th>Exporter</th><th>Product</th>
                  <th className="text-right">M₀ (Baseline)</th>
                  <th className="text-right">t₀ %</th>
                  <th className="text-right">t₁ %</th>
                  <th className="text-right">M₁ (Estimated)</th>
                  <th className="text-right">R₀</th>
                  <th className="text-right">R₁</th>
                  <th className="text-right">Δ Import %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.result_id}>
                    <td>{r.importer_country_id}</td>
                    <td>{r.exporter_country_id}</td>
                    <td>{r.product_id}</td>
                    <td className="text-right">${fmt(r.baseline_import_value)}</td>
                    <td className="text-right">{fmt(r.current_tariff_pct)}%</td>
                    <td className="text-right">{fmt(r.proposed_tariff_pct)}%</td>
                    <td className="text-right">${fmt(r.estimated_import_value_after)}</td>
                    <td className="text-right">${fmt(r.estimated_revenue_before)}</td>
                    <td className="text-right">${fmt(r.estimated_revenue_after)}</td>
                    <td className={`text-right ${Number(r.estimated_import_change_pct) < 0 ? 'text-red' : 'text-green'}`}>
                      {r.estimated_import_change_pct != null ? Number(r.estimated_import_change_pct).toFixed(2) + '%' : '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.result_status === 'OK' ? 'badge-green' : 'badge-red'}`}>{r.result_status}</span>
                      {r.result_warning && <div style={{fontSize:'0.75rem', color:'#92400e', marginTop:'0.2rem'}}>{r.result_warning}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
