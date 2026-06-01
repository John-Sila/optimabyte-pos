import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Factory,
  Users,
  BarChart3,
  LogOut,
  Menu,
  FilterIcon,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

const ROUTE_RIGHTS: Record<string, string> = {
  '/': 'dashboard_access',
  '/sales': 'sales_access',
  '/inventory': 'inventory_access',
  '/production': 'production_access',
  '/users': 'users_access',
  '/analytics': 'analytics_access',
  '/filter': 'filter_access',
};

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sales (POS)', path: '/sales', icon: ShoppingCart },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Production', path: '/production', icon: Factory },
  { name: 'Users', path: '/users', icon: Users },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Filter', path: '/filter', icon: FilterIcon },
];

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = useMemo(() => {
    const rights = user?.rights ?? [];
    return NAV_ITEMS.filter(item => {
      const required = ROUTE_RIGHTS[item.path];
      if (!required) return true;
      return rights.includes(required);
    });
  }, [user]);

  const currentPage =
    NAV_ITEMS.find(i => i.path === location.pathname)?.name || 'App';

  const userInitials = getInitials(user?.userName);

  return (
    <div className="relative h-dvh overflow-hidden flex font-sans bg-slate-100 text-slate-900 dark:bg-[#0a0f1e] dark:text-slate-100">

      {/* Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 w-64 h-dvh
          transform transition-transform duration-300 ease-in-out shrink-0
          lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Glass card */}
        <div className="h-full flex flex-col overflow-hidden
          bg-white/90 dark:bg-slate-900/90
          backdrop-blur-xl
          border-r border-slate-200/60 dark:border-slate-700/40
          shadow-[4px_0_32px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.4)]
        ">

          {/* Logo */}
          <div className="px-6 py-5 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-700/40">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/30 text-white">
              O
            </div>
            <div>
              <span className="font-black tracking-tight text-base text-slate-900 dark:text-white">
                OptimaPOS
              </span>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                by Optimabyte
              </p>
            </div>
          </div>

          {/* Section label */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
              Navigation
            </p>
          </div>

          {/* NAV */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                    transition-all duration-200 group overflow-hidden
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }
                  `}
                >
                  {/* Active left glow bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/50 rounded-r-full" />
                  )}

                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'drop-shadow-sm' : ''}`} />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">
                    {item.name}
                  </span>

                  {/* Hover shimmer */}
                  {!isActive && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* USER PANEL */}
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/40">
            {/* User info */}
            <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-wider shrink-0
                bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200">
                  {user?.userName || 'User'}
                </p>
                <p className="text-[9px] uppercase font-black tracking-widest truncate text-blue-500 dark:text-blue-400">
                  {user?.role || 'Role'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
              text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400
              hover:bg-red-50 dark:hover:bg-red-500/10 group"
            >
              <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 min-w-0 h-dvh lg:ml-64 flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <header className="h-16 shrink-0 flex items-center justify-between px-5 lg:px-8
          bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
          border-b border-slate-200/60 dark:border-slate-700/40
          shadow-sm dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]
        ">

          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page breadcrumb */}
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
                {company?.name || 'Company'}
              </span>
              <span className="hidden sm:block text-slate-300 dark:text-slate-700 text-xs">/</span>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {currentPage}
              </h1>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">

            {/* Parent company label */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg
              bg-slate-100 dark:bg-slate-800/60
              border border-slate-200/80 dark:border-slate-700/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Optimabyte Softwares
              </span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95
              bg-slate-100 dark:bg-slate-800/60
              border border-slate-200/80 dark:border-slate-700/50
              text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark' ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Sun className="w-4 h-4 text-amber-400" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Moon className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* User avatar */}
            <div className="relative group cursor-default">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-wider
                bg-gradient-to-br from-blue-500 to-indigo-600 text-white
                shadow-md shadow-blue-500/25
                ring-2 ring-white dark:ring-slate-900
                transition-transform duration-200 group-hover:scale-105">
                {userInitials}
              </div>
              {/* Tooltip on hover */}
              <div className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap pointer-events-none
                opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0
                transition-all duration-200
                bg-slate-900 dark:bg-slate-700 text-white shadow-xl z-50">
                {user?.userName || 'User'}
                <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45" />
              </div>
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Subtle top decoration */}
          <div className="pointer-events-none fixed top-16 left-0 lg:left-64 right-0 h-px
            bg-gradient-to-r from-transparent via-blue-500/20 to-transparent z-10" />

          <div className="p-5 lg:p-8">
            <div className="max-w-7xl mx-auto min-h-full">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}