import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, AlertTriangle, ArrowRight, Save, X } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { InventoryItem, Product } from '../types';

export default function Inventory() {
  const { company } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);

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

    return () => {
      unsubscribeInv();
      unsubscribeProd();
    };
  }, [company]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.productId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Inventory Monitor</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Track stock levels and reorder points for all catalog products.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button 
            onClick={() => setModalOpen(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Stock Adjustment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-red-500 p-2.5 rounded-lg text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Low Stock Alerts</div>
            <div className="text-lg font-black text-slate-900 leading-tight">3 Items</div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-emerald-500 p-2.5 rounded-lg text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total SKUs</div>
            <div className="text-lg font-black text-slate-900 leading-tight">{products.length} Products</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
          <div className="bg-blue-500 p-2.5 rounded-lg text-white">
            <Save className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Inventory Value</div>
            <div className="text-lg font-black text-slate-900 leading-tight">$42,500</div>
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
                <th className="px-6 py-3">Stock Level</th>
                <th className="px-6 py-3">Reorder Point</th>
                <th className="px-6 py-3">Unit Cost</th>
                <th className="px-6 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 leading-tight block">{item.name}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{item.productId}</td>
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
                  <td className="px-6 py-4 text-slate-400 text-[11px] font-medium">
                    {item.lastUpdated?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-400 italic">
                    No inventory records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
