import axios, { AxiosInstance } from 'axios';
import type {
  SatelliteSummary, SatellitePosition, TrackResponse,
  PredictionResponse, TleInfo, PageResponse, AuthResponse,
  UserProfile
} from '../types';

// ─── trackingApi types ────────────────────────────────────────────────────────
import type {
  PassRequest,
  PassSummary,
  DopplerRequest,
  DopplerResult,
  ConjunctionSummary,
  ConjunctionPageResponse,
  NotificationPageResponse,
  AlertPreferenceRequest,
  AlertPreferenceDto,
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
// Auth APIs (UNCHANGED)
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

// ─────────────────────────────────────────────────────────────────────────────
// Tracking API
// Handles: /api/v1/passes/*  /api/v1/doppler/*  /api/v1/conjunctions/*
//          /api/v1/notifications/*  /api/v1/alerts/*
//
// Uses its own fetch-based request helper (separate from the axios client above)
// so it can target the /api/v1 prefix and handle its own auth token lookup.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const V1 = `${API_BASE}/v1`;

// ─── Auth token helper ────────────────────────────────────────────────────────
//
// WHY THIS IS NEEDED:
//   useStore.setAuth() writes the token to TWO places:
//     1. localStorage.setItem('token', token)        ← flat key, works immediately
//     2. Zustand persist writes { state: { token } } ← under 'sattrack-store'
//
//   After a page refresh, Zustand rehydrates from 'sattrack-store'.
//   The flat 'token' key IS set by setAuth(), but if the user cleared
//   storage or the flat key expired, we need the Zustand fallback.
//   This function checks every location so auth ALWAYS works.
//
function getToken(): string | null {
  try {
    // ── 1. Flat keys written by useStore.setAuth() ──────────────────────────
    const flat =
      localStorage.getItem('token') ||
      localStorage.getItem('sattrack_token') ||  // also written by setAuth()
      localStorage.getItem('jwt') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('accessToken');

    if (flat) return flat;

    // ── 2. Zustand persist store (key: 'sattrack-store') ────────────────────
    // Format: { "state": { "token": "eyJ...", ... }, "version": 0 }
    const raw = localStorage.getItem('sattrack-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.token;
      if (token && typeof token === 'string') return token;
    }

    return null;
  } catch {
    // localStorage blocked (private browsing / storage quota) — fail gracefully
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function trackingRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers as Record<string, string> || {}),
    },
  });

  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.response = { status: res.status };
    throw err;
  }

  // 204 No Content — return undefined
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const trackingApi = {

  // ── Pass Predictions ──────────────────────────────────────────────────────

  /** POST /api/v1/passes/predict — public, no auth needed */
  predictPasses: (req: PassRequest): Promise<PassSummary[]> =>
    trackingRequest(`${V1}/passes/predict`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** GET /api/v1/passes/satellite/{noradId} — public */
  getPassesForSatellite: (
    noradId: string,
    lat: number,
    lon: number,
    options: {
      alt?: number;
      days?: number;
      minElevation?: number;
      visibleOnly?: boolean;
    } = {}
  ): Promise<PassSummary[]> => {
    const p = new URLSearchParams({
      lat:          String(lat),
      lon:          String(lon),
      alt:          String(options.alt ?? 0),
      days:         String(options.days ?? 7),
      minElevation: String(options.minElevation ?? 10),
      visibleOnly:  String(options.visibleOnly ?? false),
    });
    return trackingRequest(`${V1}/passes/satellite/${noradId}?${p}`);
  },

  // ── Doppler ───────────────────────────────────────────────────────────────

  /** POST /api/v1/doppler/current — public */
  currentDoppler: (req: DopplerRequest): Promise<DopplerResult> =>
    trackingRequest(`${V1}/doppler/current`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** POST /api/v1/doppler/curve — public */
  dopplerCurve: (
    req: DopplerRequest,
    passStart: string,
    passEnd: string
  ): Promise<DopplerResult[]> =>
    trackingRequest(
      `${V1}/doppler/curve?passStart=${encodeURIComponent(passStart)}&passEnd=${encodeURIComponent(passEnd)}`,
      { method: 'POST', body: JSON.stringify(req) }
    ),

  // ── Conjunctions ──────────────────────────────────────────────────────────

  /** GET /api/v1/conjunctions?page=&size= — public */
  getConjunctions: (page = 0, size = 20): Promise<ConjunctionPageResponse> =>
    trackingRequest(`${V1}/conjunctions?page=${page}&size=${size}`),

  /** GET /api/v1/conjunctions/satellite/{noradId} — public */
  getConjunctionsForSatellite: (noradId: string): Promise<ConjunctionSummary[]> =>
    trackingRequest(`${V1}/conjunctions/satellite/${noradId}`),

  // ── Notifications (auth required) ────────────────────────────────────────

  /** GET /api/v1/notifications?page=&size= */
  getNotifications: (page = 0, size = 20): Promise<NotificationPageResponse> =>
    trackingRequest(`${V1}/notifications?page=${page}&size=${size}`),

  /** GET /api/v1/notifications/unread-count */
  getUnreadCount: (): Promise<{ count: number }> =>
    trackingRequest(`${V1}/notifications/unread-count`),

  /** POST /api/v1/notifications/{id}/read */
  markRead: (id: number): Promise<void> =>
    trackingRequest(`${V1}/notifications/${id}/read`, { method: 'POST' }),

  /** POST /api/v1/notifications/read-all */
  markAllRead: (): Promise<void> =>
    trackingRequest(`${V1}/notifications/read-all`, { method: 'POST' }),

  // ── Alert Preferences (auth required) ────────────────────────────────────

  /** GET /api/v1/alerts */
  getAlerts: (): Promise<AlertPreferenceDto[]> =>
    trackingRequest(`${V1}/alerts`),

  /** POST /api/v1/alerts */
  createAlert: (req: AlertPreferenceRequest): Promise<AlertPreferenceDto> =>
    trackingRequest(`${V1}/alerts`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** DELETE /api/v1/alerts/{id} */
  deleteAlert: (id: number): Promise<void> =>
    trackingRequest(`${V1}/alerts/${id}`, { method: 'DELETE' }),
};