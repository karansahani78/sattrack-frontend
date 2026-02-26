import axios, { AxiosInstance } from 'axios';
import type {
  SatelliteSummary, SatellitePosition, TrackResponse,
  PredictionResponse, TleInfo, PageResponse, AuthResponse,
  UserProfile
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ✅ Attach JWT to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('sattrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Handle 401 globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sattrack_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─────────────────────────────────────────────
// Satellite APIs (UNCHANGED)
// ─────────────────────────────────────────────

export const satelliteApi = {
  list: (page = 0, size = 20, category?: string): Promise<PageResponse<SatelliteSummary>> =>
    client.get('/satellites', { params: { page, size, category } }).then(r => r.data),

  search: (q: string, page = 0, size = 20): Promise<PageResponse<SatelliteSummary>> =>
    client.get('/satellites/search', { params: { q, page, size } }).then(r => r.data),

  get: (noradId: string): Promise<SatelliteSummary> =>
    client.get(`/satellites/${noradId}`).then(r => r.data),

  categories: (): Promise<string[]> =>
    client.get('/satellites/categories').then(r => r.data),

  currentPosition: (
    noradId: string,
    lat?: number,
    lon?: number
  ): Promise<SatellitePosition> =>
    client.get(`/satellites/${noradId}/current`, {
      params: { lat, lon }
    }).then(r => r.data),

  predict: (
    noradId: string,
    minutes = 10,
    lat?: number,
    lon?: number
  ): Promise<PredictionResponse> =>
    client.get(`/satellites/${noradId}/predict`, {
      params: { minutes, lat, lon }
    }).then(r => r.data),

  track: (
    noradId: string,
    start: string,
    end: string,
    interval = 60
  ): Promise<TrackResponse> =>
    client.get(`/satellites/${noradId}/track`, {
      params: { start, end, interval }
    }).then(r => r.data),

  tle: (noradId: string): Promise<TleInfo> =>
    client.get(`/satellites/${noradId}/tle`).then(r => r.data),
};

// ─────────────────────────────────────────────
// Auth APIs (FIXED)
// ─────────────────────────────────────────────

export const authApi = {

  // ✅ Register and store token immediately
  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await client.post('/auth/register', { username, email, password });

    const token = response.data.token;
    if (token) {
      localStorage.setItem('sattrack_token', token);
    }

    return response.data;
  },

  // ✅ Login and store token from JSON body
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await client.post('/auth/login', { username, password });

    const token = response.data.token;
    if (token) {
      localStorage.setItem('sattrack_token', token);
    }

    return response.data;
  },

  profile: (): Promise<UserProfile> =>
    client.get('/auth/profile').then(r => r.data),

  updatePreferences: (prefs: Partial<UserProfile>): Promise<UserProfile> =>
    client.patch('/auth/preferences', prefs).then(r => r.data),
};