/**
 * trackingApi.ts
 *
 * Handles all V2 tracking endpoints:
 *   /api/v1/passes/*
 *   /api/v1/doppler/*
 *   /api/v1/conjunctions/*
 *   /api/v1/notifications/*
 *   /api/v1/alerts/*
 */

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
  
  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
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
  
  // ─── API ──────────────────────────────────────────────────────────────────────
  
  export const trackingApi = {
  
    // ── Pass Predictions ────────────────────────────────────────────────────────
  
    /** POST /api/v1/passes/predict — public, no auth needed */
    predictPasses: (req: PassRequest): Promise<PassSummary[]> =>
      request(`${V1}/passes/predict`, {
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
        lat:           String(lat),
        lon:           String(lon),
        alt:           String(options.alt ?? 0),
        days:          String(options.days ?? 7),
        minElevation:  String(options.minElevation ?? 10),
        visibleOnly:   String(options.visibleOnly ?? false),
      });
      return request(`${V1}/passes/satellite/${noradId}?${p}`);
    },
  
    // ── Doppler ─────────────────────────────────────────────────────────────────
  
    /** POST /api/v1/doppler/current — public */
    currentDoppler: (req: DopplerRequest): Promise<DopplerResult> =>
      request(`${V1}/doppler/current`, {
        method: 'POST',
        body: JSON.stringify(req),
      }),
  
    /** POST /api/v1/doppler/curve — public */
    dopplerCurve: (
      req: DopplerRequest,
      passStart: string,
      passEnd: string
    ): Promise<DopplerResult[]> =>
      request(
        `${V1}/doppler/curve?passStart=${encodeURIComponent(passStart)}&passEnd=${encodeURIComponent(passEnd)}`,
        { method: 'POST', body: JSON.stringify(req) }
      ),
  
    // ── Conjunctions ────────────────────────────────────────────────────────────
  
    /** GET /api/v1/conjunctions?page=&size= — public */
    getConjunctions: (page = 0, size = 20): Promise<ConjunctionPageResponse> =>
      request(`${V1}/conjunctions?page=${page}&size=${size}`),
  
    /** GET /api/v1/conjunctions/satellite/{noradId} — public */
    getConjunctionsForSatellite: (noradId: string): Promise<ConjunctionSummary[]> =>
      request(`${V1}/conjunctions/satellite/${noradId}`),
  
    // ── Notifications (auth required) ───────────────────────────────────────────
  
    /** GET /api/v1/notifications?page=&size= */
    getNotifications: (page = 0, size = 20): Promise<NotificationPageResponse> =>
      request(`${V1}/notifications?page=${page}&size=${size}`),
  
    /** GET /api/v1/notifications/unread-count */
    getUnreadCount: (): Promise<{ count: number }> =>
      request(`${V1}/notifications/unread-count`),
  
    /** POST /api/v1/notifications/{id}/read */
    markRead: (id: number): Promise<void> =>
      request(`${V1}/notifications/${id}/read`, { method: 'POST' }),
  
    /** POST /api/v1/notifications/read-all */
    markAllRead: (): Promise<void> =>
      request(`${V1}/notifications/read-all`, { method: 'POST' }),
  
    // ── Alert Preferences (auth required) ───────────────────────────────────────
  
    /** GET /api/v1/alerts */
    getAlerts: (): Promise<AlertPreferenceDto[]> =>
      request(`${V1}/alerts`),
  
    /** POST /api/v1/alerts */
    createAlert: (req: AlertPreferenceRequest): Promise<AlertPreferenceDto> =>
      request(`${V1}/alerts`, {
        method: 'POST',
        body: JSON.stringify(req),
      }),
  
    /** DELETE /api/v1/alerts/{id} */
    deleteAlert: (id: number): Promise<void> =>
      request(`${V1}/alerts/${id}`, { method: 'DELETE' }),
  };