import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Star, StarOff, ChevronRight, Satellite } from 'lucide-react';
import { useSatelliteList } from '../hooks';
import { useStore } from '../stores/useStore';
import type { SatelliteSummary } from '../types';
import { formatDistanceToNow } from 'date-fns';

export function SatelliteList() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const { categoryFilter, setCategoryFilter, addFavorite, removeFavorite, isFavorite } = useStore();

  const { data, loading, error } = useSatelliteList(query, categoryFilter, page);

  const CATEGORY_COLORS: Record<string, string> = {
    'ISS & Stations': 'bg-purple-500/20 text-purple-400',
    'Starlink': 'bg-blue-500/20 text-blue-400',
    'GPS': 'bg-yellow-500/20 text-yellow-400',
    'Weather': 'bg-cyan-500/20 text-cyan-400',
    'Science': 'bg-green-500/20 text-green-400',
    'Amateur': 'bg-orange-500/20 text-orange-400',
  };

  const categories = [
    'ISS & Stations', 'Starlink', 'GPS', 'GLONASS', 'Galileo',
    'Weather', 'Science', 'Amateur', 'Military'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Satellite Database</h1>
        <p className="text-gray-400 text-sm">
          Browse and track {data?.totalElements?.toLocaleString() || '...'} satellites
        </p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search by name or NORAD ID..."
            className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-satellite-cyan"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setCategoryFilter(null); setPage(0); }}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              !categoryFilter ? 'bg-satellite-blue text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(categoryFilter === cat ? null : cat); setPage(0); }}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-satellite-cyan/20 text-satellite-cyan border border-satellite-cyan/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Satellite grid */}
      {error && (
        <div className="text-red-400 text-sm p-4 bg-red-400/10 rounded-xl mb-4">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-white/10 rounded mb-2 w-3/4" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
            </div>
          ))
        ) : (
          data?.content.map(sat => (
            <SatelliteCard
              key={sat.noradId}
              satellite={sat}
              isFav={isFavorite(sat.noradId)}
              onToggleFav={() => isFavorite(sat.noradId) ? removeFavorite(sat.noradId) : addFavorite(sat)}
              categoryColor={CATEGORY_COLORS[sat.category] || 'bg-gray-500/20 text-gray-400'}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-ghost disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
            disabled={page >= data.totalPages - 1}
            className="btn-ghost disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SatelliteCard({
  satellite, isFav, onToggleFav, categoryColor
}: {
  satellite: SatelliteSummary;
  isFav: boolean;
  onToggleFav: () => void;
  categoryColor: string;
}) {
  return (
    <div className="glass-card p-4 hover:border-white/20 transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{satellite.name}</h3>
          <p className="text-xs font-mono text-gray-500">NORAD {satellite.noradId}</p>
        </div>
        <button
          onClick={onToggleFav}
          className="p-1 ml-2 text-gray-600 hover:text-yellow-400 transition-colors"
        >
          {isFav
            ? <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            : <StarOff className="w-4 h-4" />
          }
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`badge ${categoryColor}`}>{satellite.category}</span>
        {!satellite.active && (
          <span className="badge bg-red-500/20 text-red-400">Inactive</span>
        )}
      </div>

      {satellite.tleEpoch && (
        <p className="text-xs text-gray-600 mb-3">
          TLE: {formatDistanceToNow(new Date(satellite.tleEpoch), { addSuffix: true })}
        </p>
      )}

      <Link
        to={`/satellites/${satellite.noradId}`}
        className="flex items-center justify-between text-xs text-satellite-cyan hover:text-satellite-blue transition-colors"
      >
        <span>Track this satellite</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
