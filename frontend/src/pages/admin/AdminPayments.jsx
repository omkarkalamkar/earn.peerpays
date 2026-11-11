import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, Modal } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export default function AdminPayments() {
  const { pushToast } = useNotifications();
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const [tab, setTab] = useState('pending'); // 'all', 'completed', 'pending', 'reversed'
  const [payments, setPayments] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'cardholder_payout', 'booker_payout'
  const [statusModal, setStatusModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [newStatus, setNewStatus] = useState('completed');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  async function loadPayments() {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.append('status', tab);
      if (filterType !== 'all') params.append('type', filterType);
      params.append('limit', 1000);

      const res = await api.get(`/ledger/payments?${params.toString()}`);
      setPayments(res.data);
      calculateStats(res.data);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load payments');
    }
  }

  function calculateStats(paymentList) {
    const stats = {
      total: 0,
      completed: 0,
      pending: 0,
      reversed: 0,
      cardholder: 0,
      booker: 0,
    };

    paymentList.forEach((p) => {
      stats.total += p.amount;
      if (p.status === 'completed') stats.completed += p.amount;
      if (p.status === 'pending') stats.pending += p.amount;
      if (p.status === 'reversed') stats.reversed += p.amount;
      if (p.type === 'cardholder_payout') stats.cardholder += p.amount;
      if (p.type === 'booker_payout') stats.booker += p.amount;
    });

    setStats(stats);
  }

  useEffect(() => {
    loadPayments();
  }, [tab, filterType]);

  async function updateStatus(e) {
    e.preventDefault();
    if (!selectedPayment) return;

    setBusy(true);
    try {
      await api.patch(`/ledger/payment/${selectedPayment._id}/status`, { status: newStatus });
      pushToast(`Payment status updated to ${newStatus}`);
      setStatusModal(false);
      setSelectedPayment(null);
      loadPayments();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setBusy(false);
    }
  }

  const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'reversed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeBadgeColor = (type) => {
    return type === 'cardholder_payout'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-purple-100 text-purple-700';
  };

  if (!payments) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Payment Reconciliation</h1>
        <p className="text-sm text-slate-500">Manage and track all payments to users</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-600 font-medium">Total Paid Out</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.total)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-600 font-medium">Completed Payments</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(stats.completed)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-600 font-medium">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{formatCurrency(stats.pending)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-600 font-medium">To Card Holders vs Bookers</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              CH: {formatCurrency(stats.cardholder)} / BK: {formatCurrency(stats.booker)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Status</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['all', 'completed', 'pending', 'reversed'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-xs px-3 py-1 rounded border transition ${
                    tab === t
                      ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Type</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['all', 'cardholder_payout', 'booker_payout'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`text-xs px-3 py-1 rounded border transition ${
                    filterType === t
                      ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'cardholder_payout' ? 'Card Holders' : 'Bookers'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      {payments.length > 0 ? (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Recipient</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Method</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Recorded By</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{p.recipient?.name}</p>
                      <p className="text-xs text-slate-500">@{p.recipient?.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${getTypeBadgeColor(p.type)}`}>
                      {p.type === 'cardholder_payout' ? 'Card Holder' : 'Booker'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="capitalize text-xs bg-slate-100 px-2 py-1 rounded">
                      {p.paymentMethod?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{p.referenceId || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <div>{formatDate(p.paidAt)}</div>
                    <div className="text-slate-500">{formatTime(p.paidAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded border ${getStatusBadgeColor(p.status)}`}>
                      {p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {p.recordedBy?.name || 'System'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!readOnly && p.status !== 'completed' && (
                      <button
                        onClick={() => {
                          setSelectedPayment(p);
                          setNewStatus(p.status === 'pending' ? 'completed' : 'pending');
                          setStatusModal(true);
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No payments found with current filters</p>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Payment Reconciliation Guide</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Record all payments made to card holders and bookers</li>
          <li>• Track payment method, reference ID (bank transfer ID, check number, etc.)</li>
          <li>• Mark payments as Completed, Pending (awaiting confirmation), or Reversed</li>
          <li>• Payment amounts are subtracted from user due totals automatically</li>
          <li>• Filter by status and type to find specific payment records</li>
          <li>• All payment history is maintained for audit purposes</li>
        </ul>
      </div>

      {/* Status Update Modal */}
      <Modal
        open={statusModal}
        onClose={() => {
          setStatusModal(false);
          setSelectedPayment(null);
        }}
        title="Update Payment Status"
      >
        {selectedPayment && (
          <form onSubmit={updateStatus} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">Recipient</p>
              <p className="font-bold text-slate-900">{selectedPayment.recipient?.name}</p>
              <p className="text-sm text-slate-600 mt-2">Current Amount</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(selectedPayment.amount)}
              </p>
              <p className="text-sm text-slate-600 mt-2">Current Status</p>
              <p className="capitalize font-semibold text-slate-900">{selectedPayment.status}</p>
            </div>

            <div>
              <label className="label">New Status</label>
              <select
                className="input"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">Status Meanings:</p>
              <ul className="space-y-1">
                <li>• <strong>Pending</strong>: Payment initiated, awaiting confirmation</li>
                <li>• <strong>Completed</strong>: Payment confirmed and settled</li>
                <li>• <strong>Reversed</strong>: Payment cancelled or returned</li>
              </ul>
            </div>

            <button className="btn-primary btn-block" disabled={busy}>
              {busy ? 'Updating...' : 'Update Status'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
