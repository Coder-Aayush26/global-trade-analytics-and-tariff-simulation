import { useState, useMemo } from 'react';
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
  const [triggered,  setTriggered]  = useState(true); // Default to auto-loading initial records

  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => fetchCountries() });
  const { data: products }  = useQuery({ queryKey: ['products'],  queryFn: () => fetchProducts() });

  // Fast ID to Name / Code dictionaries
  const countryMap = useMemo(() => {
    const map = new Map<number, string>();
    countries?.forEach((c: any) => map.set(c.country_id, `${c.country_name} (${c.iso3})`));
    return map;
  }, [countries]);

  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    products?.forEach((p: any) => map.set(p.product_id, `HS ${p.hs_code}`));
    return map;
  }, [products]);

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
        <h1>🔍 Bilateral Trade Explorer</h1>
        <p>Query, filter, and inspect relational trade flow records across global reporting economies and product codes.</p>
      </div>

      <div className="card">
        <div className="filter-row">
          <div className="form-group">
            <label>Reporter Economy</label>
            <select value={reporterId} onChange={e => setReporterId(e.target.value)}>
              <option value="">All Economies</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Partner Economy</label>
            <select value={partnerId} onChange={e => setPartnerId(e.target.value)}>
              <option value="">All Economies</option>
              {countries?.map((c: any) => <option key={c.country_id} value={c.country_id}>{c.country_name} ({c.iso3})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Harmonized Product</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">All Products</option>
              {products?.map((p: any) => (
                <option key={p.product_id} value={p.product_id}>
                  HS {p.hs_code} – {p.product_description.slice(0, 35)}...
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Flow Direction</label>
            <select value={flow} onChange={e => setFlow(e.target.value)}>
              <option value="">All Flows</option>
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
          <button className="btn btn-primary" onClick={() => { setPage(1); setTriggered(true); }}>
            🔍 Filter
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="loading">
          <div className="loading-spinner" />
          <p>Querying trade observation dataset...</p>
        </div>
      )}

      {rows?.length === 0 && !isLoading && (
        <div className="alert alert-warn">
          ⚠️ No bilateral trade observations found matching the selected filters.
        </div>
      )}

      {rows?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>Observed Trade Transactions ({rows.length} rows on Page {page})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Normalized 3NF Table: trade_observation</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Reporter</th>
                  <th>Partner</th>
                  <th>Product</th>
                  <th>Flow</th>
                  <th className="text-right">Observed Value (USD)</th>
                  <th>Data Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.trade_id}>
                    <td style={{ fontWeight: 600 }}>{r.period_year}</td>
                    <td>{countryMap.get(r.reporter_country_id) || `Country #${r.reporter_country_id}`}</td>
                    <td>{countryMap.get(r.partner_country_id) || `Country #${r.partner_country_id}`}</td>
                    <td>{productMap.get(r.product_id) || `Product #${r.product_id}`}</td>
                    <td>
                      <span className={`badge ${r.flow_direction === 'EXPORT' ? 'badge-blue' : 'badge-yellow'}`}>
                        {r.flow_direction}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#38bdf8' }}>
                      ${fmt(r.trade_value_usd)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source #{r.source_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '1.25rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← Previous
            </button>
            <span style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {page}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={rows.length < 50}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
