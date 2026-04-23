import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Receipt, Package, ShoppingCart } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, SaleItem } from '../types';

export default function Sales() {
  const { company, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!company) return;
    const ref = collection(db, 'companies', company.id, 'products');
    return onSnapshot(ref, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
  }, [company]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.itemId === product.id);
      if (existing) {
        return prev.map(item => 
          item.itemId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice } 
            : item
        );
      }
      return [...prev, {
        itemId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        discount: 0,
        total: product.price
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.itemId === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.15; // Example 15% tax
  const total = subtotal + tax;

  const handleCheckout = async (method: string) => {
    if (!company || cart.length === 0) return;
    setProcessing(true);
    
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Create Sale record
        const saleRef = collection(db, 'companies', company.id, 'sales');
        const saleId = `SALE-${Date.now()}`;
        
        const saleData = {
          transactionId: saleId,
          timestamp: serverTimestamp(),
          cashierId: user?.userName || 'System',
          items: cart,
          subtotal,
          tax,
          discountTotal: 0,
          grandTotal: total,
          payments: [{ method, amount: total, status: 'completed' }],
          status: 'completed',
          companyId: company.id
        };

        // 2. Update Stats (Atomic increment)
        const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
        transaction.set(statsRef, {
          totalSales: (await transaction.get(statsRef)).data()?.totalSales + 1 || 1,
          totalRevenue: (await transaction.get(statsRef)).data()?.totalRevenue + total || total
        }, { merge: true });

        // 3. Update Inventory (for each item)
        // This is a simplified example. In a real app, you'd loop and update each product's inventory doc.
        
        transaction.set(doc(saleRef), saleData);
      });

      setCart([]);
      alert('Transaction Completed Successfully');
    } catch (err) {
      console.error('Checkout failed:', err);
      alert('Checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-160px)] flex gap-6">
      {/* Products Selection */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search catalog by name or SKU..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-1">
          {filteredProducts.map(product => (
            <button 
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-blue-500/50 transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <div className="w-full aspect-square bg-slate-50 rounded-lg mb-2 flex items-center justify-center text-slate-300 group-hover:scale-[1.02] transition-transform">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">{product.name}</h3>
                <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">{product.sku || 'NO SKU'}</p>
              </div>
              <p className="text-lg font-black text-slate-900 mt-3">${product.price.toLocaleString()}</p>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-300 italic text-sm">
              No matches found.
            </div>
          )}
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
            <Receipt className="w-4 h-4 text-blue-600" />
            Current Order
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.itemId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate text-sm leading-tight">{item.name}</h4>
                <p className="text-slate-400 text-[11px]">${item.unitPrice.toLocaleString()} x {item.quantity}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded">
                <button onClick={() => updateQuantity(item.itemId, -1)} className="p-1 hover:bg-white rounded transition-colors">
                  <Minus className="w-3 h-3 text-slate-600" />
                </button>
                <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.itemId, 1)} className="p-1 hover:bg-white rounded transition-colors">
                  <Plus className="w-3 h-3 text-slate-600" />
                </button>
              </div>
              <div className="text-right min-w-[60px]">
                <p className="font-bold text-slate-800 text-sm">${item.total.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3 opacity-50">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-xs font-bold uppercase tracking-widest">Empty Cart</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex justify-between text-slate-500 text-xs font-medium">
            <span>Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs font-medium">
            <span>Tax (15%)</span>
            <span>${tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xl font-black text-slate-900 pt-2 mt-2 border-t border-dashed border-slate-300">
            <span>Total</span>
            <span>${total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button 
              disabled={cart.length === 0 || processing}
              onClick={() => handleCheckout('Cash')}
              className="flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-50"
            >
              <Banknote className="w-5 h-5" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Cash</span>
            </button>
            <button 
              disabled={cart.length === 0 || processing}
              onClick={() => handleCheckout('Card')}
              className="flex flex-col items-center gap-1.5 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
