export type FirestoreTimestampLike = {
  toDate?: () => Date;
};

export type TransactionRecord = {
  id: string;
  cashier?: string;
  customerName?: string;
  customerId?: string;
  mvt?: string;
  status?: string;
  totalAmount?: number | string;
  grossAmount?: number | string;
  revenue?: number | string;
  totalProducts?: number | string;
  items?: string[];
  dateStarted?: FirestoreTimestampLike;
  dateCompleted?: FirestoreTimestampLike;
};

export type FilterOptions = {
  customer?: string;
  cashier?: string;
  mvt?: string;
  month?: string;
  year?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
};

export type SummaryTotals = {
  totalRevenue: number;
  totalSales: number;
  totalPurchases: number;
  totalProduction: number;
  totalProductsSold: number;
};

export type CustomerGroup = {
  customerName: string;
  count: number;
  revenue: number;
  products: number;
  items: TransactionRecord[];
};

export type MonthGroup = {
  name: string;
  revenue: number;
  products: number;
  count: number;
};

const MONTH_ORDER = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const toNumber = (value: unknown) => Number(value || 0);

const monthIndex = (month: string) =>
  MONTH_ORDER.findIndex((m) => m.toLowerCase() === month.toLowerCase());

const normalize = (value?: string) => String(value || '').trim().toLowerCase();

const getTxnDate = (txn: TransactionRecord) => {
  return txn.dateCompleted?.toDate?.() || txn.dateStarted?.toDate?.() || null;
};

const inMonth = (date: Date, month: string, year?: string) => {
  const dMonth = MONTH_ORDER[date.getMonth()];
  const dYear = String(date.getFullYear());
  return year ? dMonth === month && dYear === year : dMonth === month;
};

const inRange = (
  date: Date,
  startMonth?: string,
  startYear?: string,
  endMonth?: string,
  endYear?: string
) => {
  if (!startMonth || !startYear || !endMonth || !endYear) return true;

  const start = new Date(Number(startYear), monthIndex(startMonth), 1, 0, 0, 0, 0);
  const end = new Date(Number(endYear), monthIndex(endMonth) + 1, 0, 23, 59, 59, 999);

  return date >= start && date <= end;
};

export function filterTransactions(transactions: TransactionRecord[], filters: FilterOptions) {
  const qCustomer = normalize(filters.customer);
  const qCashier = normalize(filters.cashier);
  const qMvt = normalize(filters.mvt);

  return transactions.filter((txn) => {
    const date = getTxnDate(txn);

    if (qCustomer && !normalize(txn.customerName).includes(qCustomer)) return false;
    if (qCashier && !normalize(txn.cashier).includes(qCashier)) return false;
    if (qMvt && !normalize(txn.mvt).includes(qMvt)) return false;

    if (filters.month && date) {
      if (!inMonth(date, filters.month, filters.year)) return false;
    }

    if (filters.startMonth && filters.endMonth && filters.startYear && filters.endYear && date) {
      if (!inRange(date, filters.startMonth, filters.startYear, filters.endMonth, filters.endYear)) {
        return false;
      }
    }

    return true;
  });
}

export function summarizeTransactions(transactions: TransactionRecord[]): SummaryTotals {
  return {
    totalRevenue: transactions.reduce(
      (sum, txn) => sum + toNumber(txn.revenue || txn.totalAmount || txn.grossAmount),
      0
    ),
    totalSales: transactions.filter((txn) => normalize(txn.mvt) === 'sales').length,
    totalPurchases: transactions.filter((txn) => normalize(txn.mvt) === 'purchases').length,
    totalProduction: transactions.filter((txn) => normalize(txn.mvt) === 'production').length,
    totalProductsSold: transactions.reduce((sum, txn) => sum + toNumber(txn.totalProducts), 0)
  };
}

export function groupByCustomer(transactions: TransactionRecord[]): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();

  for (const txn of transactions) {
    const key = String(txn.customerName || 'UNKNOWN').toUpperCase();
    const existing = map.get(key) || {
      customerName: key,
      count: 0,
      revenue: 0,
      products: 0,
      items: []
    };

    existing.count += 1;
    existing.revenue += toNumber(txn.revenue || txn.totalAmount || txn.grossAmount);
    existing.products += toNumber(txn.totalProducts);
    existing.items.push(txn);

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function groupByMonth(transactions: TransactionRecord[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();

  for (const txn of transactions) {
    const date = getTxnDate(txn);
    if (!date) continue;

    const month = MONTH_ORDER[date.getMonth()];
    const year = String(date.getFullYear());
    const key = `${month} ${year}`;

    const existing = map.get(key) || {
      name: key,
      revenue: 0,
      products: 0,
      count: 0
    };

    existing.revenue += toNumber(txn.revenue || txn.totalAmount || txn.grossAmount);
    existing.products += toNumber(txn.totalProducts);
    existing.count += 1;

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    const [am, ay] = a.name.split(' ');
    const [bm, by] = b.name.split(' ');
    if (ay !== by) return Number(ay) - Number(by);
    return monthIndex(am) - monthIndex(bm);
  });
}

export function getUniqueCustomers(transactions: TransactionRecord[]) {
  return Array.from(
    new Set(
      transactions
        .map((txn) => String(txn.customerName || '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      label: name,
      value: name
    }));
}

export function getUniqueCashiers(transactions: TransactionRecord[]) {
  return Array.from(
    new Set(
      transactions
        .map((txn) => String(txn.cashier || '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      label: name,
      value: name
    }));
}

export function getUniqueMvts(transactions: TransactionRecord[]) {
  return Array.from(
    new Set(
      transactions
        .map((txn) => String(txn.mvt || '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      label: name,
      value: name
    }));
}