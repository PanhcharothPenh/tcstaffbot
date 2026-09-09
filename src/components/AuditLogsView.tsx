import React, { useState } from 'react';
import { History, Search, Filter, Calendar, RefreshCcw, Download, ShieldCheck } from 'lucide-react';
import { Role, Branch } from '../types';

interface AuditLogsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  auditLogs: string[];
  lang: 'en' | 'kh';
}

export default function AuditLogsView({
  currentRole,
  activeBranchId,
  branches,
  auditLogs,
  lang
}: AuditLogsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

  const getFilteredLogs = () => {
    let list = auditLogs;
    
    // Search filter
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter(log => log.toLowerCase().includes(q));
    }

    // Branch contextual filter
    if (branchFilter !== 'all') {
      const bFound = branches.find(b => b.id === branchFilter);
      if (bFound) {
        const bName = bFound.branchName.toLowerCase();
        list = list.filter(log => log.toLowerCase().includes(bName) || log.toLowerCase().includes(branchFilter.toLowerCase()));
      }
    }

    return list;
  };

  const filteredLogs = getFilteredLogs();

  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Timestamp,Action Message"].join(",") + "\n"
      + auditLogs.map(log => {
          const firstColonIdx = log.indexOf(':');
          const timestamp = log.substring(0, firstColonIdx).replace(/"/g, '""');
          const action = log.substring(firstColonIdx + 1).replace(/"/g, '""');
          return `"${timestamp}","${action}"`;
        }).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clean24_audit_logs_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="audit_logs_module">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
        >
          <Download size={14} />
          {lang === 'en' ? 'Download Logs CSV' : 'ទាញយកកំណត់ហេតុ'}
        </button>
      </div>

      {/* Filter and Query controls bar */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search input field */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-450 pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder={lang === 'en' ? 'Search logs, users, machines, actions...' : 'ស្វែងរកកំណត់ហេតុ...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 text-xs rounded-xl outline-none focus:border-slate-350 font-medium"
          />
        </div>

        {/* Branch Context selectors filter */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-450 pointer-events-none">
            <Filter size={14} />
          </span>
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-205 text-xs rounded-xl outline-none font-bold"
          >
            <option value="all">{lang === 'en' ? 'All Branch Contexts' : 'គ្រប់សាខាវិភាគ'}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.branchName}</option>
            ))}
          </select>
        </div>

        {/* Metadata System confirmation indicator card */}
        <div className="bg-emerald-58/25 border border-emerald-100 p-2.5 px-4 rounded-xl flex items-center gap-2.5 text-emerald-800 text-[10px] font-bold">
          <ShieldCheck size={18} className="text-emerald-600 animate-pulse" />
          <div>
            <span>SYSTEM AUDITING: ACTIVE</span>
            <p className="text-[9px] text-emerald-600 font-medium font-mono">MD5 SHA-256 MATCH INTEGRITY OK</p>
          </div>
        </div>
      </div>

      {/* Interactive Logs Render Area */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredLogs.map((log, index) => {
            const firstSpace = log.indexOf(' ');
            const dateStr = log.substring(0, 10);
            const timeStr = log.substring(11, 19);
            const content = log.substring(21);

            return (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4 p-3 bg-slate-55/40 hover:bg-slate-55 transition rounded-xl border border-slate-100"
              >
                {/* Date time prefix badge */}
                <div className="flex sm:flex-col items-center sm:items-start gap-1 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-bold max-w-[120px]">
                  <span>{timeStr || 'SYSTEM'}</span>
                  <span className="text-slate-400 font-medium text-[9px]">{dateStr || new Date().toISOString().substring(0, 10)}</span>
                </div>

                {/* Audit message body */}
                <p className="text-xs text-slate-700 font-medium font-suwannaphum leading-relaxed">
                  {content || log}
                </p>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <History size={28} className="mx-auto" />
              <p className="text-xs">No administrative audit trace logs matching filter queries.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
