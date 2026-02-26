import { useState, useEffect, useCallback, useRef } from 'react';
import { satelliteApi } from '../services/api';
import { wsService } from '../services/websocket';
import { useStore } from '../stores/useStore';
import type { SatellitePosition, SatelliteSummary, TrackResponse, PageResponse } from '../types';

/**
 * Subscribe to real-time position updates via WebSocket,
 * with REST polling fallback every `pollIntervalMs` milliseconds.
 */
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
      // Don't treat 404 (no TLE yet) as a hard error — just show nothing
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

    // Initial fetch
    fetchPosition();

    // WebSocket real-time updates
    const unsub = wsService.subscribeToSatellite(noradId, (pos) => {
      setPosition(pos);
      updatePosition(noradId, pos);
    });

    // Polling fallback (also refreshes when observer location changes)
    const interval = setInterval(fetchPosition, pollIntervalMs);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [noradId, fetchPosition, pollIntervalMs, updatePosition]);

  return { position, loading, error, refresh: fetchPosition };
}

/**
 * Search/list satellites with 300ms debounce.
 */
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

/**
 * Compute an orbital track for a time range.
 */
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
        if (!controller.signal.aborted) {
          setTrack(data);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('Track computation failed');
          setTrack(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [noradId, startIso, endIso, intervalSec]);

  return { track, loading, error };
}

/**
 * Browser Geolocation API with status tracking.
 */
export function useGeolocation() {
  const setObserver = useStore((s) => s.setObserverLocation);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
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

/**
 * UTC clock that updates every second.
 */
export function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
