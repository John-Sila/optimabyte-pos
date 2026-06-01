import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Save,
  X,
  EllipsisVertical,
  Trash2,
  CirclePlus,
  Loader2,
  Camera
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  servertimestamp,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { InventoryItem, Product } from '../types';
import notify from '../lib/toast';
import { AnimatePresence, motion } from 'motion/react';

type InventoryFormState = {
  name: string;
  productId: string;
  isbn: string;
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
  const [photoConfirmItem, setPhotoConfirmItem] = useState<InventoryItem | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockPrice, setStockPrice] = useState('');
  const [stockSupplier, setStockSupplier] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [stockProcessing, setStockProcessing] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; supplierName: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<InventoryFormState>({
    name: '',
    productId: '',
    isbn: '',
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
      !form.reorderLevel.trim() ||
      !form.sellingPrice.trim() ||
      !form.unitCost.trim()
    ) {
      notify.warning('You have missing fields');
      return;
    }
    if (Number(form.sellingPrice.trim()) < Number(form.unitCost.trim())) {
      notify.warning('You are selling at a loss');
      return;
    }

    setCreatingItem(true);

    const name = form.name.trim().toLowerCase();
    const productId = form.productId.trim().toLowerCase();
    const inventoryRef = collection(db, 'companies', company.id, 'inventory');

    const duplicateQuery = query(inventoryRef, where('nameLower', '==', name));
    const duplicateIdQuery = query(inventoryRef, where('productIdLower', '==', productId));

    const [nameSnap, idSnap] = await Promise.all([
      getDocs(duplicateQuery),
      getDocs(duplicateIdQuery)
    ]);

    if (!nameSnap.empty || !idSnap.empty) {
      notify.error('This item seems to be added already.');
      setCreatingItem(false);
      return;
    }

    const newDocRef = doc(inventoryRef);

    await setDoc(newDocRef, {
      name: form.name.trim(),
      nameLower: name,
      productId: form.productId.trim(),
      productIdLower: productId,
      isbn: form.isbn.trim() || 'N/A',
      quantity: Number(0),
      reorderLevel: Number(form.reorderLevel),
      unitCost: Number(form.unitCost),
      sellingPrice: Number(form.sellingPrice),
      lastUpdated: serverTimestamp()
    });

    setModalOpen(false);
    setCreatingItem(false);
    notify.success(`${form.name.trim()} added successfully.`);
    resetForm();
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setSelectedPhotoFile(file);
    setPhotoPreview(previewUrl);
  };

  const handleConfirmPhotoUpload = async () => {
    if (!selectedPhotoFile || !photoConfirmItem) return;

    await uploadPhoto(selectedPhotoFile, photoConfirmItem);
  };

  const handleCancelPhotoUpload = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview(null);
    setPhotoConfirmItem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (file: File, item: InventoryItem) => {
    if (!company) return;

    setUploadingPhoto(true);

    try {
      const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error("Cloudinary environment variables not configured");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Cloudinary error:", data);
        throw new Error(data?.error?.message || "Cloudinary upload failed");
      }

      const inventoryRef = doc(db, 'companies', company.id, 'inventory', item.id);
      await updateDoc(inventoryRef, {
        photoURL: data.secure_url,
        lastUpdated: serverTimestamp()
      });

      notify.success("Photo uploaded successfully");
      setOpenMenuId(null);
      handleCancelPhotoUpload();
    } catch (err) {
      console.error(err);
      notify.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const lowStockCount = items.filter(item => item.quantity < item.reorderLevel).length;

  const inventoryValue = items.reduce((total, item) => {
    return total + (Number(item.quantity) * Number(item.sellingPrice || 0));
  }, 0);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePhotoSelect}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            Inventory Monitor
          </h2>
          <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
            Track stock levels and reorder points for all catalog products.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            Stock Adjustment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg bg-red-500 p-2.5 text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Low Stock Alerts
            </div>
            <div className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
              {lowStockCount} Items
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg bg-emerald-500 p-2.5 text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Total SKUs
            </div>
            <div className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
              {items.length} Products
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg bg-blue-500 p-2.5 text-white">
            <Save className="w-5 h-5" />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Inventory Value
            </div>
            <div className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
              ${inventoryValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search inventory..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
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
            <tbody className="divide-y divide-slate-50 text-sm dark:divide-slate-800">
              {filteredItems.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.photoURL && (
                        <img
                          src={item.photoURL}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      <span className="block font-bold leading-tight text-slate-800 dark:text-slate-100">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {item.productId}
                  </td>
                  <td className="px-6 py-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {item.isbn || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-base font-black ${item.quantity <= item.reorderLevel ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.quantity}
                      </span>
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full ${item.quantity <= item.reorderLevel ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (item.quantity / (item.reorderLevel * 2)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {item.reorderLevel} units
                  </td>
                  <td className="px-6 py-4 font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    ${Number(item.unitCost || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    ${Number(item.sellingPrice || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {item.lastUpdated?.toDate().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="relative px-6 py-4">
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onMouseEnter={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <EllipsisVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === item.id && (
                        <div
                          className="absolute right-full top-0 z-20 mr-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setStockModalItem(item);
                              setStockQty('');
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <CirclePlus className="w-4 h-4" />
                            Add stock
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setPhotoConfirmItem(item);
                              setSelectedPhotoFile(null);
                              setPhotoPreview(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                              fileInputRef.current?.click();
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                          >
                            <Camera className="w-4 h-4" />
                            Add Photo
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeleteConfirmItem(item);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-50 dark:border-slate-800 dark:hover:bg-red-500/10 border-t border-slate-100 dark:border-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete item
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-20 text-center text-sm italic text-slate-400 dark:text-slate-500">
                    No inventory records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add Inventory Item Modal */}
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
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Add Inventory Item
                  </h3>
                  <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
                    Fill in all required fields to create a new stock record.
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="Product Name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="SKU / Product ID"
                    value={form.productId}
                    onChange={(e) => setForm(prev => ({ ...prev, productId: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="ISBN (optional)"
                    value={form.isbn}
                    onChange={(e) => setForm(prev => ({ ...prev, isbn: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="Reorder Level"
                    type="number"
                    min="0"
                    value={form.reorderLevel}
                    onChange={(e) => setForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                    placeholder="Unit Cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitCost}
                    onChange={(e) => setForm(prev => ({ ...prev, unitCost: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
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
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingItem}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    {creatingItem ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Item
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Inventory Item Modal */}
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
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Delete Item
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Are you sure you want to delete{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {deleteConfirmItem.name}
                    </span>
                    ?
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 p-6">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!company || !deleteConfirmItem) return;
                    await deleteDoc(doc(db, 'companies', company.id, 'inventory', deleteConfirmItem.id));
                    setDeleteConfirmItem(null);
                    notify.success('Item deleted successfully');
                  }}
                  className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Stock Modal */}
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
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Add Stock
                  </h3>
                  <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
                    {stockModalItem.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                className="space-y-4 p-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!company || !stockModalItem || !stockQty.trim() || !stockSupplier) return;

                  const qty = Number(stockQty);
                  if (!qty || qty < 1) return;

                  try {
                    setStockProcessing(true);
                    notify.success('Adding stock...');

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
                      totalAmount: Number(stockPrice),
                      grossAmount: Number(stockPrice),
                      revenue: 0,
                      items: [stockModalItem.name],
                      customerName: supplierName,
                      status: 'Completed',
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

                    notify.success('Process completed successfully');
                    setStockModalItem(null);
                    setStockQty('');
                    setStockPrice('');
                    setStockSupplier('');
                    setNewSupplierName('');
                  } catch (err) {
                    console.error(err);
                    notify.error('We encountered a fatal error');
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  required
                />

                <input
                  type="number"
                  min="1"
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  placeholder="Enter price"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  required
                />

                <div className="space-y-1.5">
                  <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                    Supplier
                  </label>
                  <select
                    value={stockSupplier}
                    onChange={(e) => setStockSupplier(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
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
                    <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                      New Supplier Name
                    </label>
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="Enter supplier name"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStockModalItem(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={stockProcessing}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
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

      {/* Photo Upload Confirmation Modal with Preview */}
      <AnimatePresence>
        {photoConfirmItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={handleCancelPhotoUpload}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                    {photoPreview ? 'Confirm Photo' : 'Add Photo'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {photoPreview
                      ? 'Review the photo below before uploading'
                      : `Select an image for ${photoConfirmItem.name}`}
                  </p>
                </div>
                <button
                  onClick={handleCancelPhotoUpload}
                  className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="p-6">
                {!photoPreview ? (
                  // State: No photo selected yet
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800">
                      <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm text-center text-slate-500 dark:text-slate-400">
                      Click below to select an image file (JPG, PNG, or WebP)
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <Camera className="w-4 h-4" />
                      Select Image
                    </button>
                  </div>
                ) : (
                  // State: Photo selected, show preview
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    <p className="text-sm text-center text-slate-500 dark:text-slate-400">
                      Is this the photo you want to use?
                    </p>
                    <div className="flex items-center gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhotoFile(null);
                          setPhotoPreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                          fileInputRef.current?.click();
                        }}
                        disabled={uploadingPhoto}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmPhotoUpload}
                        disabled={uploadingPhoto}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-95 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        {uploadingPhoto ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Upload
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 pt-0">
                <button
                  type="button"
                  onClick={handleCancelPhotoUpload}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}