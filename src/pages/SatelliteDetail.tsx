import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WorldMap } from '../components/WorldMap';
import { SatelliteInfoPanel } from '../components/SatelliteInfoPanel';
import { useLivePosition, useOrbitalTrack } from '../hooks';
import { satelliteApi } from '../services/api';
import type { SatelliteSummary, TleInfo } from '../types';
import { format, addHours, subHours, formatISO } from 'date-fns';
import { useStore } from '../stores/useStore';

export function SatelliteDetail() {
  const { noradId } = useParams<{ noradId: string }>();
  const { setSelectedSatellite, observerLocation } = useStore();
  const [satellite, setSatellite] = useState<SatelliteSummary | null>(null);
  const [tleInfo, setTleInfo] = useState<TleInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'track' | 'predict' | 'tle'>('track');
  const [predictMinutes, setPredictMinutes] = useState(10);

  const { position, loading, refresh } = useLivePosition(noradId || null);

  const now = new Date();
  const trackStart = formatISO(subHours(now, 1));
  const trackEnd = formatISO(addHours(now, 1));
  const { track } = useOrbitalTrack(noradId || null, trackStart, trackEnd, 30);

  useEffect(() => {
    if (!noradId) return;
    setSelectedSatellite(noradId);
    satelliteApi.get(noradId).then(setSatellite).catch(() => {});
    satelliteApi.tle(noradId).then(setTleInfo).catch(() => {});
  }, [noradId, setSelectedSatellite]);

  if (!noradId) return null;

  const positions = position ? { [noradId]: position } : {};

  // Prepare chart data from track
  const chartData = track?.points.slice(0, 60).map(p => ({
    time: format(new Date(p.timestamp), 'HH:mm'),
    altitude: Math.round(p.altitudeKm),
    speed: Number(p.speedKmPerS.toFixed(2)),
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <Link to="/satellites" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        All Satellites
      </Link>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: Info + tabs */}
        <div className="space-y-4">
          <SatelliteInfoPanel
            satellite={satellite || undefined}
            position={position}
            loading={loading}
            onRefresh={refresh}
          />

          {/* Tabs */}
          <div className="glass-card overflow-hidden">
            <div className="flex border-b border-white/10">
              {(['track', 'predict', 'tle'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-satellite-blue/20 text-satellite-blue border-b-2 border-satellite-blue'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'tle' ? 'TLE Data' : tab}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'predict' && (
                <div className="space-y-3">
                  <label className="block text-xs text-gray-400">
                    Predict {predictMinutes} min ahead
                  </label>
                  <input
                    type="range"
                    min={1} max={360} value={predictMinutes}
                    onChange={e => setPredictMinutes(Number(e.target.value))}
                    className="w-full accent-satellite-cyan"
                  />
                  <div className="text-xs text-gray-500 text-right">{predictMinutes} minutes</div>
                  <PredictButton noradId={noradId} minutes={predictMinutes} />
                </div>
              )}

              {activeTab === 'track' && (
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Showing ±60 min orbit track</p>
                  <p className="text-gray-600">
                    {track?.points.length || 0} track points computed
                  </p>
                </div>
              )}

              {activeTab === 'tle' && tleInfo && (
                <div className="space-y-2">
                  <div className="font-mono text-xs bg-space-900 rounded p-3 space-y-1 break-all">
                    <p className="text-gray-500"># Epoch: {tleInfo.epoch}</p>
                    <p className="text-satellite-green">{tleInfo.line1}</p>
                    <p className="text-satellite-cyan">{tleInfo.line2}</p>
                  </div>
                  <p className="text-xs text-gray-600">Source: {tleInfo.source}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Map + charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="glass-card p-3" style={{ height: 400 }}>
            <WorldMap
              positions={positions}
              trackPoints={track?.points}
              selectedNoradId={noradId}
            />
          </div>

          {/* Altitude chart */}
          {chartData.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">
                Altitude over ±60 min (km)
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a1628',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="altitude"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    name="Altitude (km)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PredictButton({ noradId, minutes }: { noradId: string; minutes: number }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const observerLocation = useStore(s => s.observerLocation);

  const predict = async () => {
    setLoading(true);
    try {
      const res = await satelliteApi.predict(
        noradId, minutes,
        observerLocation?.lat, observerLocation?.lon
      );
      const pos = res.position;
      setResult(
        `In ${minutes}min: ${pos.latitudeDeg.toFixed(2)}°, ${pos.longitudeDeg.toFixed(2)}° at ${pos.altitudeKm.toFixed(0)} km`
      );
    } catch {
      setResult('Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={predict} disabled={loading} className="btn-primary w-full text-sm">
        {loading ? 'Computing...' : 'Predict Position'}
      </button>
      {result && (
        <p className="text-xs font-mono text-satellite-cyan bg-satellite-cyan/10 rounded p-2">
          {result}
        </p>
      )}
    </div>
  );
}
