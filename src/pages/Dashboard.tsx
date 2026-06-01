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
import { notify } from '../lib/toast';


type Transaction = {
  [x: string]: string;
  mvt: string;
  customerName: string;
  id: string;
  cashier: string;
  totalAmount: number;
  items: string[];
  status: string;
  dateCompleted?: Timestamp;
  totalProducts?: number;
  inventoryId?: string;
};


type MonthlyStats = {
  [x: string]: any;
  soldPieces?: Record<string, Record<string, number>>;
  soldAmount?: Record<string, Record<string, number>>;
  totalSales?: number;
  totalRevenue?: number;
  noOfUsers?: number;
  revenues?: Record<string, Record<string, number>>;
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
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);


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
      setInventoryItems(items);
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


  const cards = [
    {
      title: 'Items sold (This month)',
      value: monthlyBagsSold.toLocaleString(),
      icon: ShoppingCart,
      trend: 'Live',
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600'
    },
    {
      title: 'Total Sales',
      value: `KES ${monthlySales.toLocaleString()}`,
      icon: DollarSign,
      trend: 'Live',
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Total Revenue',
      value: `KES ${monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      trend: 'Live',
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600'
    },
    {
      title: 'Total Users',
      value: usersCount.toLocaleString(),
      icon: UsersIcon,
      trend: 'Live',
      color: 'violet',
      gradient: 'from-violet-500 to-violet-600'
    },
  ];


  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return 'bg-emerald/10 text-emerald-700 border border-emerald/20';
    if (s === 'pending') return 'bg-orange/10 text-orange-700 border border-orange/20';
    if (s === 'cancelled' || s === 'failed') return 'bg-red/10 text-red-700 border border-red/20';
    return 'bg-slate/10 text-slate-500 border border-slate/20';
  };


  const getMvtStyle = (mvt: string) => {
    const m = mvt?.toLowerCase();
    if (m === 'sales') return 'bg-emerald/10 text-emerald-700 border border-emerald/20';
    if (m === 'purchases') return 'bg-orange/10 text-orange-700 border border-orange/20';
    if (m === 'production') return 'bg-blue/10 text-blue-700 border border-blue/20';
    return 'bg-slate/10 text-slate-500 border border-slate/20';
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


  const getItemPhoto = (itemName: string) => {
    const item = inventoryItems.find((i) => i.name === itemName);
    return item?.photoURL || null;
  };


  const q = customerSearch.toLowerCase();
  const filteredTransactions = recentTransactions.filter((txn) =>
    String(txn.customerName || '').toLowerCase().includes(q) ||
    String(txn.mvt || '').toLowerCase().includes(q) ||
    String(txn.items?.join(' ') || '').toLowerCase().includes(q)
  );

  const deviceOS = typeof window !== 'undefined' && navigator.userAgent.includes('Windows') ? 'Windows' : 'Other OS';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Safe extraction of network statistics
  const conn = typeof navigator !== 'undefined' ? ((navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection) : null;
  const effectiveType = conn?.effectiveType?.toUpperCase() || 'UNKNOWN';
  const downlink = conn?.downlink ? `${conn.downlink} Mbps` : 'UNKNOWN';


  return (
    <div className="space-y-8">
      {/* device */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 px-5 py-3 rounded-2xl">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Platform: <strong className="text-slate-600 dark:text-slate-300">{deviceOS}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Region: <strong className="text-slate-600 dark:text-slate-300">Pridelands, Machakos</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span>Timezone: <strong className="text-slate-600 dark:text-slate-300">{timezone}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span>Network: <strong className="text-slate-600 dark:text-slate-300">{effectiveType} ({downlink})</strong></span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/30 transition-all duration-300"
          >
            {/* Colored accent ring */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 blur-xl`} />
            
            <div className="relative z-10 flex items-start justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-tight">
                {card.title}
              </p>
              <div className={`p-2 rounded-xl bg-${card.color}-500/10 group-hover:bg-${card.color}-500/20 backdrop-blur-sm border border-${card.color}-200/30 dark:border-${card.color}-800/30 transition-all duration-300`}>
                <card.icon className={`w-5 h-5 text-${card.color}-500 group-hover:scale-110 transition-transform duration-200`} />
              </div>
            </div>
            
            <p className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-200 bg-clip-text text-transparent leading-tight">
              {card.value}
            </p>
            
            <div className="flex items-center gap-2 mt-3">
              <motion.span 
                className={`text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm`}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.05 }}
              >
                <span className={`text-${card.color}-600 dark:text-${card.color}-400 font-black tracking-wide`}>
                  {card.trend}
                </span>
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/20 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-900/50 dark:to-slate-950/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:to-slate-50 bg-clip-text text-transparent tracking-tight">
                Recent Transactions
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {filteredTransactions.length} of {recentTransactions.length} transactions
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search customer, item or movement..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-400 dark:text-slate-500 text-xs uppercase font-black tracking-widest border-b border-slate-200/50 dark:border-slate-800/50">
                <th className="px-6 py-4 text-left">T-ID</th>
                <th className="px-6 py-4 text-left">Cashier</th>
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Movement</th>
                <th className="px-6 py-4 text-left">Count</th>
                <th className="px-6 py-4 text-left">Items</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {filteredTransactions.map((txn, index) => (
                <motion.tr 
                  key={txn.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all duration-200 border-b border-slate-200/30 dark:border-slate-800/30 last:border-b-0"
                >
                  <td className="px-6 py-4 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {txn.id?.slice(-8).toUpperCase() || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                    {txn.cashier || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-700 text-sm dark:text-slate-300 font-medium max-w-[160px] truncate">
                    {txn.customerName || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-sm shadow-sm ${getMvtStyle(txn.mvt)}`}>
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
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-bold">
                    {txn.totalProducts || '-'}
                  </td>
                  <td className="px-6 py-4 max-w-[280px]">
                    {txn.items?.length ? (
                      <div className="space-y-1.5">
                        {txn.items.slice(0, 2).map((item, i) => {
                          const photoUrl = getItemPhoto(item);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={item}
                                  className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                  <PackageIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                </div>
                              )}
                              <span className="inline-block bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded text-xs text-slate-700 dark:text-slate-300">
                                {item}
                              </span>
                            </div>
                          );
                        })}
                        {txn.items.length > 2 && (
                          <span className="text-slate-400 text-xs">+{txn.items.length - 2}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-900 dark:text-slate-100">
                        {Number(txn.totalAmount) === 0 ? '-' : `KES ${Number(txn.totalAmount).toLocaleString()}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-sm shadow-sm ${getStatusStyle(txn.status)}`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px] font-medium whitespace-nowrap">
                    {formatDate(txn.dateCompleted)}
                  </td>
                </motion.tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="text-slate-400 dark:text-slate-500 space-y-2">
                      <Search className="w-12 h-12 mx-auto opacity-30" />
                      <p className="text-lg font-medium">No transactions match your search</p>
                      <p className="text-sm">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}