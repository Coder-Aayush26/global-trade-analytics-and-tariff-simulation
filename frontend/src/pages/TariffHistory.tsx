import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCountries, fetchProducts, fetchTariffs } from '../api/client';

export default function TariffHistory() {
  const [importerId, setImporterId] = useState('1'); // Default USA
  const [exporterId, setExporterId] = useState('');
  const [productId,  setProductId]  = useState('1'); // Default HS 8517
  const [asOf,       setAsOf]       = useState('');
  const [triggered,  setTriggered]  = useState(true);

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });

  const countryMap = useMemo(() => {
    const map = new Map<number, string>();
    countries?.forEach((c: any) => map.set(c.country_id, c.country_name));
    return map;
  }, [countries]);

  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    products?.forEach((p: any) => map.set(p.product_id, `HS ${p.hs_code} – ${p.product_description}`));
    return map;
  }, [products]);

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ['tariffs', importerId, exporterId, productId, asOf],
    queryFn: () => fetchTariffs({
      importer_id: importerId,
      product_id:  productId,
      exporter_id: exporterId || undefined,
      as_of_date:  asOf       || undefined,
    }),
    enabled: triggered && !!importerId && !!productId,
  });

  return (
    <div>
      <div className="page-header">
        <h1>📋 Tariff Policy Schedule & History</h1>
        <p>
          Effective-dated tariff schedules, MFN vs Preferential bilateral rates, and temporal audit tracking.
          Historical policy states are immutably preserved using date ranges.
        </p>
      </div>

      <div className="alert alert-info">
        ℹ️ <b>Stored Function Hierarchy:</b> When evaluating tariffs via <code>get_effective_tariff_rate()</code>, 
        bilateral Preferential rates supersede General/MFN rates. Rates are bounded between 0% and 100% via database check constraints.
      </div>

      <div className="card">
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
            <label>Partner / Exporter (Optional)</label>
            <select value={exporterId} onChange={e => setExporterId(e.target.value)}>
              <option value="">Any / MFN Standard</option>
              {countries?.map((c: any) => (
                <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Harmonized Tariff Item *</label>
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
            <label>Effective Date Filter (Optional)</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setTriggered(true)}
            disabled={!importerId || !productId}
          >
            🔍 Look Up Tariff
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="loading">
          <div className="loading-spinner" />
          <p>Querying temporal tariff policies...</p>
        </div>
      )}

      {tariffs?.length === 0 && !isLoading && (
        <div className="alert alert-warn">
          ⚠️ No tariff records found matching these criteria in the policy catalog.
        </div>
      )}

      {tariffs?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>
              Policy Lines: {countryMap.get(Number(importerId))} · {productMap.get(Number(productId))?.slice(0, 40)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Records Found: {tariffs.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Policy ID</th>
                  <th>Scope & Preference</th>
                  <th>Tariff Type</th>
                  <th className="text-right">Ad Valorem Rate</th>
                  <th>Effective From</th>
                  <th>Effective To</th>
                  <th>Policy Authority / Note</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((t: any) => (
                  <tr key={t.tariff_policy_id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>#{t.tariff_policy_id}</td>
                    <td>
                      {t.exporter_country_id ? (
                        <span className="badge badge-green">
                          Preferential ({countryMap.get(t.exporter_country_id) || `ID #${t.exporter_country_id}`})
                        </span>
                      ) : (
                        <span className="badge badge-gray">MFN / General (All Exporters)</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-blue">{t.tariff_type}</span>
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: '#38bdf8' }}>
                      {Number(t.tariff_rate_pct).toFixed(2)}%
                    </td>
                    <td>{t.effective_from}</td>
                    <td>{t.effective_to ?? <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>Current (Active)</span>}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {t.policy_note ?? 'Standard statutory schedule'}
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
