import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';

export default function HolderLedger() {
  const { pushToast } = useNotifications();
  const [stats, setStats] = useState(null);
  const [due, setDue] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, dueRes, ledgerRes, paymentsRes] = await Promise.all([
        api.get('/ledger/my-stats'),
        api.get('/ledger/my-due'),
        api.get('/ledger/my-ledger'),
        api.get('/ledger/my-payments'),
      ]);

      setStats(statsRes.data);
      setDue(dueRes.data);
      setLedger(ledgerRes.data);
      setPayments(paymentsRes.data);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN');

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">My Earnings</h1>
        <p className="text-sm text-slate-500">Track your order earnings and payments</p>
      </div>

      {/* Stats Cards - Compact 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Orders</p>
          <p className="text-xl font-bold text-emerald-900 mt-1.5">{stats?.totalTransactions || 0}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-brand-50 to-brand-100 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">To Be Received</p>
          <p className="text-xl font-bold text-brand-900 mt-1.5">{formatCurrency(stats?.totalEarnings)}</p>
          <p className="text-[10px] text-brand-600 mt-0.5">{stats?.totalTransactions || 0} orders</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-700">Received</p>
          <p className="text-xl font-bold text-purple-900 mt-1.5">{formatCurrency(stats?.totalPaid)}</p>
        </div>

        <div className={`rounded-xl border-2 p-4 ${
          (due?.due || 0) < 0 
            ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' 
            : 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200'
        }`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${(due?.due || 0) < 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {(due?.due || 0) < 0 ? 'Advance' : 'Due'}
          </p>
          <p className={`text-xl font-bold mt-1.5 ${(due?.due || 0) < 0 ? 'text-blue-900' : 'text-rose-900'}`}>
            {formatCurrency(Math.abs(due?.due || 0))}
          </p>
          <p className={`text-[10px] mt-0.5 ${(due?.due || 0) < 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {(due?.due || 0) < 0 ? 'You have advance' : 'Awaiting payment'}
          </p>
        </div>
      </div>

      {/* Compact Summary Box */}
      {due && due.due > 0 && (
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-rose-100">
                <span className="text-base">💰</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-900">Payment Due from Admin</h3>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Outstanding: <span className="font-bold">{formatCurrency(due?.due)}</span> from {stats?.totalTransactions || 0} orders
              </p>
              <p className="text-[10px] text-rose-600 mt-1">Contact admin for payment</p>
            </div>
          </div>
        </div>
      )}

      {due && due.due < 0 && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                <span className="text-base">💵</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-900">Advance Payment Received</h3>
              <p className="text-xs text-blue-700 mt-1">
                You have <span className="font-bold">{formatCurrency(Math.abs(due?.due))}</span> advance
              </p>
              <p className="text-[10px] text-blue-600 mt-1">Will be adjusted in next orders</p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Details */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">Transaction History</h2>

        {(() => {
          // Combine ledger entries and payments
          const ledgerEntries = (ledger || []).map(e => ({
            ...e,
            entryType: 'order',
            date: e.createdAt,
          }));
          
          const paymentEntries = (payments || []).map(p => ({
            ...p,
            entryType: 'payment',
            date: p.paidAt || p.createdAt,
          }));
          
          const allEntries = [...ledgerEntries, ...paymentEntries].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          );

          if (allEntries.length === 0) {
            return (
              <div className="rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No transactions yet. Complete your first order!</p>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {allEntries.map((entry, idx) => {
                const isOrder = entry.entryType === 'order';
                const isPayment = entry.entryType === 'payment';
                
                return (
                  <div key={`${entry.entryType}-${entry._id}-${idx}`} className="rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isOrder ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {isOrder ? '📦 Order' : '💳 Payment'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(entry.date).toLocaleDateString('en-IN', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        
                        {isOrder && (
                          <div>
                            <p className="text-sm font-semibold text-slate-900 truncate">{entry.deal?.title || 'Order'}</p>
                            <p className="text-xs text-slate-600">{entry.deal?.platform || ''}</p>
                            <div className="mt-1.5 flex gap-2 text-[10px]">
                              <span className="text-slate-500">
                                Order: <strong>{formatCurrency((entry.amount || 0) - (entry.commission?.cardholderShare || 0))}</strong>
                              </span>
                              <span className="text-emerald-600">
                                + Fee: <strong>{formatCurrency(entry.commission?.cardholderShare || 0)}</strong>
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {isPayment && (
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{entry.paymentMethod}</p>
                            {entry.referenceId && (
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">Ref: {entry.referenceId}</p>
                            )}
                            {entry.notes && (
                              <p className="text-xs text-slate-600 mt-1 truncate">{entry.notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        {isOrder && (
                          <div>
                            <p className="text-[10px] text-slate-500">You'll Get</p>
                            <p className="text-base font-bold text-rose-600">
                              +{formatCurrency(entry.amount)}
                            </p>
                          </div>
                        )}
                        {isPayment && (
                          <div>
                            <p className="text-[10px] text-slate-500">Received</p>
                            <p className="text-base font-bold text-emerald-600">
                              -{formatCurrency(entry.amount)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
