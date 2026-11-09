import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Reference
export const fetchCountries = (search?: string) =>
  api.get('/countries', { params: { search } }).then(r => r.data);

export const fetchProducts = (search?: string) =>
  api.get('/products', { params: { search } }).then(r => r.data);

// Trade
export const fetchTrade = (params: Record<string, any>) =>
  api.get('/trade', { params }).then(r => r.data);

// Analytics
export const fetchTopPartners = (params: Record<string, any>) =>
  api.get('/analytics/top-partners', { params }).then(r => r.data);

export const fetchTradeBalance = (params: Record<string, any>) =>
  api.get('/analytics/trade-balance', { params }).then(r => r.data);

export const fetchYoYGrowth = (params: Record<string, any>) =>
  api.get('/analytics/yoy-growth', { params }).then(r => r.data);

// Tariffs
export const fetchTariffs = (params: Record<string, any>) =>
  api.get('/tariffs', { params }).then(r => r.data);

// Scenarios
export const fetchScenarios = () => api.get('/scenarios').then(r => r.data);

export const fetchScenario = (id: number) =>
  api.get(`/scenarios/${id}`).then(r => r.data);

export const createScenario = (data: any) =>
  api.post('/scenarios', data).then(r => r.data);

export const validateScenario = (id: number) =>
  api.get(`/scenarios/${id}/validate`).then(r => r.data);

export const runSimulation = (id: number, payload: any) =>
  api.post(`/scenarios/${id}/runs`, payload).then(r => r.data);

export const fetchRuns = (id: number) =>
  api.get(`/scenarios/${id}/runs`).then(r => r.data);

export const fetchResults = (runId: number) =>
  api.get(`/runs/${runId}/results`).then(r => r.data);

export const compareScenarios = (runIds: number[]) =>
  api.get('/scenarios/compare', { params: { run_ids: runIds.join(',') } }).then(r => r.data);

// Admin
export const fetchBatches = () =>
  api.get('/admin/ingestion-batches').then(r => r.data);

export default api;
