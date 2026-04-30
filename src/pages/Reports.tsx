import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot
} from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Download,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  PieChart as PieIcon
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type NestedStats = Record<string, Record<string, number>>;

type InventoryDoc = {
  id: string;
  name?: string;
  soldAmount?: NestedStats;
  soldPieces?: NestedStats;
  revenues?: NestedStats;
};

type GeneralStatsDoc = {
  soldAmount?: NestedStats;
  soldPieces?: NestedStats;
  revenues?: NestedStats;
};

type FlattenedPoint = {
  year: string;
  month: string;
  value: number;
};

type ChartRow = {
  name: string;
  sales: number;
  revenue: number;
  pieces: number;
};

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6'];

function flattenNestedMap(obj?: NestedStats): FlattenedPoint[] {
  const out: FlattenedPoint[] = [];
  if (!obj) return out;

  for (const [year, months] of Object.entries(obj)) {
    for (const [month, value] of Object.entries(months || {})) {
      out.push({
        year,
        month,
        value: Number(value || 0)
      });
    }
  }

  return out;
}

function monthIndex(month: string) {
  const idx = MONTH_ORDER.findIndex((m) => m.toLowerCase() === month.toLowerCase());
  return idx === -1 ? 99 : idx;
}

function formatMonthYear(month: string, year: string) {
  const shortMonth = month.slice(0, 3);
  return `${shortMonth} ${year}`;
}

export default function Reports() {
  const { company } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryDoc[]>([]);
  const [generalStats, setGeneralStats] = useState<GeneralStatsDoc | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!company) return;

    const invRef = collection(db, 'companies', company.id, 'inventory');
    const unsubInv = onSnapshot(invRef, (snap) => {
      setInventoryItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as InventoryDoc[]
      );
    });

    const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
    const unsubStats = onSnapshot(statsRef, (snap) => {
      setGeneralStats((snap.data() || null) as GeneralStatsDoc | null);
    });

    return () => {
      unsubInv();
      unsubStats();
    };
  }, [company]);

  const chartRows: ChartRow[] = useMemo(() => {
    const merged = new Map<string, ChartRow>();

    const addPoint = (year: string, month: string, key: keyof Omit<ChartRow, 'name'>, value: number) => {
      const label = `${month} ${year}`;
      const existing = merged.get(label) || { name: label, sales: 0, revenue: 0, pieces: 0 };
      existing[key] += value;
      merged.set(label, existing);
    };

    for (const item of inventoryItems) {
      for (const point of flattenNestedMap(item.soldPieces)) addPoint(point.year, point.month, 'pieces', point.value);
      for (const point of flattenNestedMap(item.soldAmount)) addPoint(point.year, point.month, 'sales', point.value);
      for (const point of flattenNestedMap(item.revenues)) addPoint(point.year, point.month, 'revenue', point.value);
    }

    for (const point of flattenNestedMap(generalStats?.soldPieces)) addPoint(point.year, point.month, 'pieces', point.value);
    for (const point of flattenNestedMap(generalStats?.soldAmount)) addPoint(point.year, point.month, 'sales', point.value);
    for (const point of flattenNestedMap(generalStats?.revenues)) addPoint(point.year, point.month, 'revenue', point.value);

    return Array.from(merged.values()).sort((a, b) => {
      const [am, ay] = a.name.split(' ');
      const [bm, by] = b.name.split(' ');
      if (ay !== by) return Number(ay) - Number(by);
      return monthIndex(am) - monthIndex(bm);
    });
  }, [inventoryItems, generalStats]);

  const categoryData = useMemo(() => {
    const items = inventoryItems
      .map((item) => {
        const revenueTotal = Object.values(item.revenues || {}).reduce((acc, yearMap) => {
          return acc + Object.values(yearMap || {}).reduce((s, v) => s + Number(v || 0), 0);
        }, 0);

        return {
          name: item.name || 'Unknown',
          value: revenueTotal
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);

    return items;
  }, [inventoryItems]);

  const categoryTotal = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }, [categoryData]);

  const totalRevenue = useMemo(() => {
    return chartRows.reduce((sum, row) => sum + row.revenue, 0);
  }, [chartRows]);

  const totalSales = useMemo(() => {
    return chartRows.reduce((sum, row) => sum + row.sales, 0);
  }, [chartRows]);

  const avgSaleValue = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0.00';

  const bestCategory = categoryData[0]?.name || 'N/A';

  const peakRevenueMonth = useMemo(() => {
    const points = flattenNestedMap(generalStats?.revenues);
    if (!points.length) return 'N/A';

    const best = points.reduce((currentBest, point) => {
      return point.value > currentBest.value ? point : currentBest;
    }, points[0]);

    return `${best.month} ${best.year}`;
  }, [generalStats]);

  const peakSalesMonth = useMemo(() => {
  const points = flattenNestedMap(generalStats?.soldPieces);
    if (!points.length) return 'N/A';

    const best = points.reduce((currentBest, point) => {
      return point.value > currentBest.value ? point : currentBest;
    }, points[0]);

    return `${best.month} ${best.year}`;
  }, [generalStats]);

  const tooltipStyle = {
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px'
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const summary = {
        totalRevenue,
        totalSales,
        avgSaleValue,
        bestCategory,
        peakMonth,
        items: inventoryItems.length
      };

      console.log('PDF export placeholder:', summary);
      alert('PDF export wiring is ready. Install and use pdf-lib to generate the document bytes.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Business Intelligence</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">
            Financial performance and sales velocity metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-800 hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <Download className="w-4 h-4 text-slate-400" />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Avg Sale Value', value: `$${avgSaleValue}`, icon: DollarSign, color: 'text-orange-500' },
          { label: 'Best Category', value: bestCategory, icon: ShoppingBag, color: 'text-blue-500' },
          { label: 'Peak Month (Revenue)', value: peakRevenueMonth, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Peak Month (Product)', value: peakSalesMonth, icon: TrendingUp, color: 'text-purple-500' }
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`${stat.color} opacity-40`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 leading-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Revenue vs Sales
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="sales" stroke="#94a3b8" strokeWidth={3} dot={{ r: 4, fill: '#94a3b8', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-blue-500" />
            Category Mix
          </h3>
          <div className="h-72 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-3 pr-4">
              {categoryData.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">{cat.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 ml-auto">
                    {categoryTotal > 0 ? ((cat.value / categoryTotal) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Performance Matrix</h3>
          </div>
          <div className="h-72 w-full p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="sales" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="revenue" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}