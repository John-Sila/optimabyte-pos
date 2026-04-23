import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Shield, Activity, MoreVertical, X, Loader2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Users() {
  const { company, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    role: 'cashier' as UserRole,
    employeeId: '',
    password: '' // Note: In a real app, you'd handle password via server/admin SDK
  });

  useEffect(() => {
    if (!company) return;
    const ref = collection(db, 'companies', company.id, 'users');
    return onSnapshot(ref, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as User)));
    });
  }, [company]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !currentUser) return;
    setLoading(true);
    
    try {
      // NOTE: This is a frontend simulation. 
      // In production, this would call a Cloud Function to handle Auth + Firestore
      const uid = `USER-${Date.now()}`; // Simulating a new UID
      
      const newUserData: User = {
        uid,
        email: formData.email,
        userName: formData.userName,
        role: formData.role,
        status: 'active',
        employeeId: formData.employeeId,
        permissions: [],
        createdAt: serverTimestamp() as any,
        createdBy: currentUser.uid,
        lastLoginAt: null,
        companyId: company.id
      };

      // 1. Create user in companies/{id}/users/{uid}
      await setDoc(doc(db, 'companies', company.id, 'users', uid), newUserData);
      
      // 2. Create mapping in users/{uid}
      await setDoc(doc(db, 'users', uid), { company: company.id });
      
      // 3. Increment counters
      const statsRef = doc(db, 'companies', company.id, 'general', 'stats');
      await setDoc(statsRef, { noOfUsers: increment(1) }, { merge: true });

      setModalOpen(false);
      setFormData({ email: '', userName: '', role: 'cashier', employeeId: '', password: '' });
      alert('User created successfully (Simulated)');
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">User Management</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Manage access and roles for your store team.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search team..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-3">User Details</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Employee ID</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-xs">
                        {u.userName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.userName}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span className="capitalize font-medium text-slate-700 text-xs">{u.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      <Activity className="w-3 h-3" />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{u.employeeId || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-medium">
                    {u.createdAt instanceof Object ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
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
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Add Team Member</h3>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      value={formData.userName}
                      onChange={e => setFormData({...formData, userName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Role</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    >
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. jdoe@company.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Employee ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. EMP-001"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      value={formData.employeeId}
                      onChange={e => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
