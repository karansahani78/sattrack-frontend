import axios, { AxiosInstance } from 'axios';
import type {
  SatelliteSummary, SatellitePosition, TrackResponse,
  PredictionResponse, TleInfo, PageResponse, AuthResponse,
  UserProfile
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Axios instance with JWT injection and unified error handling.
 * Token is stored in localStorage for persistence across refreshes.
 * In production, consider httpOnly cookies to mitigate XSS risk.
 */
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT if available
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('sattrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401s globally
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

// ---- Satellite APIs ----

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

// ---- Auth APIs ----

export const authApi = {
  register: (username: string, email: string, password: string): Promise<AuthResponse> =>
    client.post('/auth/register', { username, email, password }).then(r => r.data),

  login: (username: string, password: string): Promise<AuthResponse> =>
    client.post('/auth/login', { username, password }).then(r => r.data),

  profile: (): Promise<UserProfile> =>
    client.get('/auth/profile').then(r => r.data),

  updatePreferences: (prefs: Partial<UserProfile>): Promise<UserProfile> =>
    client.patch('/auth/preferences', prefs).then(r => r.data),
};
