import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCountries, fetchProducts, fetchTariffs } from '../api/client';

export default function TariffHistory() {
  const [importerId, setImporterId] = useState('');
  const [exporterId, setExporterId] = useState('');
  const [productId,  setProductId]  = useState('');
  const [asOf,       setAsOf]       = useState('');
  const [triggered,  setTriggered]  = useState(false);

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });

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
        <h1>Tariff History</h1>
        <p>Browse effective-dated tariff records. Historical rates are preserved — not overwritten.</p>
      </div>

      <div className="alert alert-info">
        ℹ️ <b>Scope note:</b> MVP covers ad valorem (percentage) tariffs only. 
        Preferential rates take precedence over general/MFN rates when an exporter is specified.
        NULL exporter = general/MFN rate.
      </div>

      <div className="card">
        <div className="filter-row">
          <div className="form-group">
            <label>Importer *</label>
            <select value={importerId} onChange={e => setImporterId(e.target.value)}>
              <option value="">— Select —</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Exporter (blank = show all)</label>
            <select value={exporterId} onChange={e => setExporterId(e.target.value)}>
              <option value="">Any / MFN</option>
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
            <label>As of Date (optional)</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setTriggered(true)}
            disabled={!importerId || !productId}
          >
            Look Up
          </button>
        </div>
      </div>

      {triggered && isLoading && <div className="loading">Loading…</div>}

      {tariffs?.length === 0 && triggered && !isLoading && (
        <div className="alert alert-warn">No tariff records found for these filters.</div>
      )}

      {tariffs?.length > 0 && (
        <div className="card">
          <div className="card-title">Tariff Records ({tariffs.length})</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Scope</th>
                  <th>Type</th>
                  <th className="text-right">Rate %</th>
                  <th>Effective From</th>
                  <th>Effective To</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((t: any) => (
                  <tr key={t.tariff_policy_id}>
                    <td>{t.tariff_policy_id}</td>
                    <td>
                      {t.exporter_country_id
                        ? <span className="badge badge-green">Preferential</span>
                        : <span className="badge badge-gray">MFN / General</span>}
                    </td>
                    <td>{t.tariff_type}</td>
                    <td className="text-right"><b>{Number(t.tariff_rate_pct).toFixed(2)}%</b></td>
                    <td>{t.effective_from}</td>
                    <td>{t.effective_to ?? <i style={{color:'#64748b'}}>current</i>}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.policy_note ?? '–'}</td>
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
