import React, { useEffect, useMemo, useState } from 'react';
import {
  Factory,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Play,
  X,
  Trash2,
  Check,
  Search,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProductionJob } from '../types';
import { notify } from '../lib/toast';


type CustomerOption = { id: string; customerName: string };


type ProductionTxn = {
  id: string;
  cashier: string;
  totalAmount?: number;
  grossAmount?: number;
  revenue?: number;
  items?: string[];
  customerId?: string;
  customerName?: string;
  status: 'Incomplete' | 'Completed' | string;
  mvt?: string;
  totalProducts?: number;
  dateStarted?: any;
  dateCompleted?: any;
  inventoryId?: string;
  inventoryName?: string;
};


export default function Production() {
  const { company, user } = useAuth();
  const [jobs, setJobs] = useState<ProductionTxn[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [search, setSearch] = useState('');
  const [showNewJob, setShowNewJob] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmType, setConfirmType] = useState<'complete' | 'delete' | null>(null);
  const [confirmJob, setConfirmJob] = useState<ProductionTxn | null>(null);
  const [confirmProcessing, setConfirmProcessing] = useState(false);


  useEffect(() => {
    if (!company) return;

    const prodRef = collection(db, 'companies', company.id, 'transactions');
    const unsubProd = onSnapshot(query(prodRef, orderBy('dateStarted', 'desc')), (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductionTxn)));
    });

    const invRef = collection(db, 'companies', company.id, 'inventory');
    const unsubInv = onSnapshot(invRef, (snap) => {
      setInventoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const custRef = collection(db, 'companies', company.id, 'customers');
    const unsubCust = onSnapshot(custRef, (snap) => {
      setCustomers(
        snap.docs.map((d) => ({
          id: d.id,
          customerName: String(d.data().customerName || '')
        }))
      );
    });

    return () => {
      unsubProd();
      unsubInv();
      unsubCust();
    };
  }, [company]);


  const activeJobs = jobs.filter((job) => job.status === 'Incomplete' && (job.mvt || 'Production') === 'Production');
  const historicalJobs = jobs.filter((job) => job.status === 'Completed' && (job.mvt || 'Production') === 'Production');


  const canCreate =
    !!selectedItem &&
    !!amount &&
    Number(amount) > 0 &&
    selectedCustomer !== '' &&
    (selectedCustomer !== 'OTHER' || newCustomerName.trim().length > 0) &&
    !processing;


  const openNewJob = () => {
    setShowNewJob(true);
    setSelectedItem('');
    setAmount('');
    setSelectedCustomer('');
    setNewCustomerName('');
  };


  const createProductionJob = async () => {
    if (!company || !canCreate) return;

    setProcessing(true);
    const loader = notify.loading('Creating production batch...');
    try {
      const saleId = Math.random().toString(36).slice(2, 12).toUpperCase();
      const item = inventoryItems.find((x) => x.id === selectedItem);
      if (!item) throw new Error('Inventory item not found');

      const customerName =
        selectedCustomer === 'OTHER'
          ? newCustomerName.trim().toUpperCase()
          : 'WAREHOUSE';

      const customerId =
        selectedCustomer === 'OTHER'
          ? customerName.replace(/\s+/g, '_')
          : 'WAREHOUSE';

      const jobRef = doc(db, 'companies', company.id, 'transactions', saleId);

      await setDoc(jobRef, {
        id: saleId,
        cashier: user?.userName || 'System',
        totalAmount: 0,
        grossAmount: 0,
        revenue: 0,
        items: [item.name],
        customerName,
        status: 'Incomplete',
        mvt: 'Production',
        totalProducts: Number(amount),
        dateStarted: serverTimestamp(),
        dateCompleted: serverTimestamp(),
        inventoryId: item.id,
        inventoryName: item.name,
      });

      if (selectedCustomer === 'OTHER' && customerName) {
        const customerRef = doc(db, 'companies', company.id, 'customers', customerId);
        await setDoc(
          customerRef,
          {
            customerName,
            dateAdded: serverTimestamp()
          },
          { merge: true }
        );
      }

      notify.dismiss(loader);
      notify.success('New job created');
      setShowNewJob(false);
      setSelectedItem('');
      setAmount('');
      setSelectedCustomer('');
      setNewCustomerName('');
    } catch (err: any) {
      notify.dismiss(loader);
      notify.error('We encountered a fatal error');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };


  const completeJob = async (job: ProductionTxn): Promise<void> => {
    if (!company || !job.id) return;

    try {
      const invId = String((job as any).inventoryId || '');
      if (!invId) throw new Error('Inventory item missing');

      const invRef = doc(db, 'companies', company.id, 'inventory', invId);
      const jobRef = doc(db, 'companies', company.id, 'transactions', job.id);

      await runTransaction(db, async (transaction) => {
        const invSnap = await transaction.get(invRef);
        if (!invSnap.exists()) throw new Error('Inventory item missing');

        const currentQty = Number(invSnap.data().quantity || 0);
        const addQty = Number(job.totalProducts || 0);

        transaction.update(invRef, {
          quantity: currentQty + addQty,
          lastUpdated: serverTimestamp()
        });

        transaction.update(jobRef, {
          status: 'Completed',
          dateCompleted: serverTimestamp()
        });
      });

      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };


  const deleteJob = async (jobId: string): Promise<void> => {
    if (!company || !jobId) return;

    try {
      await deleteDoc(doc(db, 'companies', company.id, 'transactions', jobId));
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };


  const getInventoryItemPhoto = (inventoryId?: string) => {
    if (!inventoryId) return null;
    const item = inventoryItems.find((i) => i.id === inventoryId);
    return item?.photoURL || null;
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: 'easeOut',
      }}
      className="h-full"
    >
      <div className="h-full space-y-6 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              Production Monitor
            </h2>
            <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
              Batch processing and automated manufacturing runs.
            </p>
          </div>

          <button
            onClick={openNewJob}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm shadow-blue-500/20 transition-all active:scale-95 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-4 w-full space-y-4">
            <div className="flex items-center gap-6 border-b border-slate-100 pb-0 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('active')}
                className={`relative px-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Active Batches
                {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`relative px-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'history' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Historical Logs
                {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
              </button>
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by item or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                      <th className="px-6 py-3">T-ID</th>
                      <th className="px-6 py-3">Cashier</th>
                      <th className="px-6 py-3">Items</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Total Products</th>
                      <th className="px-6 py-3">Date Started</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm dark:divide-slate-800">
                    {(activeTab === 'active' ? activeJobs : historicalJobs)
                      .filter((job) => {
                        const q = search.toLowerCase();
                        return (
                          String(job.customerName || '').toLowerCase().includes(q) ||
                          String(job.items?.join(' ') || '').toLowerCase().includes(q)
                        );
                      })
                      .map((job) => {
                        const photoUrl = getInventoryItemPhoto(job.inventoryId);

                        return (
                          <tr key={job.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-900 dark:text-slate-100">
                              {job.id.slice(0, 7)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
                              {job.cashier}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={job.inventoryName || 'Product'}
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                    <Factory className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  </div>
                                )}
                                <div className="flex flex-col leading-tight">
                                  {job.items?.slice(0, 2).map((item, index) => (
                                    <span key={index} className="font-medium text-slate-600 dark:text-slate-300">
                                      {item}
                                    </span>
                                  ))}
                                  {job.items && job.items.length > 2 && <span className="text-slate-400 dark:text-slate-500">...</span>}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
                              {job.customerName || '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                  job.status === 'Completed'
                                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300'
                                    : 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900/60 dark:bg-orange-500/10 dark:text-orange-300'
                                }`}
                              >
                                {job.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {job.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 font-black text-slate-900 dark:text-slate-100">
                              {job.totalProducts || '-'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                              {job.dateStarted?.toDate?.().toLocaleString?.() || '-'}
                            </td>
                            <td className="relative whitespace-nowrap px-6 py-4 text-right">
                              <button
                                type="button"
                                onMouseEnter={() => setOpenMenuId(openMenuId === job.id ? null : job.id)}
                                onClick={() => setOpenMenuId(openMenuId === job.id ? null : job.id)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              <AnimatePresence>
                                {openMenuId === job.id && (
                                  <motion.div
                                    onMouseLeave={() => setOpenMenuId(null)}
                                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-6 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
                                  >
                                    {job.status !== 'Completed' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmJob(job);
                                          setConfirmType('complete');
                                          setOpenMenuId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                      >
                                        <Check className="w-4 h-4" />
                                        Mark as complete
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmJob(job);
                                        setConfirmType('delete');
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-50 dark:border-slate-800 dark:hover:bg-red-500/10"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          </tr>
                        );
                      })}

                    {((activeTab === 'active' ? activeJobs : historicalJobs).filter((job) => {
                      const q = search.toLowerCase();
                      return (
                        String(job.customerName || '').toLowerCase().includes(q) ||
                        String(job.items?.join(' ') || '').toLowerCase().includes(q)
                      );
                    }).length === 0) && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-sm italic text-slate-300 dark:text-slate-500">
                          No production jobs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showNewJob && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                onClick={() => setShowNewJob(false)}
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/40">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">New Production Job</h3>
                  <button
                    onClick={() => setShowNewJob(false)}
                    className="rounded-xl p-2 transition-colors hover:bg-gray-200 dark:hover:bg-slate-800"
                  >
                    <X className="w-6 h-6 text-gray-400 dark:text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6 p-8">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Item</label>
                    <select
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                    >
                      <option value="">Select item</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Total Products</label>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                      placeholder="Enter quantity"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Customer</label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                    >
                      <option value="">Select customer</option>
                      <option value="WAREHOUSE">WAREHOUSE</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.customerName}
                        </option>
                      ))}
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>

                  {selectedCustomer === 'OTHER' && (
                    <div className="space-y-1.5">
                      <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">New Customer Name</label>
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                        placeholder="Enter customer name"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewJob(false)}
                      className="rounded-xl px-6 py-3 font-bold text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={createProductionJob}
                      disabled={!canCreate}
                      className="flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-400"
                    >
                      {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Job'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmType && confirmJob && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
                onClick={() => !confirmProcessing && setConfirmType(null)}
              />

              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 18 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl border ${
                        confirmType === 'delete'
                          ? 'border-red-200 bg-red-500/15 text-red-600 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300'
                          : 'border-emerald-200 bg-emerald-500/15 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300'
                      }`}
                    >
                      {confirmType === 'delete' ? <Trash2 className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                        {confirmType === 'delete' ? 'Delete transaction?' : 'Mark as complete?'}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {confirmType === 'delete'
                          ? `This will permanently remove transaction ${confirmJob.id.slice(0, 7)}.`
                          : `This will complete transaction ${confirmJob.id.slice(0, 7)} and update inventory.`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={confirmProcessing}
                      onClick={() => setConfirmType(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={confirmProcessing}
                      onClick={async () => {
                        if (!confirmJob) return;
                        setConfirmProcessing(true);
                        try {
                          if (confirmType === 'complete') {
                            await completeJob(confirmJob);
                          } else if (confirmType === 'delete') {
                            await deleteJob(confirmJob.id);
                          }
                          setConfirmType(null);
                          setConfirmJob(null);
                        } finally {
                          setConfirmProcessing(false);
                        }
                      }}
                      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-60 ${
                        confirmType === 'delete'
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {confirmProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : confirmType === 'delete' ? (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Confirm
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}