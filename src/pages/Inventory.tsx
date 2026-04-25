import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, AlertTriangle, Save, X, EllipsisVertical, Trash2, CirclePlus } from 'lucide-react';
import { collection, onSnapshot, where, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { InventoryItem, Product } from '../types';
import { notify } from '../lib/toast';
import { AnimatePresence, motion } from 'motion/react';

type InventoryFormState = {
  name: string;
  productId: string;
  isbn: string;
  quantity: string;
  reorderLevel: string;
  unitCost: string;
  sellingPrice: string;
};

export default function Inventory() {
  const { company, user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [stockModalItem, setStockModalItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockSupplier, setStockSupplier] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [stockProcessing, setStockProcessing] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; supplierName: string }[]>([]);
  const [form, setForm] = useState<InventoryFormState>({
    name: '',
    productId: '',
    isbn: '',
    quantity: '',
    reorderLevel: '',
    unitCost: '',
    sellingPrice: '',
  });

  useEffect(() => {
    if (!company) return;

    const inventoryRef = collection(db, 'companies', company.id, 'inventory');
    const unsubscribeInv = onSnapshot(query(inventoryRef, orderBy('lastUpdated', 'desc')), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });

    const productsRef = collection(db, 'companies', company.id, 'products');
    const unsubscribeProd = onSnapshot(productsRef, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const suppliersRef = collection(db, 'companies', company.id, 'suppliers');
    const unsubscribeSup = onSnapshot(suppliersRef, (snap) => {
      setSuppliers(
        snap.docs.map((d) => ({
          id: d.id,
          supplierName: String(d.data().supplierName || '')
        }))
      );
    });

    return () => {
      unsubscribeInv();
      unsubscribeProd();
      unsubscribeSup();
    };
  }, [company]);

  const filteredItems = search.trim()
    ? items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.productId.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const resetForm = () => {
    setForm({
      name: '',
      productId: '',
      isbn: '',
      quantity: '',
      reorderLevel: '',
      unitCost: '',
      sellingPrice: '',
    });
  };

  const handleOpenModal = () => {
    resetForm();
    setModalOpen(true);
    setOpenMenuId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    if (
      !form.name.trim() ||
      !form.productId.trim() ||
      !form.quantity.trim() ||
      !form.reorderLevel.trim() ||
      !form.sellingPrice.trim() ||
      !form.unitCost.trim()
    ) {
      notify.warning("You have missing fields")
      return
    };

    const name = form.name.trim().toLowerCase();
    const productId = form.productId.trim().toLowerCase();

    const inventoryRef = collection(db, 'companies', company.id, 'inventory');

    const duplicateQuery = query(
      inventoryRef,
      where('nameLower', '==', name)
    );

    const duplicateIdQuery = query(
      inventoryRef,
      where('productIdLower', '==', productId)
    );

    const [nameSnap, idSnap] = await Promise.all([
      getDocs(duplicateQuery),
      getDocs(duplicateIdQuery)
    ]);

    if (!nameSnap.empty || !idSnap.empty) {
      notify.error('This item seems to be added already.');
      return;
    }

    const newDocRef = doc(inventoryRef);

    await setDoc(newDocRef, {
      name: form.name.trim(),
      nameLower: name,
      productId: form.productId.trim(),
      productIdLower: productId,
      isbn: form.isbn.trim() || 'N/A',
      quantity: Number(form.quantity),
      reorderLevel: Number(form.reorderLevel),
      unitCost: Number(form.unitCost),
      sellingPrice: Number(form.sellingPrice),
      lastUpdated: serverTimestamp()
    });

    setModalOpen(false);
    notify.success(`${form.name.trim()} added successfully.`);
    resetForm();
  };

  const handleAddStock = async (itemId: string) => {
    if (!company) return;
    await updateDoc(doc(db, 'companies', company.id, 'inventory', itemId), {
      quantity: increment(1),
      lastUpdated: serverTimestamp()
    });
    setOpenMenuId(null);
  };

  const handleDelete = async (itemId: string) => {
    if (!company) return;
    await deleteDoc(doc(db, 'companies', company.id, 'inventory', itemId));
    setOpenMenuId(null);
  };

  const lowStockCount = items.filter(item => item.quantity < item.reorderLevel).length;

  const inventoryValue = items.reduce((total, item) => {
    return total + (Number(item.quantity) * Number(item.sellingPrice || 0));
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Inventory Monitor</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Track stock levels and reorder points for all catalog products.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleOpenModal}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Stock Adjustment
          </button>
        </div>
      </div>

      {/* summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-red-500 p-2.5 rounded-lg text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Low Stock Alerts</div>
            <div className="text-lg font-black text-slate-900 leading-tight">{lowStockCount} Items</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-emerald-500 p-2.5 rounded-lg text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total SKUs</div>
            <div className="text-lg font-black text-slate-900 leading-tight">{items.length} Products</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-blue-500 p-2.5 rounded-lg text-white">
            <Save className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Inventory Value</div>
            <div className="text-lg font-black text-slate-900 leading-tight">
              ${inventoryValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search inventory..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU / ID</th>
                <th className="px-6 py-3">ISBN</th>
                <th className="px-6 py-3">Stock Level</th>
                <th className="px-6 py-3">Reorder Point</th>
                <th className="px-6 py-3">Unit Cost</th>
                <th className="px-6 py-3">Selling Price</th>
                <th className="px-6 py-3">Last Updated</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 leading-tight block">{item.name}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{item.productId}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-[11px]">{item.isbn || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`font-black text-base ${item.quantity <= item.reorderLevel ? 'text-red-500' : 'text-slate-900'}`}>
                        {item.quantity}
                      </span>
                      <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.quantity <= item.reorderLevel ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (item.quantity / (item.reorderLevel * 2)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-400 text-[11px] uppercase tracking-wider">{item.reorderLevel} units</td>
                  <td className="px-6 py-4 text-slate-900 font-bold tracking-tight">${item.unitCost?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-900 font-bold tracking-tight">${item.sellingPrice?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-400 text-[11px] font-medium">
                    {item.lastUpdated?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 relative">
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onMouseEnter={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <EllipsisVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === item.id && (
                        <div className="absolute right-full top-0 mr-2 z-20 w-36 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" onMouseLeave={() => setOpenMenuId(null)}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setStockModalItem(item);
                              setStockQty('');
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <CirclePlus className="w-4 h-4" />
                            Add stock
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeleteConfirmItem(item);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete item
                          </button>
                        </div>
                      )}

                      <AnimatePresence>
                        {stockModalItem && (
                          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                              onClick={() => setStockModalItem(null)}
                            />

                            <motion.div
                              initial={{ scale: 0.95, opacity: 0, y: 20 }}
                              animate={{ scale: 1, opacity: 1, y: 0 }}
                              exit={{ scale: 0.95, opacity: 0, y: 20 }}
                              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
                            >
                              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Add Stock</h3>
                                  <p className="text-xs text-slate-500 font-medium tracking-tight">
                                    {stockModalItem.name}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setStockModalItem(null)}
                                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                            <form
                              className="p-6 space-y-4"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!company || !stockModalItem || !stockQty.trim() || !stockSupplier) return;

                                const qty = Number(stockQty);
                                if (!qty || qty < 1) return;

                                try {
                                  setStockProcessing(true);

                                  const supplierName =
                                    stockSupplier === 'OTHER'
                                      ? newSupplierName.trim().toUpperCase()
                                      : (suppliers.find((s) => s.id === stockSupplier)?.supplierName || '').toUpperCase();

                                  if (!supplierName) return;

                                  const supplierId =
                                    stockSupplier === 'OTHER'
                                      ? supplierName.replace(/\s+/g, '_')
                                      : stockSupplier;

                                  const txId = Math.random().toString(36).slice(2, 12).toUpperCase();

                                  const invRef = doc(db, 'companies', company.id, 'inventory', stockModalItem.id);
                                  const txRef = doc(db, 'companies', company.id, 'transactions', txId);

                                  await updateDoc(invRef, {
                                    quantity: increment(qty),
                                    lastUpdated: serverTimestamp()
                                  });

                                  await setDoc(txRef, {
                                    id: txId,
                                    cashier: user?.userName || 'System',
                                    totalAmount: 0,
                                    grossAmount: 0,
                                    revenue: 0,
                                    items: [stockModalItem.name],
                                    customerId: supplierId,
                                    customerName: supplierName,
                                    status: 'completed',
                                    mvt: 'Purchases',
                                    totalProducts: qty,
                                    dateCompleted: serverTimestamp(),
                                  });

                                  if (stockSupplier === 'OTHER') {
                                    await setDoc(
                                      doc(db, 'companies', company.id, 'suppliers', supplierId),
                                      {
                                        supplierName,
                                        dateAdded: serverTimestamp()
                                      },
                                      { merge: true }
                                    );
                                  }

                                  setStockModalItem(null);
                                  setStockQty('');
                                  setStockSupplier('');
                                  setNewSupplierName('');
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setStockProcessing(false);
                                }
                              }}
                            >
                              <input
                                type="number"
                                min="1"
                                value={stockQty}
                                onChange={(e) => setStockQty(e.target.value)}
                                placeholder="Enter quantity to add"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                                required
                              />

                              <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Supplier</label>
                                <select
                                  value={stockSupplier}
                                  onChange={(e) => setStockSupplier(e.target.value)}
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                                  required
                                >
                                  <option value="">Select supplier</option>
                                  {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                      {supplier.supplierName}
                                    </option>
                                  ))}
                                  <option value="OTHER">OTHER</option>
                                </select>
                              </div>

                              {stockSupplier === 'OTHER' && (
                                <div className="space-y-1.5">
                                  <label className="text-sm font-bold text-slate-700 ml-1">New Supplier Name</label>
                                  <input
                                    type="text"
                                    value={newSupplierName}
                                    onChange={(e) => setNewSupplierName(e.target.value)}
                                    placeholder="Enter supplier name"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                                    required
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setStockModalItem(null)}
                                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={stockProcessing}
                                  className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-60"
                                >
                                  <Save className="w-4 h-4" />
                                  {stockProcessing ? 'Processing...' : 'Add Quantity'}
                                </button>
                              </div>
                            </form>

                            </motion.div>
                          </div>
                        )}
                      </AnimatePresence>

                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center text-gray-400 italic">
                    No inventory records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    {/* add inventory item */}
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Add Inventory Item</h3>
                <p className="text-xs text-slate-500 font-medium tracking-tight">
                  Fill in all required fields to create a new stock record.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Product Name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="SKU / Product ID"
                  value={form.productId}
                  onChange={(e) => setForm(prev => ({ ...prev, productId: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="ISBN (optional)"
                  value={form.isbn}
                  onChange={(e) => setForm(prev => ({ ...prev, isbn: e.target.value }))}
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Quantity"
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Reorder Level"
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={(e) => setForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Unit Cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm(prev => ({ ...prev, unitCost: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Selling Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  Save Item
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* delete inventory item */}
    <AnimatePresence>
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirmItem(null)}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Delete Item</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Are you sure you want to delete <span className="font-bold text-slate-700">{deleteConfirmItem.name}</span>?
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!company || !deleteConfirmItem) return;
                  await deleteDoc(doc(db, 'companies', company.id, 'inventory', deleteConfirmItem.id));
                  setDeleteConfirmItem(null);
                }}
                className="bg-red-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-sm active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    </div>
  );
}