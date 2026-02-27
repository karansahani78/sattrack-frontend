import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SatelliteDetail } from './pages/SatelliteDetail';
import { SatelliteList } from './pages/SatelliteList';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { Passes } from './pages/Passes';
import { Conjunctions } from './pages/Conjunctions';
import { Notifications } from './pages/Notifications';
import { Doppler } from './pages/Doppler';
import { useStore } from './stores/useStore';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/satellites" element={<SatelliteList />} />
        <Route path="/satellites/:noradId" element={<SatelliteDetail />} />

        {/* V2 Tracking Routes */}
        <Route path="/passes" element={<Passes />} />
        <Route path="/conjunctions" element={<Conjunctions />} />
        <Route path="/doppler" element={<Doppler />} />

        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
      </Route>
    </Routes>
  );
}