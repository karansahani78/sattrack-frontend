import { useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../stores/useStore';

export function Profile() {
  const { user, setAuth, token, observerLocation, setObserverLocation } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lat, setLat] = useState(String(user?.defaultLatitude || ''));
  const [lon, setLon] = useState(String(user?.defaultLongitude || ''));
  const [timezone, setTimezone] = useState(user?.timezoneId || 'UTC');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updatePreferences({
        defaultLatitude: lat ? Number(lat) : undefined,
        defaultLongitude: lon ? Number(lon) : undefined,
        timezoneId: timezone,
      });
      if (token) setAuth(token, updated);
      if (lat && lon) {
        setObserverLocation({
          lat: Number(lat), lon: Number(lon),
          label: 'Home Location'
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-satellite-green" />
            Default Observer Location
          </h2>
          <p className="text-xs text-gray-500">
            Used for azimuth/elevation calculations and pass predictions.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Latitude</label>
              <input
                type="number" step="any" min="-90" max="90"
                value={lat} onChange={e => setLat(e.target.value)}
                placeholder="e.g. 51.5074"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Longitude</label>
              <input
                type="number" step="any" min="-180" max="180"
                value={lon} onChange={e => setLon(e.target.value)}
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
