import React, { useState, useEffect } from 'react';
import { Factory, Plus, Clock, CheckCircle2, AlertCircle, ChevronRight, Play } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProductionJob } from '../types';

export default function Production() {
  const { company } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);

  useEffect(() => {
    if (!company) return;
    const ref = collection(db, 'companies', company.id, 'production');
    return onSnapshot(query(ref, orderBy('createdAt', 'desc')), (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionJob)));
    });
  }, [company]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4 animate-pulse" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Production Monitor</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Batch processing and automated manufacturing runs.</p>
        </div>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center gap-6 pb-0 border-b border-slate-100">
            {['Active Batches', 'Historical Logs'].map((tab, i) => (
              <button 
                key={tab}
                className={`pb-3 px-1 text-[10px] font-black uppercase tracking-widest transition-all relative ${i === 0 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
                {i === 0 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {jobs.map(job => (
              <div 
                key={job.id} 
                className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow transition-shadow group flex items-center gap-5"
              >
                <div className="p-3 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <Factory className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">#{job.jobId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1 ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 truncate leading-tight">{job.product}</h3>
                  <p className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" />
                    Initiated {job.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </div>

                <div className="hidden md:block pr-6 border-r border-slate-100 text-right">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Output Target</div>
                  <div className="text-lg font-black text-slate-900 leading-none">{job.outputQuantity} <span className="text-[10px] font-bold text-slate-300 uppercase ml-0.5">qty</span></div>
                </div>

                <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-blue-600 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            {jobs.length === 0 && (
              <div className="bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
                <Factory className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No production jobs active</h3>
                <p className="text-gray-400">Start your first manufacturing batch to see progress here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-4">Capacity Overview</h3>
              <div className="space-y-4">
                {[
                  { label: 'Line A (Manual)', progress: 75 },
                  { label: 'Line B (Auto)', progress: 30 },
                  { label: 'Packaging', progress: 92 },
                ].map(line => (
                  <div key={line.label}>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-slate-400">
                      <span>{line.label}</span>
                      <span>{line.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${line.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Batch Start</h3>
            <div className="space-y-3">
              {['Standard Unit A', 'Deluxe Bundle B', 'Refill Pack'].map(p => (
                <button key={p} className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
                  <span className="font-bold text-gray-700">{p}</span>
                  <Play className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:fill-current" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
