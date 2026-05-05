import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  Download,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Filter,
  Users,
  CalendarRange,
  Boxes
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type NestedStats = Record<string, Record<string, number>>;

type GeneralStatsDoc = {
  soldAmount?: NestedStats;
  soldPieces?: NestedStats;
  revenues?: NestedStats;
};

type CustomerDoc = {
  id: string;
  customerName?: string;
  soldAmount?: NestedStats;
  soldPieces?: NestedStats;
  revenues?: NestedStats;
};

type FlatPoint = {
  year: string;
  month: string;
  value: number;
};

type Row = {
  name: string;
  soldAmount: number;
  soldPieces: number;
  revenues: number;
};

type Metric = 'soldAmount' | 'soldPieces' | 'revenues';
type Source = 'general' | 'customer';
type TimePreset = 'all' | 'thisMonth' | 'lastMonth' | 'month' | 'year';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function flattenNestedMap(obj?: NestedStats): FlatPoint[] {
  if (!obj) return [];
  const out: FlatPoint[] = [];

  for (const [year, months] of Object.entries(obj)) {
    for (const [month, value] of Object.entries(months || {})) {
      out.push({ year, month, value: Number(value || 0) });
    }
  }

  return out;
}

function monthIndex(month: string) {
  return MONTHS.findIndex((m) => m.toLowerCase() === month.toLowerCase());
}

function nowMonth() {
  return MONTHS[new Date().getMonth()];
}

function prevMonth() {
  return MONTHS[(new Date().getMonth() + 11) % 12];
}

function nowYear() {
  return String(new Date().getFullYear());
}

