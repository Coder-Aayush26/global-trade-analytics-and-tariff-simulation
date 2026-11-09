import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCountries, fetchProducts, fetchTrade } from '../api/client';

const fmt = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function TradeExplorer() {
  const [reporterId, setReporterId] = useState('');
  const [partnerId,  setPartnerId]  = useState('');
  const [productId,  setProductId]  = useState('');
  const [flow,       setFlow]       = useState('');
  const [yearFrom,   setYearFrom]   = useState('2020');
  const [yearTo,     setYearTo]     = useState('2023');
  const [page,       setPage]       = useState(1);
  const [triggered,  setTriggered]  = useState(false);

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });

  const { data: rows, isLoading } = useQuery({
    queryKey: ['trade', reporterId, partnerId, productId, flow, yearFrom, yearTo, page],
    queryFn: () => fetchTrade({
      reporter_id: reporterId || undefined,
      partner_id:  partnerId  || undefined,
      product_id:  productId  || undefined,
      flow:        flow        || undefined,
      year_from:   yearFrom,
      year_to:     yearTo,
      page, page_size: 50,
    }),
    enabled: triggered,
  });

  return (
    <div>
      <div className="page-header">
        <h1>Trade Explorer</h1>
        <p>Filter and browse bilateral trade observations. Data shows reported values by reporter country.</p>
      </div>

      <div className="card">
        <div className="filter-row">
          <div className="form-group">
            <label>Reporter</label>
            <select value={reporterId} onChange={e => setReporterId(e.target.value)}>
              <option value="">Any</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Partner</label>
            <select value={partnerId} onChange={e => setPartnerId(e.target.value)}>
              <option value="">Any</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Product</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Any</option>
              {products?.map((p: any) => <option key={p.product_id} value={p.product_id}>{p.hs_code} – {p.product_description.slice(0,40)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Flow</label>
            <select value={flow} onChange={e => setFlow(e.target.value)}>
              <option value="">Any</option>
              <option value="EXPORT">EXPORT</option>
              <option value="IMPORT">IMPORT</option>
            </select>
          </div>
          <div className="form-group">
            <label>Year From</label>
            <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} min="2000" max="2030" />
          </div>
          <div className="form-group">
            <label>Year To</label>
            <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)} min="2000" max="2030" />
          </div>
          <button className="btn btn-primary" onClick={() => { setPage(1); setTriggered(true); }}>Search</button>
        </div>
      </div>

      {!triggered && <div className="alert alert-info">Set filters and click Search to load trade observations.</div>}
      {triggered && isLoading && <div className="loading">Loading…</div>}

      {rows?.length === 0 && triggered && !isLoading && (
        <div className="alert alert-warn">No observations found for the selected filters.</div>
      )}

      {rows?.length > 0 && (
        <div className="card">
          <div className="card-title">Trade Observations ({rows.length} rows shown)</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Reporter ID</th>
                  <th>Partner ID</th>
                  <th>Product ID</th>
                  <th>Flow</th>
                  <th className="text-right">Value (USD)</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.trade_id}>
                    <td>{r.period_year}</td>
                    <td>{r.reporter_country_id}</td>
                    <td>{r.partner_country_id}</td>
                    <td>{r.product_id}</td>
                    <td>
                      <span className={`badge ${r.flow_direction === 'EXPORT' ? 'badge-blue' : 'badge-yellow'}`}>
                        {r.flow_direction}
                      </span>
                    </td>
                    <td className="text-right">${fmt(r.trade_value_usd)}</td>
                    <td>{r.source_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
            <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}>Page {page}</span>
            <button className="btn btn-sm" onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
