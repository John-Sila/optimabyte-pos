import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  Package as PackageIcon,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  limit,
  orderBy,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

type Transaction = {
  id: string;
  cashier: string;
  totalAmount: number;
  items: string[];
  status: string;
  dateCompleted?: Timestamp;
};

type MonthlyStats = {
  soldPieces?: Record<string, Record<string, number>>;
  soldAmount?: Record<string, Record<string, number>>;
  totalSales?: number;
  totalRevenue?: number;
  noOfUsers?: number;
};

export default function Dashboard() {
  const { company } = useAuth();
  const [stats, setStats] = useState<MonthlyStats>({});
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([]);

  useEffect(() => {
    if (!company) return;

    const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
    const unsubscribeStats = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) setStats(snap.data() as MonthlyStats);
    });

    const transactionsRef = collection(db, 'companies', company.id, 'transactions');
    const q = query(transactionsRef, orderBy('dateCompleted', 'desc'), limit(8));
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const txns = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
      setRecentTransactions(txns);
    });

    const inventoryRef = collection(db, 'companies', company.id, 'inventory');
    const unsubscribeInventory = onSnapshot(inventoryRef, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setInventoryCount(items.length);
      setLowStockCount(items.filter((item) => Number(item.quantity || 0) <= 5).length);

      const top = [...items]
        .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
        .slice(0, 5)
        .map((item) => ({
          name: item.name || 'Unnamed',
          qty: Number(item.quantity || 0),
        }));

      setTopItems(top);
    });

    return () => {
      unsubscribeStats();
      unsubscribeTransactions();
      unsubscribeInventory();
    };
  }, [company]);

  const year = new Date().getFullYear().toString();
  const month = new Date().toLocaleString('default', { month: 'long' });

  const monthlySoldPieces = Number(stats.soldPieces?.[year]?.[month] || 0);
  const monthlySoldAmount = Number(stats.soldAmount?.[year]?.[month] || 0);
  const totalSales = Number(stats.totalSales || 0);
  const totalRevenue = Number(stats.totalRevenue || 0);
  const activeUsers = Number(stats.noOfUsers || 0);

  const cards = [
    {
      title: 'Monthly Revenue',
      value: `KES ${monthlySoldAmount.toLocaleString()}`,
      icon: DollarSign,
      trend: 'Live',
      color: 'text-emerald-500',
      trendColor: 'text-emerald-600 bg-emerald-50'
    },
    {
      title: 'Monthly Pieces',
      value: monthlySoldPieces.toLocaleString(),
      icon: TrendingUp,
      trend: 'Live',
      color: 'text-blue-500',
      trendColor: 'text-blue-600 bg-blue-50'
    },
    {
      title: 'Inventory Items',
      value: inventoryCount.toLocaleString(),
      icon: PackageIcon,
      trend: `${lowStockCount} low`,
      color: 'text-orange-500',
      trendColor: 'text-orange-600 bg-orange-50'
    },
    {
      title: 'Active Users',
      value: activeUsers.toLocaleString(),
      icon: UsersIcon,
      trend: 'Live',
      color: 'text-purple-500',
      trendColor: 'text-purple-600 bg-purple-50'
    },
  ];

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'pending') return 'bg-orange-100 text-orange-700';
    if (s === 'cancelled' || s === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };

  const formatDate = (value?: Timestamp) => {
    if (!value) return '-';
    return value.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {card.title}
                </p>
                <div className={`${card.color} opacity-40`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 leading-tight">{card.value}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${card.trendColor}`}>
                  {card.trend}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 text-white p-6 border border-slate-800 rounded-xl relative overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 relative z-10">
              Top Inventory
            </h3>

            <div className="space-y-5 relative z-10">
              {topItems.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                    <span className="text-slate-300">{item.name}</span>
                    <span className="font-mono text-white text-[10px]">{item.qty}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <div
                      className="bg-blue-400 h-full rounded-full"
                      style={{ width: `${Math.max(10, Math.min(100, item.qty))}%` }}
                    />
                  </div>
                </div>
              ))}

              {topItems.length === 0 && (
                <div className="text-slate-500 text-xs">No inventory data available.</div>
              )}
            </div>

            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-black text-slate-400 mb-4 text-[10px] uppercase tracking-widest">
              Sales Summary
            </h3>

            <div className="flex flex-col gap-3">
              {[
                { label: 'This Month Revenue', value: `KES ${monthlySoldAmount.toLocaleString()}`, color: 'text-slate-900' },
                { label: 'This Month Pieces', value: monthlySoldPieces.toLocaleString(), color: 'text-slate-900' },
                { label: 'Total Revenue', value: `KES ${totalRevenue.toLocaleString()}`, color: 'text-slate-900' },
                { label: 'Total Sales', value: totalSales.toLocaleString(), color: 'text-slate-900' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">{stat.label}</span>
                  <span className={`font-mono font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="font-bold text-slate-800 tracking-tight">Recent Transactions</h3>
            <button className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-wider">
              View All
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3">Transaction ID</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-900">
                      #{txn.id.slice(0, 7)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {txn.cashier}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {txn.items?.length ? txn.items.slice(0, 2).join(', ') + (txn.items.length > 2 ? '...' : '') : '-'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      KES {Number(txn.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusStyle(txn.status)}`}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs text-right font-medium">
                      {formatDate(txn.dateCompleted)}
                    </td>
                  </tr>
                ))}

                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-300 italic text-sm">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}