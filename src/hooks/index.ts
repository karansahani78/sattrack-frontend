import { useState, useEffect, useCallback, useRef } from 'react';
import { satelliteApi } from '../services/api';
import { trackingApi } from '../services/trackingApi';
import { wsService } from '../services/websocket';
import { useStore } from '../stores/useStore';
import type {
  SatellitePosition,
  SatelliteSummary,
  TrackResponse,
  PageResponse,
  PassSummary,
  PassRequest,
  DopplerRequest,
  DopplerResult,
  ConjunctionSummary,
  ConjunctionPageResponse,
  NotificationDto,
  NotificationPageResponse,
  AlertPreferenceDto,
} from '../types';

// ─── Safe wsService wrapper ───────────────────────────────────────────────────
// wsService.subscribeToConjunctions and subscribeToNotifications may not be
// implemented yet. Calling a missing method throws a TypeError that crashes the
// component silently (blank page, no visible error). This guard prevents that.
function safeSubscribe(method: string, handler: (payload: any) => void): () => void {
  try {
    const fn = (wsService as any)[method];
    if (typeof fn === 'function') {
      return fn.call(wsService, handler);
    }
  } catch (e) {
    console.warn(`[hooks] wsService.${method} not available:`, e);
  }
  return () => {}; // safe no-op unsubscribe
}

// ─── EXISTING HOOKS ───────────────────────────────────────────────────────────

export function useLivePosition(noradId: string | null, pollIntervalMs = 10000) {
  const [position, setPosition] = useState<SatellitePosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updatePosition = useStore((s) => s.updatePosition);
  const observerLocation = useStore((s) => s.observerLocation);

  const fetchPosition = useCallback(async () => {
    if (!noradId) return;
    try {
      setLoading(true);
      const pos = await satelliteApi.currentPosition(
        noradId,
        observerLocation?.lat,
        observerLocation?.lon
      );
      setPosition(pos);
      updatePosition(noradId, pos);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        setError('Position unavailable');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noradId, observerLocation?.lat, observerLocation?.lon]);

  useEffect(() => {
    if (!noradId) {
      setPosition(null);
      return;
    }
    fetchPosition();
    // subscribeToSatellite is an existing method — keep direct call
    const unsub = safeSubscribe('subscribeToSatellite', (pos: SatellitePosition) => {
      setPosition(pos);
      updatePosition(noradId, pos);
    });
    const interval = setInterval(fetchPosition, pollIntervalMs);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [noradId, fetchPosition, pollIntervalMs, updatePosition]);

  return { position, loading, error, refresh: fetchPosition };
}

export function useSatelliteList(query: string, category: string | null, page = 0) {
  const [data, setData] = useState<PageResponse<SatelliteSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const result = query.trim()
          ? await satelliteApi.search(query, page)
          : await satelliteApi.list(page, 20, category ?? undefined);
        setData(result);
        setError(null);
      } catch {
        setError('Failed to load satellites');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, category, page]);

  return { data, loading, error };
}

export function useOrbitalTrack(
  noradId: string | null,
  startIso: string,
  endIso: string,
  intervalSec: number
) {
  const [track, setTrack] = useState<TrackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noradId) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const data = await satelliteApi.track(noradId, startIso, endIso, intervalSec);
        if (!controller.signal.aborted) { setTrack(data); setError(null); }
      } catch {
        if (!controller.signal.aborted) { setError('Track computation failed'); setTrack(null); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [noradId, startIso, endIso, intervalSec]);

  return { track, loading, error };
}

export function useGeolocation() {
  const setObserver = useStore((s) => s.setObserverLocation);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setStatus('error'); return; }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObserver({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          alt: (pos.coords.altitude ?? 0) / 1000,
          label: 'My Location',
        });
        setStatus('success');
      },
      () => setStatus('error'),
      { timeout: 10000 }
    );
  }, [setObserver]);

  return { locate, status };
}

export function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

// ─── V2 HOOKS ─────────────────────────────────────────────────────────────────

export function usePassPredictions(req: PassRequest | null) {
  const [passes, setPasses] = useState<PassSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async () => {
    if (!req) return;
    try {
      setLoading(true);
      setError(null);
      const result = await trackingApi.predictPasses(req);
      setPasses(result);
    } catch {
      setError('Failed to compute pass predictions');
    } finally {
      setLoading(false);
    }
  }, [req]);

  return { passes, loading, error, predict, setPasses };
}

export function useSatellitePasses(
  noradId: string | null,
  lat: number | undefined,
  lon: number | undefined,
  options: { days?: number; minElevation?: number; visibleOnly?: boolean } = {}
) {
  const [passes, setPasses] = useState<PassSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noradId || lat == null || lon == null) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await trackingApi.getPassesForSatellite(noradId, lat, lon, options);
        if (!controller.signal.aborted) setPasses(result);
      } catch {
        if (!controller.signal.aborted) setError('Failed to load passes');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noradId, lat, lon, options.days, options.minElevation, options.visibleOnly]);

  return { passes, loading, error };
}

