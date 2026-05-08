import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const productsApi = {
  list: () => client.get("/products").then((r) => r.data),
  get: (id) => client.get(`/products/${id}`).then((r) => r.data),
  create: (payload) => client.post("/products", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/products/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/products/${id}`).then((r) => r.data),
};

export const salesApi = {
  list: () => client.get("/sales").then((r) => r.data),
  forProduct: (id) => client.get(`/sales/product/${id}`).then((r) => r.data),
  create: (payload) => client.post("/sales", payload).then((r) => r.data),
};

export const restocksApi = {
  list: (supplierId) => {
    const qs = supplierId !== undefined && supplierId !== null
      ? `?supplier_id=${supplierId}` : "";
    return client.get(`/restocks${qs}`).then((r) => r.data);
  },
  forProduct: (id) => client.get(`/restocks/product/${id}`).then((r) => r.data),
  create: (payload) => client.post("/restocks", payload).then((r) => r.data),
};

export const suppliersApi = {
  list: () => client.get("/suppliers").then((r) => r.data),
  get: (id) => client.get(`/suppliers/${id}`).then((r) => r.data),
  create: (payload) => client.post("/suppliers", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/suppliers/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/suppliers/${id}`).then((r) => r.data),
  top: (limit = 5) => client.get(`/suppliers/top?limit=${limit}`).then((r) => r.data),
};

export const insightsApi = {
  all: () => client.get("/insights/all").then((r) => r.data),
  lowStock: () => client.get("/insights/low-stock").then((r) => r.data),
  product: (id) => client.get(`/insights/product/${id}`).then((r) => r.data),
  productAI: (id) => client.post(`/insights/product/${id}/ai-summary`).then((r) => r.data),
  dailyAI: () => client.post("/insights/daily-ai-summary").then((r) => r.data),
};

export const healthApi = {
  check: () => client.get("/health").then((r) => r.data),
};

export default client;
