/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, CheckCircle, XCircle, AlertCircle, Search, Filter, MessageSquare, ExternalLink, Calendar, Trash2
} from 'lucide-react';

interface TelegramLog {
  id: string;
  scheduleId?: string | null;
  templateId?: string | null;
  recipientId?: string | null;
  chatId: string;
  alertType: string;
  messageText: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  sentAt: string;
}

export default function TelegramLogsView() {
  const [logs, setLogs] = useState<TelegramLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeLog, setActiveLog] = useState<TelegramLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram-logs');
      const data = await res.json();
      // Sort logs newest first
      const sorted = Array.isArray(data) 
        ? data.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        : [];
      setLogs(sorted);
    } catch (e) {
      console.error('Failed fetching telegram dispatch logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.alertType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.chatId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.messageText.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            Telegram Dispatch Auditing History Logs
          </h4>
          <span className="text-[11px] text-slate-400">Review every attempted and scheduled transmission, delivery metrics, automatic retry results, and technical server API responses.</span>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search on message content, destination chat, or alert types..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-150 rounded-xl p-2.5 pl-10 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Filter size={13} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-600 font-semibold"
          >
            <option value="all">All Delivery Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed / Connection issue</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Logs List Table */}
        <div className="lg:col-span-2 bg-white border border-slate-150/70 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-55/40 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-100">
                  <th className="p-3 pl-4">Delivery Status</th>
                  <th className="p-3">Alert Trigger Type</th>
                  <th className="p-3">Target Telegram Chat ID</th>
                  <th className="p-3">Sent Timestamp</th>
                  <th className="p-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Syncing audit histories...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No matching transmission histories found inside database records.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      onClick={() => setActiveLog(log)}
                      className={`hover:bg-slate-50/50 cursor-pointer transition ${
                        activeLog?.id === log.id ? 'bg-indigo-50/20 font-medium' : ''
                      }`}
                    >
                      <td className="p-3 pl-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                          log.status === 'SUCCESS' 
                            ? 'bg-emerald-50 text-emerald-800' 
                            : 'bg-rose-50 text-rose-800'
                        }`}>
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle size={10} className="text-emerald-700" />
                          ) : (
                            <XCircle size={10} className="text-rose-700" />
                          )}
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {log.alertType}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">
                        {log.chatId}
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <span className="text-[10px] text-indigo-600 font-bold hover:underline">
                          View details
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Message Drawer Window */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-4 self-start">
          <h5 className="font-bold text-slate-800 text-[13px] border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <MessageSquare size={14} className="text-slate-500" />
            Live Delivery Inspector Inspector Window
          </h5>

          {activeLog ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-2.5 bg-white border border-slate-150 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block">Logging Reference ID:</span>
                  <span className="font-mono font-bold text-slate-700">{activeLog.id}</span>
                </div>
                {activeLog.scheduleId && (
                  <div>
                    <span className="text-[10px] text-slate-400 block">Triggering Schedule Key:</span>
                    <span className="font-mono text-amber-700 font-bold">{activeLog.scheduleId}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 block">Chat Target:</span>
                  <span className="font-mono text-indigo-700 font-bold">{activeLog.chatId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Parsed Timestamp:</span>
                  <strong className="text-slate-700 font-medium">{new Date(activeLog.sentAt).toLocaleString()}</strong>
                </div>
              </div>

              {activeLog.errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-rose-850 flex items-center gap-1">
                    <AlertCircle size={11} />
                    API Error Details
                  </span>
                  <p className="font-mono text-[10px] text-rose-700 leading-tight">
                    {activeLog.errorMessage}
                  </p>
                </div>
              )}

              {/* Message Payload Body View */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Outbound Payload Message Text preview</span>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] whitespace-pre-wrap overflow-x-auto max-h-[300px] leading-relaxed border border-slate-850">
                  {activeLog.messageText || '(Empty message payload content)'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select a message record on the left to inspect its dynamic template formatting variables and delivery statuses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