export function useDoppler(req: DopplerRequest | null) {
  const [result, setResult] = useState<DopplerResult | null>(null);
  const [curve, setCurve] = useState<DopplerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    if (!req) return;
    try {
      setLoading(true); setError(null);
      setResult(await trackingApi.currentDoppler(req));
    } catch {
      setError('Doppler calculation failed');
    } finally {
      setLoading(false);
    }
  }, [req]);

  const fetchCurve = useCallback(async (passStart: string, passEnd: string) => {
    if (!req) return;
    try {
      setLoading(true); setError(null);
      setCurve(await trackingApi.dopplerCurve(req, passStart, passEnd));
    } catch {
      setError('Doppler curve failed');
    } finally {
      setLoading(false);
    }
  }, [req]);

  return { result, curve, loading, error, fetchCurrent, fetchCurve };
}

/**
 * Paginated conjunction alerts.
 * FIX: uses safeSubscribe so missing wsService.subscribeToConjunctions
 * does not throw and crash the Conjunctions page.
 */
export function useConjunctions(page = 0, size = 20) {
  const [data, setData] = useState<ConjunctionPageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        const result = await trackingApi.getConjunctions(page, size);
        if (!controller.signal.aborted) { setData(result); setError(null); }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setError(
            err?.response?.status === 401
              ? 'Sign in to view conjunction alerts'
              : 'Failed to load conjunctions'
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    // safeSubscribe prevents TypeError if method doesn't exist yet
    const unsub = safeSubscribe('subscribeToConjunctions', (payload: Record<string, unknown>) => {
      setLiveAlert(payload);
      trackingApi.getConjunctions(page, size)
        .then(r => { if (!controller.signal.aborted) setData(r); })
        .catch(() => {});
    });

    return () => { controller.abort(); unsub(); };
  }, [page, size]);

  return { data, loading, error, liveAlert };
}

export function useSatelliteConjunctions(noradId: string | null) {
  const [conjunctions, setConjunctions] = useState<ConjunctionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noradId) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const result = await trackingApi.getConjunctionsForSatellite(noradId);
        if (!controller.signal.aborted) { setConjunctions(result); setError(null); }
      } catch {
        if (!controller.signal.aborted) setError('Failed to load conjunctions');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [noradId]);

  return { conjunctions, loading, error };
}

/**
 * User notifications with real-time WebSocket push.
 * FIX: uses safeSubscribe so missing wsService.subscribeToNotifications
 * does not throw and crash the Notifications page.
 */
export function useNotifications(page = 0, size = 20) {
  const [data, setData] = useState<NotificationPageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useStore((s) => s.token);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const result = await trackingApi.getNotifications(page, size);
      setData(result);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token, page, size]);

  useEffect(() => {
    refresh();
    if (!token) return;

    const unsub = safeSubscribe('subscribeToNotifications', (notif: NotificationDto) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: [notif, ...prev.notifications],
          unreadCount: prev.unreadCount + 1,
          totalElements: prev.totalElements + 1,
        };
      });
    });

    return () => unsub();
  }, [token, page, size, refresh]);

  const markRead = useCallback(async (id: number) => {
    await trackingApi.markRead(id);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: prev.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      };
    });
  }, []);

  const markAllRead = useCallback(async () => {
    await trackingApi.markAllRead();
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    });
  }, []);

  return { data, loading, error, refresh, markRead, markAllRead };
}

/**
 * Unread notification count for the Layout bell badge.
 * FIX: uses safeSubscribe so missing wsService.subscribeToNotifications
 * does not crash the entire Layout (and every page with it).
 */
export function useUnreadCount() {
  const token                      = useStore((s) => s.token);
  const setUnreadNotificationCount = useStore((s) => s.setUnreadNotificationCount);
  const incrementUnreadCount       = useStore((s) => s.incrementUnreadCount);
  const count                      = useStore((s) => s.unreadNotificationCount ?? 0);

  useEffect(() => {
    if (!token) { setUnreadNotificationCount(0); return; }

    const poll = () =>
      trackingApi.getUnreadCount()
        .then((r) => setUnreadNotificationCount(r.count))
        .catch(() => {});

    poll();
    const interval = setInterval(poll, 30_000);

    const unsub = safeSubscribe('subscribeToNotifications', () => {
      incrementUnreadCount();
    });

    return () => { clearInterval(interval); unsub(); };
  }, [token, setUnreadNotificationCount, incrementUnreadCount]);

  return count;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertPreferenceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useStore((s) => s.token);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setAlerts(await trackingApi.getAlerts());
      setError(null);
    } catch {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const createAlert = useCallback(async (req: Parameters<typeof trackingApi.createAlert>[0]) => {
    const created = await trackingApi.createAlert(req);
    setAlerts((prev) => {
      const idx = prev.findIndex((a) => a.id === created.id);
      return idx >= 0 ? prev.map((a) => (a.id === created.id ? created : a)) : [created, ...prev];
    });
    return created;
  }, []);

  const deleteAlert = useCallback(async (id: number) => {
    await trackingApi.deleteAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, loading, error, refresh, createAlert, deleteAlert };
}