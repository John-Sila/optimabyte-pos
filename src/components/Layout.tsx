import React, { useEffect, useState } from 'react';
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

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sales (POS)', path: '/sales', icon: ShoppingCart },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Production', path: '/production', icon: Factory },
  { name: 'Users', path: '/users', icon: Users },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Filter', path: '/filter', icon: FilterIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Improved theme state with system preference fallback
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync theme with localStorage and system preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  // Apply theme to root + persist
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme); // Bonus: data attribute for CSS vars if needed
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const currentPage =
    navItems.find(item => item.path === location.pathname)?.name || 'App';

  // Smooth theme toggle with haptic feedback (mobile-friendly)
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    // Optional: Add haptic feedback for mobile
    if (navigator.vibrate) navigator.vibrate(50);
  };

  return (
    <div className="
      relative h-dvh overflow-hidden flex font-sans
      bg-slate-50 text-slate-900
      dark:bg-slate-950 dark:text-slate-100
    ">
      {/* Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Fixed some redundant dark classes */}
      <aside
        className={`
          fixed top-0 left-0 z-50 w-64 h-dvh
          transform transition-transform duration-200 ease-in-out shrink-0
          bg-slate-900/95 backdrop-blur-sm text-white border-r border-slate-800/50
          lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg">
              O
            </div>
            <span className="font-bold tracking-tight text-xl bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              OptimaPOS
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                    ${isActive
                      ? 'bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 backdrop-blur-sm'
                    }
                  `}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'drop-shadow-sm' : ''}`} />
                  <span className="group-hover:translate-x-1 transition-transform">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User + Logout */}
          <div className="p-4 border-t border-slate-800/50">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="
                w-10 h-10 rounded-2xl flex items-center justify-center
                text-xs font-bold uppercase tracking-wider
                bg-gradient-to-br from-slate-700 to-slate-800 ring-2 ring-slate-700/50 shadow-lg
                shadow-slate-900/25
              ">
                {user?.userName?.[0] || '?'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-slate-200">
                  {user?.userName || 'User'}
                </p>
                <p className="text-xs uppercase font-black tracking-widest truncate
                  bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent
                ">
                  {user?.role || 'Admin'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02]
                text-slate-400 hover:text-slate-100 hover:bg-slate-800/75 backdrop-blur-sm shadow-sm hover:shadow-md
              "
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 h-dvh lg:ml-64 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="
          h-16 flex items-center justify-between px-6 lg:px-8 shrink-0 backdrop-blur-sm
          bg-white/80 border-b border-slate-200/50 shadow-sm
          dark:bg-slate-900/95 dark:border-slate-800/50 dark:shadow-slate-900/20
        ">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="
                lg:hidden p-2.5 rounded-xl backdrop-blur-sm
                text-slate-500 hover:bg-slate-100/80 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-200
                dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:shadow-slate-900/30
              "
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="
              hidden md:block text-xs font-black uppercase tracking-widest truncate max-w-xs
              text-slate-500/80 dark:text-slate-400
            ">
              {company?.name}
            </h2>

            <div className="hidden md:block h-4 w-px bg-slate-200/50 dark:bg-slate-700/50" />

            <h1 className="text-xl lg:text-2xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-slate-100 dark:to-slate-50 pr-2">
              {currentPage}
            </h1>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <span className="
                text-xs font-black uppercase tracking-widest
                text-slate-400/70 dark:text-slate-500/70
              ">
                System Status
              </span>
              <span className="text-sm text-emerald-500/90 flex items-center gap-1.5 font-black tracking-wide bg-emerald-500/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                OPTIMABYTE
              </span>
            </div>

            {/* Enhanced Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="
                p-2.5 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg
                bg-white/50 hover:bg-white/80 backdrop-blur-sm border border-slate-200/50
                dark:bg-slate-800/50 dark:hover:bg-slate-800/80 dark:border-slate-700/50
                shadow-sm hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/30
                active:scale-95
              "
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <motion.div
                animate={{ rotate: theme === 'dark' ? 40 : 320 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                )}
              </motion.div>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}