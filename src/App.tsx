import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import Filtration from './pages/Filtration';

import { Toaster } from 'sonner';
import Layout from './components/Layout';

function Loader() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8
      bg-slate-100 dark:bg-[#0a0f1e] font-sans">

      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10
            flex items-center justify-center
            text-xl font-black text-blue-600 dark:text-blue-400">
            O
          </div>
          <div className="absolute -inset-1.5 rounded-[20px]
            border-2 border-transparent
            border-t-blue-500 border-r-blue-300/50
            animate-spin" />
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            OptimaPOS
          </p>
          <p className="text-[10px] uppercase tracking-widest font-bold
            text-slate-400 dark:text-slate-600 mt-0.5">
            by Optimabyte Softwares
          </p>
        </div>
      </div>

      <div className="w-40 h-0.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-blue-500
          animate-[loader-slide_1.4s_ease-in-out_infinite]" />
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600
        animate-pulse tracking-wide">
        Loading your workspace…
      </p>

      <style>{`
        @keyframes loader-slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(300%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

function Guard({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: string;
}) {
  const { firebaseUser, rights, loading } = useAuth();

  if (loading) return <Loader />;

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  const safeRights = rights ?? [];

  if (allow && !safeRights.includes(allow)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected + permission-gated */}
      <Route
        path="/"
        element={
          <Guard allow="dashboard_access">
            <Dashboard />
          </Guard>
        }
      />

      <Route
        path="/sales"
        element={
          <Guard allow="sales_access">
            <Sales />
          </Guard>
        }
      />

      <Route
        path="/inventory"
        element={
          <Guard allow="inventory_access">
            <Inventory />
          </Guard>
        }
      />

      <Route
        path="/production"
        element={
          <Guard allow="production_access">
            <Production />
          </Guard>
        }
      />

      <Route
        path="/users"
        element={
          <Guard allow="users_access">
            <Users />
          </Guard>
        }
      />

      <Route
        path="/analytics"
        element={
          <Guard allow="analytics_access">
            <Analytics />
          </Guard>
        }
      />

      <Route
        path="/filter"
        element={
          <Guard allow="filter_access">
            <Filtration />
          </Guard>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}