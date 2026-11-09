import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCountries, fetchProducts, createScenario, validateScenario,
  runSimulation, fetchScenarios, fetchRuns, fetchResults,
} from '../api/client';

const fmt = (n: any) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

export default function Simulator() {
  const qc = useQueryClient();

  // Create scenario form
  const [scenarioName, setScenarioName] = useState('');
  const [description,  setDescription]  = useState('');
  const [basePeriod,   setBasePeriod]   = useState('2022');
  const [importerId,   setImporterId]   = useState('1'); // Default USA
  const [exporterId,   setExporterId]   = useState('2'); // Default China
  const [productId,    setProductId]    = useState('1'); // Default HS 8517
  const [proposedRate, setProposedRate] = useState('25.0');
  const [createMsg,    setCreateMsg]    = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Run form
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [elasticity,         setElasticity]          = useState('-0.5');
  const [selectedRunId,      setSelectedRunId]       = useState('');

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });
  const { data: scenarios } = useQuery({ queryKey: ['scenarios'], queryFn: fetchScenarios });

  const countryMap = useMemo(() => {
    const map = new Map<number, string>();
    countries?.forEach((c: any) => map.set(c.country_id, c.country_name));
    return map;
  }, [countries]);

  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    products?.forEach((p: any) => map.set(p.product_id, `HS ${p.hs_code}`));
    return map;
  }, [products]);

  const { data: runs } = useQuery({
    queryKey: ['runs', selectedScenarioId],
    queryFn:  () => fetchRuns(Number(selectedScenarioId)),
    enabled:  !!selectedScenarioId,
  });

  const { data: results, isLoading: loadingResults } = useQuery({
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['scenarios'] });
      setCreateMsg({ type: 'success', text: `Scenario #${data.scenario_id} "${scenarioName}" registered successfully!` });
      setSelectedScenarioId(String(data.scenario_id));
      setScenarioName('');
    },
    onError: (e: any) => {
      setCreateMsg({ type: 'error', text: 'Creation failed: ' + (e.response?.data?.detail ?? e.message) });
    },
  });

  const runMut = useMutation({
    mutationFn: () => runSimulation(Number(selectedScenarioId), {
      elasticity_assumption: Number(elasticity),
      model_version: '1.0',
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['runs', selectedScenarioId] });
      setSelectedRunId(String(data.run_id));
    },
    onError: (e: any) => alert('Simulation execution failed: ' + (e.response?.data?.detail ?? e.message)),
  });

  return (
    <div>
      <div className="page-header">
        <h1>⚡ Dynamic Tariff Policy Simulator</h1>
        <p>
          Simulate counterfactual trade shocks using constant-elasticity demand substitution models.
          Simulations run inside atomic relational database transactions.
        </p>
      </div>

      <div className="alert alert-warn">
        ⚠️ <b>Theoretical Framework:</b> Constant-elasticity partial equilibrium model: 
        <span style={{ fontFamily: 'JetBrains Mono, monospace', margin: '0 0.4rem', color: '#fff' }}>
          M₁ = M₀ × ((1 + t₁) / (1 + t₀))^ε
        </span>
        where M₀ is baseline observed trade, t₀ is statutory baseline tariff rate, t₁ is counterfactual tariff, 
        and ε is the user-calibrated import elasticity.
      </div>

      {/* ── 1. Create Scenario Form ── */}
      <div className="card">
        <div className="card-title">1. Create a New Policy Scenario</div>

        {createMsg && (
          <div className={`alert ${createMsg.type === 'success' ? 'alert-info' : 'alert-error'}`} style={{ marginBottom: '1.25rem' }}>
            {createMsg.type === 'success' ? '✓ ' : '✕ '} {createMsg.text}
          </div>
        )}

        <div className="filter-row">
          <div className="form-group">
            <label>Scenario Name *</label>
            <input
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              placeholder="e.g. US Section 301 Electronics Tariff Hike"
              style={{ minWidth: '320px' }}
            />
          </div>
          <div className="form-group">
            <label>Description / Policy Context</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Strategic semiconductor reshoring measure"
              style={{ minWidth: '280px' }}
            />
          </div>
          <div className="form-group">
            <label>Baseline Period *</label>
            <input type="number" value={basePeriod} onChange={e => setBasePeriod(e.target.value)} min="2000" max="2030" />
          </div>
        </div>

        <div className="filter-row">
          <div className="form-group">
            <label>Importer Economy *</label>
            <select value={importerId} onChange={e => setImporterId(e.target.value)}>
              <option value="">— Select Importer —</option>
              {countries?.map((c: any) => (
                <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Target Exporter *</label>
            <select value={exporterId} onChange={e => setExporterId(e.target.value)}>
              <option value="">— Select Exporter —</option>
              {countries?.map((c: any) => (
                <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Target HS Code *</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">— Select Product —</option>
              {products?.map((p: any) => (
                <option key={p.product_id} value={p.product_id}>
                  HS {p.hs_code} – {p.product_description.slice(0, 35)}...
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Proposed Tariff Rate (%) *</label>
            <input
              type="number"
              value={proposedRate}
              onChange={e => setProposedRate(e.target.value)}
              placeholder="e.g. 25.0"
              min="0"
              max="300"
              step="0.1"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !scenarioName || !importerId || !exporterId || !productId || !proposedRate}
          >
            {createMut.isPending ? 'Saving...' : '✨ Register Scenario'}
          </button>
        </div>
      </div>

      {/* ── 2. Run Simulation ── */}
      <div className="card">
        <div className="card-title">2. Select Scenario & Execute Simulation Engine</div>
        <div className="filter-row">
          <div className="form-group">
            <label>Select Stored Scenario</label>
            <select
              value={selectedScenarioId}
              onChange={e => { setSelectedScenarioId(e.target.value); setSelectedRunId(''); }}
              style={{ minWidth: '320px' }}
            >
              <option value="">— Select Scenario —</option>
              {scenarios?.map((s: any) => (
                <option key={s.scenario_id} value={s.scenario_id}>
                  #{s.scenario_id}: {s.scenario_name} (Base: {s.baseline_period})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Import Price Elasticity (ε ≤ 0)</label>
            <input
              type="number"
              value={elasticity}
              onChange={e => setElasticity(e.target.value)}
              min="-5"
              max="0"
              step="0.05"
            />
          </div>
          <button
            className="btn btn-success"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending || !selectedScenarioId}
          >
            {runMut.isPending ? 'Simulating Engine...' : '▶ Run Tariff Simulation'}
          </button>
        </div>

        {/* Validation Issues / Audit */}
        {validation?.issues?.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            {validation.issues.map((i: any, idx: number) => (
              <div
                key={idx}
                className={`alert ${i.severity === 'ERROR' ? 'alert-error' : i.severity === 'WARNING' ? 'alert-warn' : 'alert-info'}`}
              >
                <b>{i.severity}:</b> {i.description}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Simulation Runs ── */}
      {runs?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>3. Stored Simulation Execution Runs ({runs.length})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Audit Table: simulation_run</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Timestamp</th>
                  <th>Execution Status</th>
                  <th>Elasticity (ε)</th>
                  <th>Engine Model</th>
                  <th>Inspection</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r: any) => (
                  <tr
                    key={r.run_id}
                    style={{
                      background: selectedRunId === String(r.run_id) ? 'rgba(99, 102, 241, 0.2)' : undefined,
                    }}
                  >
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>#{r.run_id}</td>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(r.run_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${r.run_status === 'COMPLETED' ? 'badge-green' : 'badge-red'}`}>
                        {r.run_status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.elasticity_assumption}</td>
                    <td>{r.model_version}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setSelectedRunId(String(r.run_id))}
                      >
                        📊 View Results
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. Detailed Results ── */}
      {selectedRunId && (
        <div className="card">
          <div className="card-title">
            <span>4. Counterfactual Impact Results — Simulation Run #{selectedRunId}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Model Output View: simulation_result</span>
          </div>

          <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
            <b>Metric Definitions:</b> M₀ = Baseline Import Value · t₀ = Current Statutory Tariff · t₁ = Proposed Tariff · 
            M₁ = Estimated Counterfactual Import · R₀ = Baseline Tariff Revenue · R₁ = Counterfactual Revenue
          </div>

          {loadingResults ? (
            <div className="loading">
              <div className="loading-spinner" />
              <p>Computing estimated trade deviations...</p>
            </div>
          ) : results?.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Importer</th>
                    <th>Exporter</th>
                    <th>Product</th>
                    <th className="text-right">Baseline M₀</th>
                    <th className="text-right">Current t₀</th>
                    <th className="text-right">Proposed t₁</th>
                    <th className="text-right">Est. Import M₁</th>
                    <th className="text-right">Baseline R₀</th>
                    <th className="text-right">Est. Revenue R₁</th>
                    <th className="text-right">Δ Trade %</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any) => (
                    <tr key={r.result_id}>
                      <td style={{ fontWeight: 600 }}>{countryMap.get(r.importer_country_id) || `ID #${r.importer_country_id}`}</td>
                      <td>{countryMap.get(r.exporter_country_id) || `ID #${r.exporter_country_id}`}</td>
                      <td>{productMap.get(r.product_id) || `ID #${r.product_id}`}</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>${fmt(r.baseline_import_value)}</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(r.current_tariff_pct)}%</td>
                      <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', fontWeight: 600 }}>
                        {fmt(r.proposed_tariff_pct)}%
                      </td>
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
                        {r.result_warning && (
                          <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.2rem' }}>
                            {r.result_warning}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
              No result rows available for this run.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
