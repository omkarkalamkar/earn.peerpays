import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';

export default function BookerLedger() {
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
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Transaction Ledger</h1>
        <p className="text-sm text-slate-500">Track your transactions and commissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
          <p className="text-sm font-medium text-emerald-700">Total Transactions</p>
          <p className="text-3xl font-bold text-emerald-900 mt-2">{stats?.totalTransactions || 0}</p>
          <p className="text-xs text-emerald-600 mt-1">completed orders</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-rose-50 to-rose-100 p-6">
          <p className="text-sm font-medium text-rose-700">Amount Outstanding</p>
          <p className="text-3xl font-bold text-rose-900 mt-2">{formatCurrency(due?.due)}</p>
          <p className="text-xs text-rose-600 mt-1">Awaiting settlement</p>
        </div>
      </div>

      {/* Summary Box */}
      {due && due.due > 0 && (
        <div className="rounded-lg border-2 border-rose-200 bg-rose-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-rose-100">
                <span className="text-lg">💸</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-rose-900">Payment Due to Admin</h3>
              <p className="text-sm text-rose-700 mt-1">
                From <span className="font-bold">{stats?.totalTransactions || 0}</span> completed transactions, you owe admin <span className="font-bold">{formatCurrency(stats?.totalEarnings)}</span> total (order price + commission).
                So far <span className="font-bold">{formatCurrency(stats?.totalPaid)}</span> has been paid.
              </p>
              <p className="text-lg font-bold text-rose-900 mt-2">
                Outstanding Payment: {formatCurrency(due?.due)}
              </p>
              <p className="text-xs text-rose-600 mt-1">Contact admin for payment details</p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Details */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Transaction History</h2>

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
              <div className="rounded-lg border border-slate-200 p-8 text-center">
                <p className="text-slate-500">No transactions yet. Complete your first order to see entries!</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {allEntries.map((entry, idx) => {
                const isOrder = entry.entryType === 'order';
                const isPayment = entry.entryType === 'payment';
                const orderPrice = isOrder ? (entry.amount || 0) - (entry.commission?.total || 0) : 0;
                const commission = isOrder ? (entry.commission?.total || 0) : 0;
                
                return (
                  <div key={`${entry.entryType}-${entry._id}-${idx}`} className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            isOrder ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {isOrder ? '📦 Order Completed' : '💳 Payment Made'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(entry.date).toLocaleDateString('en-IN', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {isOrder && (
                          <div>
                            <p className="font-medium text-slate-900">{entry.deal?.title || 'Order'}</p>
                            <p className="text-sm text-slate-600">{entry.deal?.platform || ''}</p>
                            <div className="mt-2 flex gap-3 text-xs">
                              <span className="text-slate-500">
                                Order: <strong>{formatCurrency(orderPrice)}</strong>
                              </span>
                              <span className="text-purple-600">
                                + Commission: <strong>{formatCurrency(commission)}</strong>
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {isPayment && (
                          <div>
                            <p className="font-medium text-slate-900">Payment via {entry.paymentMethod}</p>
                            {entry.referenceId && (
                              <p className="text-xs text-slate-500 mt-1">Ref: {entry.referenceId}</p>
                            )}
                            {entry.notes && (
                              <p className="text-sm text-slate-600 mt-1">{entry.notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        {isOrder && (
                          <div>
                            <p className="text-sm text-slate-500">You Owe Admin</p>
                            <p className="text-xl font-bold text-rose-600">
                              + {formatCurrency(entry.amount)}
                            </p>
                          </div>
                        )}
                        {isPayment && (
                          <div>
                            <p className="text-sm text-slate-500">Paid</p>
                            <p className="text-xl font-bold text-emerald-600">
                              - {formatCurrency(entry.amount)}
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
