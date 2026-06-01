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
  increment
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
    return () => unsubscribeCustomers();
  }, [company]);


  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();

    return inventory
      .filter((item) => {
        const category = item.category || 'Sales';
        return category === 'Sales';
      })
      .filter((item) => {
        if (!q) return true;
        return (
          item.name?.toLowerCase().includes(q) ||
          item.productId?.toLowerCase().includes(q)
        );
      });
  }, [inventory, search]);


  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart]
  );


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
            ? { ...i, quantity: newQty, total: newQty * i.unitPrice }
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
    notify.success('Saving transaction...');

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
          mvt: 'Sales',
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
      notify.success('Transaction completed.');
    } catch (err: any) {
      notify.error('We encountered a fatal error');
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
      (selectedCustomer !== '' && selectedCustomer !== 'OTHER') ||
      (selectedCustomer === 'OTHER' && newCustomerName.trim() !== '')
    );


  return (
    <div className="h-screen flex gap-6 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="mb-6 space-y-3">
          <div className="relative">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border bg-white text-slate-900 border-slate-200 shadow-sm outline-none transition-all text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
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
              className="w-full px-4 py-3 rounded-xl border bg-white text-slate-900 border-slate-200 shadow-sm outline-none transition-all text-sm font-medium placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search inventory by name or SKU..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border bg-white text-slate-900 border-slate-200 shadow-sm outline-none transition-all text-sm font-medium placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="h-full overflow-y-auto grid auto-rows-max grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-1 content-start">
          {filteredInventory.map(item => (
            <button
              key={item.id}
              onClick={() => openQuantityDialog(item)}
              disabled={Number(item.quantity) <= 0}
              className="group flex flex-col justify-between rounded-2xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-400/50"
            >
              <div>
                <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-slate-50 text-slate-300 transition-transform group-hover:scale-[1.02] dark:bg-slate-800 dark:text-slate-500 overflow-hidden">
                  {item.photoURL ? (
                    <img
                      src={item.photoURL}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8" />
                  )}
                </div>
                <h3 className="text-sm font-bold leading-tight text-slate-800 line-clamp-2 dark:text-slate-100">
                  {item.name}
                </h3>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  QTY: {item.quantity}
                </p>
              </div>
              <p className="mt-3 text-lg font-black text-slate-900 dark:text-slate-100">
                KES {Number(item.sellingPrice || 0).toLocaleString()}
              </p>
            </button>
          ))}

          {filteredInventory.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 italic text-sm dark:text-slate-500">
              No matches found.
            </div>
          )}
        </div>
      </div>

      <div className="w-80 shrink-0 flex flex-col h-full overflow-hidden rounded-2xl border bg-white shadow-sm border-slate-200 dark:bg-slate-900 dark:border-slate-800">

        {/* Header / Identity Layer */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">

          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Current Receipt
          </h2>

          {/* Customer Context (Reactive Identity Layer) */}
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Customer:
            </span>{' '}

            {selectedCustomer === '' && (
              <span className="italic text-slate-400">Not selected</span>
            )}

            {selectedCustomer && selectedCustomer !== 'OTHER' && (
              <span className="text-slate-700 dark:text-slate-200">
                {customers.find(c => c.id === selectedCustomer)?.customerName || 'Unknown'}
              </span>
            )}

            {selectedCustomer === 'OTHER' && (
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {newCustomerName?.trim() || 'Typing new customer...'}
              </span>
            )}
          </div>
        </div>

        {/* Items Layer */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {cart.map(item => (
            <div
              key={item.itemId}
              className="group flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-950/30"
            >

              {/* Item Info */}
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {item.name}
                </h4>

                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  KES {item.unitPrice.toLocaleString()} × {item.quantity}
                </p>
              </div>

              {/* Quantity Control */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">

                <button
                  onClick={() => changeCartQty(item.itemId, -1)}
                  className="rounded-md p-1 hover:bg-white dark:hover:bg-slate-700"
                >
                  <Minus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                </button>

                <span className="w-6 text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                  {item.quantity}
                </span>

                <button
                  onClick={() => changeCartQty(item.itemId, 1)}
                  className="rounded-md p-1 hover:bg-white dark:hover:bg-slate-700"
                >
                  <Plus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                </button>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeCartItem(item.itemId)}
                className="opacity-40 hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 dark:hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center space-y-3 text-slate-300 opacity-60 dark:text-slate-600">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Empty Receipt
              </p>
            </div>
          )}
        </div>

        {/* Financial Summary Layer */}
        <div className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-2 dark:border-slate-800 dark:bg-slate-950/40">

          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tax (16%)</span>
            <span>KES {tax.toLocaleString()}</span>
          </div>

          <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 text-lg font-black text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <span>Total</span>
            <span>KES {total.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions Layer */}
        <div className="border-t border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">

          <div className="grid grid-cols-2 gap-3">

            <button
              onClick={clearReceipt}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold uppercase tracking-wider text-slate-700 transition-all hover:border-slate-300 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>

            <button
              disabled={!canSave}
              onClick={() => setShowSaveConfirm(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save
            </button>

          </div>

          <button
            disabled={cart.length === 0 || processing}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold uppercase tracking-wider transition-all hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:text-blue-400"
          >
            <Sparkles className="w-4 h-4" />
            Prompt Payment
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
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
            >
              {/* Escape key listener wrapper */}
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSelectedItem(null);
                    setQtyInput('');
                  }
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">Add Item</h3>
                    <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">{selectedItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setQtyInput('');
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form wrapper catches Enter key naturally */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addToCart();
                  }}
                  className="space-y-4 p-6"
                >
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Available: <span className="font-bold text-slate-800 dark:text-slate-100">{selectedItem.quantity}</span>
                  </div>

                  <input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    // Blurs the input on scroll to prevent unexpected value changes
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="Enter quantity"
                    autoFocus
                  />

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(null);
                        setQtyInput('');
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      Add
                    </button>
                  </div>
                </form>
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
              className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirm Save</h3>
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  className="rounded-xl p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6 p-8">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Save this transaction with total of{' '}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    KES {total.toLocaleString()}
                  </span>
                  ?
                </p>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(false)}
                    className="rounded-xl px-6 py-3 font-bold text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={async () => {
                      await handleSaveSale();
                    }}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:opacity-50"
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