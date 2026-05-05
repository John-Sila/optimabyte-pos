import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

import {
  filterTransactions,
  summarizeTransactions,
  groupByCustomer,
  groupByMonth,
  getUniqueCustomers,
  getUniqueCashiers,
  getUniqueMvts,
  TransactionRecord,
  FilterOptions,
} from '../utils/transactionFilters';

export default function Filtration() {
  const { company } = useAuth();

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterOptions>({
    customer: '',
    cashier: '',
    mvt: '',
    month: '',
    year: '',
    startMonth: '',
    startYear: '',
    endMonth: '',
    endYear: '',
  });

  const [groupMode, setGroupMode] = useState<
    'transactions' | 'customers' | 'months'
  >('transactions');

  const [statusFilter, setStatusFilter] = useState('');
  const [movementFilter, setMovementFilter] = useState<
    '' | 'sales' | 'purchases' | 'production'
  >('');

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  useEffect(() => {
    if (!company?.id) return;

    const fetchTransactions = async () => {
      try {
        const snap = await getDocs(
          collection(db, 'companies', company.id, 'transactions')
        );

        const data: TransactionRecord[] = snap.docs.map((doc) => {
          const d = doc.data();

          return {
            ...d,
            totalAmount: Number(d.totalAmount ?? d.grossAmount ?? 0) || 0,
            revenue: Number(d.revenue ?? 0) || 0,
          } as TransactionRecord;
        });

        setTransactions(data);
      } catch (err) {
        console.error('Failed to fetch transactions', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [company]);

  const safeTransactions = transactions || [];

  // -----------------------------
  // FILTERING
  // -----------------------------
  const filteredTransactions = useMemo(() => {
    let rows = filterTransactions(safeTransactions, filters);

    if (statusFilter) {
      rows = rows.filter((t) => t.status === statusFilter);
    }

    if (movementFilter) {
      rows = rows.filter(
        (t) => String(t.mvt || '').toLowerCase() === movementFilter
      );
    }

    return rows;
  }, [safeTransactions, filters, statusFilter, movementFilter]);

  // -----------------------------
  // ANALYTICS
  // -----------------------------
  const summary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions]
  );

  const byCustomer = useMemo(
    () => groupByCustomer(filteredTransactions),
    [filteredTransactions]
  );

  const byMonth = useMemo(
    () => groupByMonth(filteredTransactions),
    [filteredTransactions]
  );

  const totalTransactions = filteredTransactions.length;
  const topCustomer = byCustomer[0]?.customerName || 'N/A';
  const peakMonth = byMonth[0]?.name || 'N/A';

  // -----------------------------
  // LOADING STATE
  // -----------------------------
  if (loading) {
    return <div className="p-6">Loading transactions...</div>;
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-bold">
          Filtration — {company?.name || 'Unknown Company'}
        </h1>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.customer}
          onChange={(e) =>
            setFilters((p) => ({ ...p, customer: e.target.value }))
          }
        >
          <option value="">All Customers</option>
          {getUniqueCustomers(safeTransactions).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={filters.cashier}
          onChange={(e) =>
            setFilters((p) => ({ ...p, cashier: e.target.value }))
          }
        >
          <option value="">All Cashiers</option>
          {getUniqueCashiers(safeTransactions).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value as any)}
        >
          <option value="">All Movements</option>
          <option value="sales">Sales</option>
          <option value="purchases">Purchases</option>
          <option value="production">Production</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Transactions" value={totalTransactions} />
        <Stat
          label="Revenue"
          value={`₦${Number(summary.totalRevenue || 0).toFixed(2)}`}
        />
        <Stat label="Top Customer" value={topCustomer} />
        <Stat label="Peak Month" value={peakMonth} />
      </div>

      {/* LIST */}
      <div className="bg-white border rounded-xl divide-y">
        {filteredTransactions.length ? (
          filteredTransactions.map((txn) => {
            const amount =
              Number(txn.totalAmount ?? txn.grossAmount ?? txn.revenue ?? 0) ||
              0;

            return (
              <div
                key={txn.id}
                className="p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold">{txn.customerName || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">
                    {txn.mvt} • {txn.status} • {txn.cashier}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">₦{amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">
                    {txn.dateCompleted?.toDate?.()?.toLocaleString?.() ||
                      'No date'}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-gray-500">No matching data</div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// SMALL STAT COMPONENT
// -----------------------------
function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="p-4 bg-white border rounded-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}