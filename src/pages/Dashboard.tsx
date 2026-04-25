import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  Package as PackageIcon,
  ShoppingCart,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Clock3,
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
  mvt: ReactNode;
  customerName: string;
  id: string;
  cashier: string;
  totalAmount: number;
  items: string[];
  status: string;
  dateCompleted?: Timestamp;
};

type MonthlyStats = {
  [x: string]: any;
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
  const [usersCount, setUsersCount] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');

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

    const usersRef = collection(db, 'companies', company.id, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      setUsersCount(snapshot.size);
    });

    return () => {
      unsubscribeStats();
      unsubscribeTransactions();
      unsubscribeInventory();
      unsubscribeUsers();
    };
  }, [company]);

  const year = new Date().getFullYear().toString();
  const month = new Date().toLocaleString('default', { month: 'long' });

  const monthlyBagsSold = Number(stats.soldPieces?.[year]?.[month] || 0);
  const monthlySales = Number(stats.soldAmount?.[year]?.[month] || 0);
  const monthlyRevenue = Number(stats.revenues?.[year]?.[month] || 0);

  const monthlySoldPieces = Number(stats.soldPieces?.[year]?.[month] || 0);
  const monthlySoldAmount = Number(stats.soldAmount?.[year]?.[month] || 0);
  const totalSales = Number(stats.totalSales || 0);
  const totalRevenue = Number(stats.totalRevenue || 0);

  const cards = [
    {
      title: 'Items sold (This month)',
      value: monthlyBagsSold.toLocaleString(),
      icon: ShoppingCart,
      trend: 'Live',
      color: 'text-emerald-500',
      trendColor: 'text-emerald-600 bg-emerald-50'
    },
    {
      title: 'Total Sales',
      value: `KES ${monthlySales.toLocaleString()}`,
      icon: DollarSign,
      trend: 'Live',
      color: 'text-blue-500',
      trendColor: 'text-blue-600 bg-blue-50'
    },
    {
      title: 'Total Revenue',
      value: `KES ${monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      trend: 'Live',
      color: 'text-orange-500',
      trendColor: 'text-orange-600 bg-orange-50'
    },
    {
      title: 'Total Users',
      value: usersCount.toLocaleString(),
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

  const filteredTransactions = recentTransactions.filter((txn) =>
    (txn.customerName || '').toLowerCase().includes(customerSearch.toLowerCase())
  );

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



        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold text-slate-800 tracking-tight">Recent Transactions</h3>

              <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by customer..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3">T-ID</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Customer/Supplier</th>
                  <th className="px-6 py-3">Mvt</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-900">
                      {txn.id || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                      {txn.cashier
                        ?.toString()
                        .trim()
                        .split(/\s+/)
                        .map((part, index, arr) =>
                          index === 0 && arr.length > 1 ? `${part[0]}.` : part
                        )
                        .join(' ')}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                      {txn.customerName || '-'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          txn.mvt === 'Sales'
                            ? 'bg-green-100 text-green-700'
                            : txn.mvt === 'Purchases'
                              ? 'bg-red-100 text-red-700'
                              : txn.mvt === 'Production'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {txn.mvt === 'Sales' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : txn.mvt === 'Purchases' ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : txn.mvt === 'Production' ? (
                          <Clock3 className="w-3 h-3" />
                        ) : null}
                        {txn.mvt}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {txn.items?.length ? (
                        <div className="flex flex-col">
                          {txn.items.slice(0, 2).map((item, index) => (
                            <span key={index} className="whitespace-nowrap">
                              {item}
                            </span>
                          ))}
                          {txn.items.length > 2 && <span>...</span>}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {Number(txn.totalAmount) === 0
                        ? '-'
                        : `KES ${Number(txn.totalAmount).toLocaleString()}`}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          txn.status === 'Incomplete'
                            ? 'bg-red-100 text-red-700'
                            : getStatusStyle(txn.status)
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-medium whitespace-nowrap">
                      {formatDate(txn.dateCompleted)}
                    </td>
                  </tr>
                ))}

                {filteredTransactions.length === 0 && (
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