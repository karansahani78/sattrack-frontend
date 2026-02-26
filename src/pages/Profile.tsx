import { useState } from 'react';
import { MapPin, Save, Navigation, Loader } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../stores/useStore';

export function Profile() {
  const { user, setAuth, token, observerLocation, setObserverLocation } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lat, setLat] = useState(String(user?.defaultLatitude || ''));
  const [lon, setLon] = useState(String(user?.defaultLongitude || ''));
  const [timezone, setTimezone] = useState(user?.timezoneId || 'UTC');

  // Location detection state
  const [detecting, setDetecting]   = useState(false);
  const [detectLabel, setDetectLabel] = useState('');
  const [detectError, setDetectError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updatePreferences({
        defaultLatitude:  lat ? Number(lat) : undefined,
        defaultLongitude: lon ? Number(lon) : undefined,
        timezoneId: timezone,
      });
      if (token) setAuth(token, updated);
      if (lat && lon) {
        setObserverLocation({
          lat: Number(lat), lon: Number(lon),
          label: detectLabel || 'Home Location',
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser.');
      return;
    }

    setDetecting(true);
    setDetectError('');
    setDetectLabel('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // Fill coordinate fields immediately
        setLat(latitude.toFixed(6));
        setLon(longitude.toFixed(6));

        // Reverse geocode with Nominatim (free, no API key)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const a = data?.address;
          if (a) {
            const parts = [
              a.suburb || a.neighbourhood || a.city_district,
              a.city || a.town || a.village || a.county,
              a.state,
              a.country,
            ].filter(Boolean);
            const label = parts.slice(0, 3).join(', ');
            setDetectLabel(label);

            // Auto-detect timezone from coordinates using browser API
            try {
              const tzRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=3`,
                { headers: { 'Accept-Language': 'en' } }
              );
              const tzData = await tzRes.json();
              // Use browser's Intl timezone as best fallback
              const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
              const tzOptions = [
                'UTC','America/New_York','America/Los_Angeles','Europe/London',
                'Europe/Berlin','Asia/Tokyo','Asia/Kolkata','Australia/Sydney',
              ];
              if (tzOptions.includes(browserTz)) setTimezone(browserTz);
            } catch { /* keep current timezone */ }
          }
        } catch {
          // coords still filled, just no label
          setDetectLabel(`${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`);
        }

        setDetecting(false);
      },
      (err) => {
        setDetecting(false);
        const msgs: Record<number, string> = {
          1: 'Location permission denied. Please allow access in your browser.',
          2: 'Position unavailable. Try again or enter manually.',
          3: 'Location request timed out. Try again.',
        };
        setDetectError(msgs[err.code] || 'Could not detect location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      <div className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Account</h2>
          <p className="text-gray-400 text-sm">@{user?.username}</p>
          <p className="text-gray-500 text-xs">{user?.email}</p>
        </div>

        <div className="h-px bg-white/10" />

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-satellite-green" />
                Default Observer Location
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Used for azimuth/elevation calculations and pass predictions.
              </p>
            </div>

            {/* ── One-click detect button ── */}
            <button
              type="button"
              onClick={detectLocation}
              disabled={detecting}
              title="Auto-detect my location using GPS"
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: detecting
                  ? 'rgba(0,255,136,0.08)'
                  : 'rgba(0,255,136,0.12)',
                border: '1px solid rgba(0,255,136,0.3)',
                color: detecting ? 'rgba(0,255,136,0.5)' : '#00ff88',
                cursor: detecting ? 'not-allowed' : 'pointer',
                boxShadow: detecting ? 'none' : '0 0 12px rgba(0,255,136,0.15)',
              }}
            >
              {detecting
                ? <Loader className="w-3.5 h-3.5 animate-spin" />
                : <Navigation className="w-3.5 h-3.5" />
              }
              {detecting ? 'Detecting…' : 'Detect My Location'}
            </button>
          </div>

          {/* Detected place name */}
          {detectLabel && !detecting && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background:'rgba(0,255,136,0.07)', border:'1px solid rgba(0,255,136,0.2)' }}>
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#00ff88' }} />
              <span className="text-gray-300">{detectLabel}</span>
              <span className="text-gray-600 ml-auto">detected ✓</span>
            </div>
          )}

          {/* Error message */}
          {detectError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background:'rgba(255,80,80,0.07)', border:'1px solid rgba(255,80,80,0.2)', color:'rgba(255,150,150,0.9)' }}>
              <span className="mt-0.5">⚠</span>
              <span>{detectError}</span>
            </div>
          )}

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Latitude</label>
              <input
                type="number" step="any" min="-90" max="90"
                value={lat} onChange={e => { setLat(e.target.value); setDetectLabel(''); }}
                placeholder="e.g. 51.5074"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Longitude</label>
              <input
                type="number" step="any" min="-180" max="180"
                value={lon} onChange={e => { setLon(e.target.value); setDetectLabel(''); }}
                placeholder="e.g. -0.1278"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Timezone</label>
            <select
              value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
                'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney'
              ].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </div>
  );
}