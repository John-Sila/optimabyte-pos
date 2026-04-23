import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users as UsersIcon, 
  DollarSign, 
  Package as PackageIcon,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { collection, onSnapshot, query, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Sale, Stats } from '../types';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { company } = useAuth();
  const [stats, setStats] = useState<Stats>({ noOfUsers: 0, totalSales: 0, totalRevenue: 0 });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  useEffect(() => {
    if (!company) return;

    // Fetch stats
    const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
    const unsubscribeStats = onSnapshot(statsRef, (doc) => {
      if (doc.exists()) {
        setStats(doc.data() as Stats);
      }
    });

    // Fetch recent sales
    const salesRef = collection(db, 'companies', company.id, 'sales');
    const q = query(salesRef, orderBy('timestamp', 'desc'), limit(5));
    const unsubscribeSales = onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setRecentSales(sales);
    });

    return () => {
      unsubscribeStats();
      unsubscribeSales();
    };
  }, [company]);

  const cards = [
    { title: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, trend: '+12.5%', color: 'text-emerald-500', trendColor: 'text-emerald-600 bg-emerald-50' },
    { title: 'Total Sales', value: stats.totalSales.toLocaleString(), icon: TrendingUp, trend: '+8.2%', color: 'text-blue-500', trendColor: 'text-blue-600 bg-blue-50' },
    { title: 'Inventory Items', value: '12,044', icon: PackageIcon, trend: '-2.1%', color: 'text-orange-500', trendColor: 'text-orange-600 bg-orange-50' },
    { title: 'Active Users', value: stats.noOfUsers.toString(), icon: UsersIcon, trend: '+1', color: 'text-purple-500', trendColor: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div 
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{card.title}</p>
              <div className={`${card.color} opacity-40`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 leading-tight">{card.value}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${card.trendColor}`}>
                {card.trend}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">vs last month</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="font-bold text-slate-800 tracking-tight">Recent Transactions</h3>
            <button className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-wider">View All Sales</button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3">Sale ID</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-900">#{(sale.transactionId || sale.id).slice(-8)}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{sale.cashierId}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">${sale.grandTotal.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        sale.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs text-right font-medium">
                      {sale.timestamp?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-300 italic text-sm">
                      No records available in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-slate-900 text-white p-6 border border-slate-800 rounded-xl relative overflow-hidden">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 relative z-10">Active Production Jobs</h3>
             <div className="space-y-5 relative z-10">
                {[
                  { label: 'Batch #449 - Leather', progress: 82, color: 'bg-blue-400' },
                  { label: 'Batch #450 - Textile', progress: 45, color: 'bg-emerald-400' },
                ].map(batch => (
                  <div key={batch.label}>
                    <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                      <span className="text-slate-300">{batch.label}</span>
                      <span className="font-mono text-white text-[10px]">{batch.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                      <div className={`${batch.color} h-full rounded-full`} style={{ width: `${batch.progress}%` }}></div>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded border border-slate-700 uppercase tracking-widest transition-colors">
                    Production Console
                  </button>
                </div>
             </div>
             {/* Background glow */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-black text-slate-400 mb-4 text-[10px] uppercase tracking-widest">System Health</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'DB Latency', value: '12ms', color: 'text-slate-900' },
                { label: 'Auth Persistence', value: 'Stable', color: 'text-emerald-500' },
                { label: 'Cache Hit Rate', value: '99.4%', color: 'text-slate-900' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">{stat.label}</span>
                  <span className={`font-mono font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
