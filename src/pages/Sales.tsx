import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Package,
  ShoppingCart,
  X,
  Save,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { InventoryItem } from '../types';
import { notify } from '../lib/toast';
import { AnimatePresence, motion } from 'motion/react';

type ReceiptItem = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export default function Sales() {
    const { company, user } = useAuth();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [cart, setCart] = useState<ReceiptItem[]>([]);
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [qtyInput, setQtyInput] = useState('');
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [newCustomerName, setNewCustomerName] = useState('');
    const [customers, setCustomers] = useState<{ id: string; customerName: string }[]>([]);

    useEffect(() => {
      if (!company) return;
      const ref = collection(db, 'companies', company.id, 'inventory');
      return onSnapshot(ref, (snap) => {
        setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
      });
    }, [company]);

    useEffect(() => {
      if (!company) return;

      const customersRef = collection(db, 'companies', company.id, 'customers');
      const unsubscribeCustomers = onSnapshot(customersRef, (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          customerName: String(d.data().customerName || 'Unnamed')
        }));
        setCustomers(list);
      });

      return () => {
        unsubscribeCustomers();
      };
    }, [company]);

    const filteredInventory = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return inventory;
      return inventory.filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.productId?.toLowerCase().includes(q)
      );
    }, [inventory, search]);

    const subtotal = useMemo(() => {
      return cart.reduce((sum, item) => sum + item.total, 0);
    }, [cart]);

    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const openQuantityDialog = (item: InventoryItem) => {
      setSelectedItem(item);
      setQtyInput('1');
    };

    const addToCart = () => {
      if (!selectedItem) return;
      const qty = Math.max(1, Number(qtyInput || 1));

      if (qty > selectedItem.quantity) {
        notify.error('Item quantity is too low');
        return;
      }

      setCart(prev => {
        const existing = prev.find(i => i.itemId === selectedItem.id);
        if (existing) {
          const newQty = existing.quantity + qty;
          if (newQty > selectedItem.quantity) return prev;

          return prev.map(i =>
            i.itemId === selectedItem.id
              ? {
                  ...i,
                  quantity: newQty,
                  total: newQty * i.unitPrice
                }
              : i
          );
        }

        return [
          ...prev,
          {
            itemId: selectedItem.id,
            name: selectedItem.name,
            quantity: qty,
            unitPrice: Number(selectedItem.sellingPrice || 0),
            total: qty * Number(selectedItem.sellingPrice || 0)
          }
        ];
      });

      setSelectedItem(null);
      setQtyInput('');
    };

    const removeCartItem = (itemId: string) => {
      setCart(prev => prev.filter(item => item.itemId !== itemId));
    };

    const changeCartQty = (itemId: string, delta: number) => {
      const item = cart.find(i => i.itemId === itemId);
      if (!item) return;

      const inventoryItem = inventory.find(i => i.id === itemId);
      if (!inventoryItem) return;

      const nextQty = item.quantity + delta;
      if (nextQty < 1) return;
      if (nextQty > Number(inventoryItem.quantity)) return;

      setCart(prev =>
        prev.map(i =>
          i.itemId === itemId
            ? { ...i, quantity: nextQty, total: nextQty * i.unitPrice }
            : i
        )
      );
    };

    const clearReceipt = () => setCart([]);

  const handleSaveSale = async () => {
    if (!company || cart.length === 0) return;
    setProcessing(true);
    notify.success("Saving transaction...");

    try {
      const saleId = Math.random().toString(36).slice(2, 12).toUpperCase();
      const year = new Date().getFullYear().toString();
      const month = new Date().toLocaleString('default', { month: 'long' });

      const customerName =
        selectedCustomer === 'OTHER'
          ? newCustomerName.trim().toUpperCase()
          : customers.find((c) => c.id === selectedCustomer)?.customerName || '';

      const customerId =
        selectedCustomer === 'OTHER' && customerName
          ? customerName.replace(/\s+/g, '_')
          : selectedCustomer;

      await runTransaction(db, async (transaction) => {
        const inventoryRefs = cart.map(item =>
          doc(db, 'companies', company.id, 'inventory', item.itemId)
        );

        const transactionRef = doc(db, 'companies', company.id, 'transactions', saleId);
        const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
        const customerRef = customerName
          ? doc(db, 'companies', company.id, 'customers', customerId)
          : null;

        const inventorySnaps = await Promise.all(
          inventoryRefs.map(ref => transaction.get(ref))
        );

        const statsSnap = await transaction.get(statsRef);
        const customerSnap = customerRef ? await transaction.get(customerRef) : null;

        inventorySnaps.forEach((snap, i) => {
          if (!snap.exists()) throw new Error('Inventory item missing');

          const currentQty = Number(snap.data().quantity || 0);
          const soldQty = cart[i].quantity;

          if (soldQty > currentQty) {
            throw new Error(`Not enough stock for ${cart[i].name}`);
          }
        });

        const qtySold = cart.reduce((sum, item) => sum + item.quantity, 0);
        const grossAmount = cart.reduce((sum, item) => sum + item.total, 0);

        const revenue = inventorySnaps.reduce((sum, snap, i) => {
          const item = cart[i];
          const unitCost = Number(snap.data().unitCost || 0);
          const unitPrice = Number(item.unitPrice || 0);
          return sum + ((unitPrice - unitCost) * item.quantity);
        }, 0);

        const currentStats = statsSnap.exists() ? statsSnap.data() : {};

        const currentSoldPieces = Number(currentStats?.soldPieces?.[year]?.[month] || 0);
        const currentSoldAmount = Number(currentStats?.soldAmount?.[year]?.[month] || 0);
        const currentRevenue = Number(currentStats?.revenues?.[year]?.[month] || 0);

        const nextSoldPieces = {
          ...(currentStats?.soldPieces || {}),
          [year]: {
            ...(currentStats?.soldPieces?.[year] || {}),
            [month]: currentSoldPieces + qtySold
          }
        };

        const nextSoldAmount = {
          ...(currentStats?.soldAmount || {}),
          [year]: {
            ...(currentStats?.soldAmount?.[year] || {}),
            [month]: currentSoldAmount + grossAmount
          }
        };

        const nextRevenue = {
          ...(currentStats?.revenues || {}),
          [year]: {
            ...(currentStats?.revenues?.[year] || {}),
            [month]: currentRevenue + revenue
          }
        };

        const customerData = customerSnap?.exists() ? customerSnap.data() : {};
        const customerSoldPieces = Number(customerData?.soldPieces?.[year]?.[month] || 0);
        const customerSoldAmount = Number(customerData?.soldAmount?.[year]?.[month] || 0);
        const customerRevenue = Number(customerData?.revenues?.[year]?.[month] || 0);

        const nextCustomerSoldPieces = {
          ...(customerData?.soldPieces || {}),
          [year]: {
            ...(customerData?.soldPieces?.[year] || {}),
            [month]: customerSoldPieces + qtySold
          }
        };

        const nextCustomerSoldAmount = {
          ...(customerData?.soldAmount || {}),
          [year]: {
            ...(customerData?.soldAmount?.[year] || {}),
            [month]: customerSoldAmount + grossAmount
          }
        };

        const nextCustomerRevenue = {
          ...(customerData?.revenues || {}),
          [year]: {
            ...(customerData?.revenues?.[year] || {}),
            [month]: customerRevenue + revenue
          }
        };

        inventorySnaps.forEach((snap, i) => {
          const ref = inventoryRefs[i];
          const soldQty = cart[i].quantity;
          const unitCost = Number(snap.data().unitCost || 0);
          const unitPrice = Number(cart[i].unitPrice || 0);
          const itemRevenue = (unitPrice - unitCost) * soldQty;

          transaction.update(ref, {
            quantity: Number(snap.data().quantity || 0) - soldQty,
            lastUpdated: serverTimestamp(),
            [`soldPieces.${year}.${month}`]: increment(soldQty),
            [`soldAmount.${year}.${month}`]: increment(cart[i].total),
            [`revenues.${year}.${month}`]: increment(itemRevenue)
          });
        });

        transaction.set(transactionRef, {
          id: saleId,
          cashier: user?.userName || 'System',
          totalAmount: total,
          grossAmount,
          revenue,
          totalProducts: Number(qtySold),
          items: cart.map(item => item.name),
          customerId: customerId || '',
          customerName,
          status: 'completed',
          mvt: "Sales",
          dateCompleted: serverTimestamp()
        });

        transaction.set(
          statsRef,
          {
            soldPieces: nextSoldPieces,
            soldAmount: nextSoldAmount,
            revenues: nextRevenue
          },
          { merge: true }
        );

        if (customerRef && customerName) {
          transaction.set(
            customerRef,
            {
              customerName,
              dateAdded: customerData?.dateAdded || serverTimestamp(),
              soldPieces: nextCustomerSoldPieces,
              soldAmount: nextCustomerSoldAmount,
              revenues: nextCustomerRevenue
            },
            { merge: true }
          );
        }
      });

      setCart([]);
      setSelectedCustomer('');
      setNewCustomerName('');
      notify.success("Transaction completed.");
    } catch (err: any) {
      notify.error("We encountered a fatal error");
      console.error(err);
    } finally {
      setProcessing(false);
      setShowSaveConfirm(false);
    }
  };

  const canSave =
    cart.length > 0 &&
    !processing &&
    (
      (selectedCustomer !== '' && selectedCustomer !== "OTHER") ||
      (selectedCustomer === 'OTHER' && newCustomerName.trim() !== '')
    );

    return (
    <div className="h-[calc(100vh-160px)] flex gap-6">
      <div className="flex-1 flex flex-col min-w-0">

        <div className="mb-6 space-y-3">
          <div className="relative">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerName}
                </option>
              ))}
              <option value="OTHER">Other</option>
            </select>
          </div>

          {selectedCustomer === 'OTHER' && (
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Enter new customer name"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
            />
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search inventory by name or SKU..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-1">
          {filteredInventory.map(item => (
            <button
              key={item.id}
              onClick={() => openQuantityDialog(item)}
              disabled={Number(item.quantity) <= 0}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-blue-500/50 transition-all text-left flex flex-col justify-between group disabled:opacity-50"
            >
              <div>
                <div className="w-full aspect-square bg-slate-50 rounded-lg mb-2 flex items-center justify-center text-slate-300 group-hover:scale-[1.02] transition-transform">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">{item.name}</h3>
                <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">
                  QTY: {item.quantity}
                </p>
              </div>
              <p className="text-lg font-black text-slate-900 mt-3">
                ${(item.sellingPrice || 0).toLocaleString()}
              </p>
            </button>
          ))}

          {filteredInventory.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-300 italic text-sm">
              No matches found.
            </div>
          )}
        </div>
      </div>

      <div className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
            <Receipt className="w-4 h-4 text-blue-600" />
            Current Receipt
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.itemId} className="group flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate text-sm leading-tight">{item.name}</h4>
                <p className="text-slate-400 text-[11px]">
                  ${item.unitPrice.toLocaleString()} x {item.quantity}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded">
                <button
                  onClick={() => changeCartQty(item.itemId, -10)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <Minus className="w-3 h-3 text-slate-600" />
                </button>
                <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                <button
                  onClick={() => changeCartQty(item.itemId, 10)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <Plus className="w-3 h-3 text-slate-600" />
                </button>
              </div>

              <button
                onClick={() => removeCartItem(item.itemId)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3 opacity-50">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-xs font-bold uppercase tracking-widest">Empty Receipt</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex justify-between text-slate-500 text-xs font-medium">
            <span>Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs font-medium">
            <span>Tax (16%)</span>
            <span>${tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xl font-black text-slate-900 pt-2 mt-2 border-t border-dashed border-slate-300">
            <span>Total</span>
            <span>${total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={clearReceipt}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Clear</span>
            </button>

            <button
              disabled={!canSave}
              onClick={() => setShowSaveConfirm(true)}
              className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Save</span>
            </button>

          </div>

          <button
            disabled={cart.length === 0 || processing}
            className="w-full mt-3 flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span className="font-bold text-[10px] uppercase tracking-wider">Prompt Payment</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => {
                setSelectedItem(null);
                setQtyInput('');
              }}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Add Item</h3>
                  <p className="text-xs text-slate-500 font-medium tracking-tight">{selectedItem.name}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setQtyInput('');
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-sm text-slate-500 font-medium">
                  Available: <span className="font-bold text-slate-800">{selectedItem.quantity}</span>
                </div>

                <input
                  type="number"
                  min="1"
                  max={selectedItem.quantity}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Enter quantity"
                />

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setQtyInput('');
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addToCart}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaveConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => setShowSaveConfirm(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Confirm Save</h3>
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <p className="text-sm text-gray-600">
                  Save this transaction with total of <span className="font-bold text-gray-900">KES {total.toLocaleString()}</span>?
                </p>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(false)}
                    className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={async () => {
                      await handleSaveSale();
                    }}
                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Save'}
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