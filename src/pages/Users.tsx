import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Search, Shield, Activity, MoreVertical, X, Loader2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Users() {
  const { company, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    role: 'cashier' as UserRole,
    employeeId: '',
    password: ''
  });

  useEffect(() => {
    if (!company) return;
    const ref = collection(db, 'companies', company.id, 'users');
    return onSnapshot(ref, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as User)));
    });
  }, [company]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const name = String(u.userName || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const role = String(u.role || '').toLowerCase();
      const employeeId = String(u.employeeId || '').toLowerCase();
      const status = String(u.status || '').toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        employeeId.includes(q) ||
        status.includes(q)
      );
    });
  }, [users, search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !currentUser) return;
    setLoading(true);

    try {
      const uid = `USER-${Date.now()}`;

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

      await setDoc(doc(db, 'companies', company.id, 'users', uid), newUserData);
      await setDoc(doc(db, 'users', uid), { company: company.id });

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
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">User Management</h2>
          <p className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">
            Manage access and roles for your store team.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-95 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                <th className="px-6 py-3">User Details</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Employee ID</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 text-sm dark:divide-slate-800">
              {filteredUsers.map(u => (
                <tr key={u.uid} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-500/20 dark:group-hover:text-blue-300">
                        {u.userName?.[0] || '?'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{u.userName}</div>
                        <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      <span className="text-xs font-medium capitalize text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        u.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                      {u.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {u.employeeId || 'N/A'}
                  </td>

                  <td className="px-6 py-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {u.createdAt instanceof Object ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm italic text-slate-400 dark:text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Add Team Member</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl p-2 transition-colors hover:bg-gray-200 dark:hover:bg-slate-800"
                >
                  <X className="w-6 h-6 text-gray-400 dark:text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-6 p-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                      value={formData.userName}
                      onChange={e => setFormData({ ...formData, userName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Role</label>
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    >
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. jdoe@company.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-bold text-gray-700 dark:text-slate-300">Employee ID</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-001"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20"
                      value={formData.employeeId}
                      onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl px-6 py-3 font-bold text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-400"
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