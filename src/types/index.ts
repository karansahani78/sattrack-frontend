// Core satellite types that mirror the backend DTOs

export interface SatelliteSummary {
  id: number;
  noradId: string;
  name: string;
  category: string;
  description?: string;
  countryCode?: string;
  active: boolean;
  tleEpoch?: string;
}

export interface LookAngles {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  visible: boolean;
}

export interface SatellitePosition {
  noradId: string;
  name: string;
  timestamp: string;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  speedKmPerS: number;
  velocityKmPerS: number;
  orbitalPeriodMinutes: number;
  lookAngles?: LookAngles;
}

export interface TrackPoint {
  timestamp: string;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  speedKmPerS: number;
}

export interface TrackResponse {
  noradId: string;
  name: string;
  startTime: string;
  endTime: string;
  intervalSeconds: number;
  points: TrackPoint[];
}

export interface PredictionResponse {
  noradId: string;
  name: string;
  predictedAt: string;
  minutesAhead: number;
  position: SatellitePosition;
}

export interface TleInfo {
  noradId: string;
  line1: string;
  line2: string;
  epoch: string;
  source: string;
  fetchedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// Auth types
export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  username: string;
  role: string;
}

export interface UserProfile {
  username: string;
  email: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultAltitudeMeters?: number;
  timezoneId: string;
  favoriteSatelliteIds: string[];
}

// UI state types
export interface ObserverLocation {
  lat: number;
  lon: number;
  alt?: number;
  label?: string;
}

export interface MapSatelliteMarker extends SatellitePosition {
  color?: string;
  size?: number;
}
