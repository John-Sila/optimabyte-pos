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
    const unsubProd = onSnapshot(
      query(prodRef, orderBy('dateStarted', 'desc')),
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductionTxn)));
      }
    );

    const invRef = collection(db, 'companies', company.id, 'inventory');
    const unsubInv = onSnapshot(invRef, (snap) => {
      setInventoryItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
      );
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
    (
      selectedCustomer === 'WAREHOUSE' ||
      (selectedCustomer === 'OTHER' && newCustomerName.trim().length > 0)
    ) &&
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
    notify.success("Creating production batch...");
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

      notify.success("New job created");
      setShowNewJob(false);
      setSelectedItem('');
      setAmount('');
      setSelectedCustomer('');
      setNewCustomerName('');
    } catch (err: any) {
      notify.error("We encountered a fatal error");
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

  return (
    <div className="space-y-6 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Production Monitor</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">
            Batch processing and automated manufacturing runs.
          </p>
        </div>

        <button
          onClick={openNewJob}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 w-full">
        <div className="xl:col-span-4 space-y-4 w-full">
          <div className="flex items-center gap-6 pb-0 border-b border-slate-100">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-3 px-1 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                activeTab === 'active' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Active Batches
              {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-1 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                activeTab === 'history' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Historical Logs
              {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by item or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
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
                <tbody className="divide-y divide-slate-50 text-sm">
                  {(activeTab === 'active' ? activeJobs : historicalJobs)
                    .filter((job) => {
                      const q = search.toLowerCase();
                      return (
                        String(job.customerName || '').toLowerCase().includes(q) ||
                        String(job.items?.join(' ') || '').toLowerCase().includes(q)
                      );
                    })
                    .map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-slate-900 whitespace-nowrap">
                          {job.id.slice(0, 7)}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                          {job.cashier}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          <div className="flex flex-col leading-tight">
                            {job.items?.slice(0, 2).map((item, index) => (
                              <span key={index}>{item}</span>
                            ))}
                            {job.items && job.items.length > 2 && <span>...</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                          {job.customerName || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                              job.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}
                          >
                            {job.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-black whitespace-nowrap">
                          {job.totalProducts || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-medium whitespace-nowrap">
                          {job.dateStarted?.toDate?.().toLocaleString?.() || '-'}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap relative">
                          <button
                            onMouseEnter={() => setOpenMenuId(openMenuId === job.id ? null : job.id)}
                            onClick={() => setOpenMenuId(openMenuId === job.id ? null : job.id)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
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
                                className="absolute right-6 top-10 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                              >
                                {job.status !== 'Completed' && (
                                  <button
                                    onClick={() => {
                                      setConfirmJob(job);
                                      setConfirmType('complete');
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                    Mark as complete
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setConfirmJob(job);
                                    setConfirmType('delete');
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>


                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      </tr>
                    ))}

                  {((activeTab === 'active' ? activeJobs : historicalJobs).filter((job) => {
                    const q = search.toLowerCase();
                    return (
                      String(job.customerName || '').toLowerCase().includes(q) ||
                      String(job.items?.join(' ') || '').toLowerCase().includes(q)
                    );
                  }).length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-300 italic text-sm">
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
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">New Production Job</h3>
                <button onClick={() => setShowNewJob(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Item</label>
                  <select
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
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
                  <label className="text-sm font-bold text-gray-700 ml-1">Total Products</label>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Customer</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
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
                    <label className="text-sm font-bold text-gray-700 ml-1">New Customer Name</label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      placeholder="Enter customer name"
                    />
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewJob(false)}
                    className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={createProductionJob}
                    disabled={!canCreate}
                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Job'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* confirmation of creating a job/deleting */}
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
              className="relative w-full max-w-md rounded-3xl border border-white/30 bg-white/20 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none" />

              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      confirmType === 'delete'
                        ? 'bg-red-500/15 border-red-200/50 text-red-600'
                        : 'bg-emerald-500/15 border-emerald-200/50 text-emerald-600'
                    }`}
                  >
                    {confirmType === 'delete' ? <Trash2 className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {confirmType === 'delete' ? 'Delete transaction?' : 'Mark as complete?'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {confirmType === 'delete'
                        ? `This will permanently remove transaction #${confirmJob.id.slice(0, 7)}.`
                        : `This will complete transaction #${confirmJob.id.slice(0, 7)} and update inventory.`}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={confirmProcessing}
                    onClick={() => setConfirmType(null)}
                    className="px-4 py-2.5 rounded-xl border border-white/30 bg-white/20 text-slate-700 hover:bg-white/30 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
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
                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-60 ${
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
  );
}