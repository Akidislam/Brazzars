import axios from 'axios';
import { clearAccessToken, getAccessToken } from './authStorage.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.__brazzarsHadToken = true;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.__brazzarsHadToken) {
      clearAccessToken();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('brazzars:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export default api;
