import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Navigation, Gauge, Mountain, Clock, Eye, EyeOff,
  Radio, Star, StarOff, RefreshCw, ExternalLink
} from 'lucide-react';
import type { SatellitePosition, SatelliteSummary } from '../types';
import { useStore } from '../stores/useStore';
import { format, formatDistanceToNow } from 'date-fns';

interface SatelliteInfoPanelProps {
  satellite?: SatelliteSummary;
  position?: SatellitePosition | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export function SatelliteInfoPanel({
  satellite, position, loading, onRefresh
}: SatelliteInfoPanelProps) {
  const { addFavorite, removeFavorite, isFavorite } = useStore();
  const [showTle, setShowTle] = useState(false);
  const isFav = satellite ? isFavorite(satellite.noradId) : false;

  const toggleFavorite = () => {
    if (!satellite) return;
    isFav ? removeFavorite(satellite.noradId) : addFavorite(satellite);
  };

  if (!position && !loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-40">
        <p className="text-gray-500 text-sm">Select a satellite to view details</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {position?.lookAngles?.visible ? (
              <div className="flex items-center gap-1 text-xs text-satellite-green">
                <Eye className="w-3 h-3" />
                <span>Overhead</span>
              </div>
            ) : null}
          </div>
          <h2 className="font-bold text-lg leading-tight mt-0.5">
            {loading ? (
              <span className="inline-block w-40 h-5 bg-white/10 rounded animate-pulse" />
            ) : (
              position?.name || satellite?.name || '—'
            )}
          </h2>
          <p className="text-xs text-gray-500 font-mono">
            NORAD {position?.noradId || satellite?.noradId}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {satellite && (
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFav
                ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                : <StarOff className="w-4 h-4 text-gray-500" />
              }
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {satellite && (
            <Link
              to={`/satellites/${satellite.noradId}`}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {position ? (
        <div className="p-4 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Navigation className="w-4 h-4 text-satellite-cyan" />}
            label="Latitude"
            value={`${position.latitudeDeg.toFixed(4)}°`}
          />
          <StatCard
            icon={<Navigation className="w-4 h-4 text-satellite-cyan rotate-90" />}
            label="Longitude"
            value={`${position.longitudeDeg.toFixed(4)}°`}
          />
          <StatCard
            icon={<Mountain className="w-4 h-4 text-satellite-orange" />}
            label="Altitude"
            value={`${position.altitudeKm.toFixed(1)} km`}
          />
          <StatCard
            icon={<Gauge className="w-4 h-4 text-satellite-blue" />}
            label="Speed"
            value={`${position.speedKmPerS.toFixed(2)} km/s`}
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-purple-400" />}
            label="Orbital Period"
            value={`${position.orbitalPeriodMinutes.toFixed(1)} min`}
          />
          <StatCard
            icon={<Radio className="w-4 h-4 text-satellite-green" />}
            label="Updated"
            value={formatDistanceToNow(new Date(position.timestamp), { addSuffix: true })}
          />

          {/* Look angles (when observer is set) */}
          {position.lookAngles && (
            <>
              <div className="col-span-2 h-px bg-white/10" />
              <StatCard
                icon={<Eye className="w-4 h-4 text-yellow-400" />}
                label="Azimuth"
                value={`${position.lookAngles.azimuthDeg.toFixed(1)}°`}
              />
              <StatCard
                icon={<Eye className="w-4 h-4 text-yellow-400" />}
                label="Elevation"
                value={`${position.lookAngles.elevationDeg.toFixed(1)}°`}
              />
              <StatCard
                icon={<Navigation className="w-4 h-4 text-yellow-400" />}
                label="Range"
                value={`${position.lookAngles.rangeKm.toFixed(0)} km`}
              />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  position.lookAngles.visible
                    ? 'bg-satellite-green animate-pulse'
                    : 'bg-gray-600'
                }`} />
                <span className={`text-xs font-medium ${
                  position.lookAngles.visible ? 'text-satellite-green' : 'text-gray-500'
                }`}>
                  {position.lookAngles.visible ? 'Above horizon' : 'Below horizon'}
                </span>
              </div>
            </>
          )}

          <div className="col-span-2 text-xs text-gray-600 font-mono text-right mt-1">
            {format(new Date(position.timestamp), 'yyyy-MM-dd HH:mm:ss')} UTC
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}