function matchesTime(
  year: string,
  month: string,
  preset: TimePreset,
  selectedMonth: string,
  selectedYear: string
) {
  if (preset === 'all') return true;
  if (preset === 'thisMonth') return year === nowYear() && month.toLowerCase() === nowMonth().toLowerCase();
  if (preset === 'lastMonth') return year === nowYear() && month.toLowerCase() === prevMonth().toLowerCase();
  if (preset === 'month') return month.toLowerCase() === selectedMonth.toLowerCase();
  if (preset === 'year') return year === selectedYear;
  return true;
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function Filtration() {
  const { company } = useAuth();

  const [generalStats, setGeneralStats] = useState<GeneralStatsDoc | null>(null);
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [source, setSource] = useState<Source>('general');
  const [metric, setMetric] = useState<Metric>('revenues');
  const [customerId, setCustomerId] = useState('');
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [selectedYear, setSelectedYear] = useState(nowYear());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!company?.id) return;

    setLoading(true);

    const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
    const unsubStats = onSnapshot(
      statsRef,
      (snap) => {
        setGeneralStats((snap.data() || null) as GeneralStatsDoc | null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load stats', err);
        setGeneralStats(null);
        setLoading(false);
      }
    );

    const custRef = collection(db, 'companies', company.id, 'customers');
    const unsubCust = onSnapshot(
      custRef,
      (snap) => {
        setCustomers(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          })) as CustomerDoc[]
        );
      },
      (err) => {
        console.error('Failed to load customers', err);
        setCustomers([]);
      }
    );

    return () => {
      unsubStats();
      unsubCust();
    };
  }, [company]);

  const selectedCustomer = useMemo(() => {
    if (!customerId) return null;
    return customers.find((c) => c.id === customerId) || null;
  }, [customers, customerId]);

  const rows = useMemo(() => {
    const merged = new Map<string, Row>();

    const addPoint = (year: string, month: string, key: Metric, value: number) => {
      if (!matchesTime(year, month, timePreset, selectedMonth, selectedYear)) return;
      const name = `${month} ${year}`;
      const current = merged.get(name) || {
        name,
        soldAmount: 0,
        soldPieces: 0,
        revenues: 0
      };
      current[key] += safeNumber(value);
      merged.set(name, current);
    };

    const sourceData =
      source === 'general'
        ? generalStats
        : selectedCustomer;

    if (!sourceData) return [];

    for (const p of flattenNestedMap(sourceData.soldAmount)) addPoint(p.year, p.month, 'soldAmount', p.value);
    for (const p of flattenNestedMap(sourceData.soldPieces)) addPoint(p.year, p.month, 'soldPieces', p.value);
    for (const p of flattenNestedMap(sourceData.revenues)) addPoint(p.year, p.month, 'revenues', p.value);

    return Array.from(merged.values()).sort((a, b) => {
      const [am, ay] = a.name.split(' ');
      const [bm, by] = b.name.split(' ');
      if (ay !== by) return Number(ay) - Number(by);
      return monthIndex(am) - monthIndex(bm);
    });
  }, [generalStats, selectedCustomer, source, timePreset, selectedMonth, selectedYear]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const totalValue = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + safeNumber(row[metric]), 0);
  }, [filteredRows, metric]);

  const topRow = filteredRows[0]?.name || 'N/A';

  const metricLabel =
    metric === 'revenues' ? 'Revenue' : metric === 'soldAmount' ? 'Sold Amount' : 'Sold Pieces';

  const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid rgb(226 232 240)',
    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.12)',
    fontSize: '12px',
    backgroundColor: '#ffffff',
    color: '#0f172a'
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      console.log({
        source,
        metric,
        customerId,
        timePreset,
        selectedMonth,
        selectedYear,
        totalValue,
        topRow
      });
      alert('PDF export wiring is ready.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            Filtration — {company?.name || 'Unknown Company'}
          </h1>
          <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
            Filter general stats or customer stats by month and year.
          </p>
        </div>

        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm transition-all active:scale-95 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={`Selected ${metricLabel}`} value={totalValue.toFixed(2)} />
        <Stat label="Top Month" value={topRow} />
        <Stat label="Source" value={source === 'general' ? 'General Stats' : selectedCustomer?.customerName || 'Selected Customer'} />
        <Stat label="Rows" value={filteredRows.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label="Source"
          icon={<Boxes className="h-4 w-4" />}
          value={source}
          onChange={(v) => setSource(v as Source)}
          options={[
            { value: 'general', label: 'General Stats' },
            { value: 'customer', label: 'Customer Stats' }
          ]}
        />

        <SelectField
          label="Metric"
          icon={<TrendingUp className="h-4 w-4" />}
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          options={[
            { value: 'revenues', label: 'Revenues' },
            { value: 'soldAmount', label: 'Sold Amount' },
            { value: 'soldPieces', label: 'Sold Pieces' }
          ]}
        />

        <SelectField
          label="Time"
          icon={<CalendarRange className="h-4 w-4" />}
          value={timePreset}
          onChange={(v) => setTimePreset(v as TimePreset)}
          options={[
            { value: 'all', label: 'All Months' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'lastMonth', label: 'Last Month' },
            { value: 'month', label: 'Selected Month' },
            { value: 'year', label: 'Selected Year' }
          ]}
        />

        <SelectField
          label="Customer"
          icon={<Users className="h-4 w-4" />}
          value={customerId}
          onChange={setCustomerId}
          options={[
            { value: '', label: 'All Customers' },
            ...customers.map((c) => ({ value: c.id, label: c.customerName || c.id }))
          ]}
          disabled={source !== 'customer'}
        />

        <SelectField
          label="Month"
          icon={<Filter className="h-4 w-4" />}
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={MONTHS.map((m) => ({ value: m, label: m }))}
        />

        <SelectField
          label="Year"
          icon={<Filter className="h-4 w-4" />}
          value={selectedYear}
          onChange={setSelectedYear}
          options={[
            String(new Date().getFullYear()),
            String(new Date().getFullYear() - 1),
            '2024',
            '2025',
            '2026'
          ].map((y) => ({ value: y, label: y }))}
        />

        <div className="md:col-span-2 xl:col-span-2">
          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Search
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search month..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {metricLabel} Trend
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Sample Rows
          </h3>
          <div className="space-y-3">
            {filteredRows.slice(0, 6).map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{row.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{metricLabel}</p>
                </div>
                <p className="font-black text-slate-900 dark:text-slate-100">
                  {safeNumber(row[metric]).toFixed(2)}
                </p>
              </div>
            ))}
            {!filteredRows.length && (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No matching data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  icon,
  disabled
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            {icon}
          </div>
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full pl-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}