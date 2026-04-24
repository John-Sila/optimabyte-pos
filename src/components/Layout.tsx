import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Factory, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Store
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
  { name: 'Reports', path: '/reports', icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const currentPage = navItems.find(item => item.path === location.pathname)?.name || 'App';
  
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out shrink-0
        lg:translate-x-0 lg:static lg:inset-auto flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg">O</div>
            <span className="font-bold tracking-tight text-xl">OmniRetail</span>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-all
                  ${location.pathname === item.path 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                `}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">
                {user?.userName?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.userName}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider truncate">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="hidden md:block text-[10px] font-black text-slate-400 tracking-widest uppercase truncate max-w-xs">
              {company?.name}
            </h2>
            <div className="hidden md:block h-4 w-px bg-slate-200"></div>
            <h1 className="text-lg font-bold text-slate-800 truncate">{currentPage}</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">System Status</span>
              <span className="text-[11px] text-emerald-500 flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> PRODUCTION READY
              </span>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <div className="max-w-[1600px] mx-auto min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
