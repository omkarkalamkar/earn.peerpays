import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, Modal } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

// Mobile-friendly user card component
function UserCard({ user, type, readOnly, onViewLedger, onAddEntry, onAddPayment, formatCurrency }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-navy-900">{user.name}</h3>
          <p className="text-sm text-slate-500">@{user.username}</p>
        </div>
        <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-1 rounded">
          {user.totalTransactions || 0} orders
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Debit ({type === 'cardholder' ? 'You Owe' : 'They Owe'})</p>
          <p className={`font-bold text-sm mt-0.5 ${type === 'cardholder' ? 'text-emerald-600' : 'text-purple-600'}`}>
            {formatCurrency(user.totalEarnings || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Credit (Paid)</p>
          <p className="font-semibold text-sm text-slate-700 mt-0.5">
            {formatCurrency(user.totalPaid || 0)}
          </p>
        </div>
      </div>
      
      <div className="pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-500 mb-1">Balance</p>
        <p className={`text-lg font-bold ${user.due < 0 ? 'text-blue-600' : 'text-rose-600'}`}>
          {formatCurrency(Math.abs(user.due || 0))}
          {user.due < 0 && ' (Advance)'}
        </p>
      </div>
      
      {!readOnly && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={() => onViewLedger(user)}
            className="btn-secondary text-xs w-full"
          >
            📋 View Ledger
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAddEntry(user)}
              className="btn-xs bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100"
            >
              + Entry
            </button>
            <button
              onClick={() => onAddPayment(user, type === 'cardholder' ? 'given' : 'received')}
              className={`btn-xs ${type === 'cardholder' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100' : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'}`}
            >
              + Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLedger() {
  const { pushToast } = useNotifications();
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const [tab, setTab] = useState('cardholder'); // 'cardholder', 'booker', 'admin'
  const [cardholders, setCardholders] = useState(null);
  const [bookers, setBookers] = useState(null);
  const [adminEarnings, setAdminEarnings] = useState(null);
  const [adminLedger, setAdminLedger] = useState(null);
  const [payments, setPayments] = useState(null);
  const [selectedUserLedger, setSelectedUserLedger] = useState(null);
  const [ledgerDetailModal, setLedgerDetailModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [manualEntryModal, setManualEntryModal] = useState(false);
  const [editLedgerEntryModal, setEditLedgerEntryModal] = useState(false);
  const [editingLedgerEntry, setEditingLedgerEntry] = useState(null);
  const [adminCommissionModal, setAdminCommissionModal] = useState(false);
  const [editingCommissionId, setEditingCommissionId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [paymentType, setPaymentType] = useState('given'); // 'given' or 'received'
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    referenceId: '',
    notes: '',
  });
  const [manualEntryForm, setManualEntryForm] = useState({
    amount: '',
    description: '',
    notes: '',
  });
  const [ledgerEntryForm, setLedgerEntryForm] = useState({
    amount: '',
    description: '',
    notes: '',
  });
  const [adminCommissionForm, setAdminCommissionForm] = useState({
    description: '',
    amount: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  async function loadCardholders() {
    try {
      const users = await api.get('/admin/users');
      const chUsers = users.data.users.filter((u) => u.role === 'cardholder');

      // Get due amounts for each cardholder
      const chWithDue = await Promise.all(
        chUsers.map(async (ch) => {
          try {
            const due = await api.get(`/ledger/cardholder/${ch._id}/due`);
            return { ...ch, ...due.data };
          } catch (err) {
            console.error(`Error loading due for ${ch.username}:`, err);
            return { ...ch, due: 0, totalEarnings: 0, totalPaid: 0 };
          }
        })
      );
      setCardholders(chWithDue);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load cardholders');
      setCardholders([]);
    }
  }

  async function loadBookers() {
    try {
      const users = await api.get('/admin/users');
      const bUsers = users.data.users.filter((u) => u.role === 'booker');

      // Get due amounts for each booker
      const bWithDue = await Promise.all(
        bUsers.map(async (b) => {
          try {
            const due = await api.get(`/ledger/booker/${b._id}/due`);
            return { ...b, ...due.data };
          } catch (err) {
            console.error(`Error loading due for ${b.username}:`, err);
            return { ...b, due: 0, totalEarnings: 0, totalPaid: 0 };
          }
        })
      );
      setBookers(bWithDue);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load bookers');
      setBookers([]);
    }
  }

  async function loadAdminEarnings() {
    try {
      const earnings = await api.get('/ledger/admin/earnings');
      setAdminEarnings(earnings.data);
      
      const ledger = await api.get('/ledger/admin/commission-ledger');
      setAdminLedger(ledger.data);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load admin earnings');
    }
  }

  async function loadPayments() {
    try {
      const res = await api.get('/ledger/payments');
      setPayments(res.data);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load payments');
    }
  }

  useEffect(() => {
    if (tab === 'cardholder' && !cardholders) loadCardholders();
    if (tab === 'booker' && !bookers) loadBookers();
    if (tab === 'admin' && !adminEarnings) {
      loadAdminEarnings();
      loadPayments();
    }
  }, [tab]);

  async function submitPayment(e) {
    e.preventDefault();
    if (!selectedUser || !paymentForm.amount) return;

    setBusy(true);
    try {
      if (selectedUser.role === 'cardholder') {
        await api.post('/ledger/payment/cardholder', {
          recipientId: selectedUser._id,
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          referenceId: paymentForm.referenceId,
          notes: paymentForm.notes,
        });
      } else if (selectedUser.role === 'booker') {
        await api.post('/ledger/payment/booker', {
          recipientId: selectedUser._id,
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          referenceId: paymentForm.referenceId,
          notes: paymentForm.notes,
        });
      }
      pushToast(`Payment recorded for ${selectedUser.name}`);
      setPaymentModal(false);
      setPaymentForm({ amount: '', paymentMethod: 'bank_transfer', referenceId: '', notes: '' });
      setSelectedUser(null);
      if (tab === 'cardholder') loadCardholders();
      if (tab === 'booker') loadBookers();
      loadPayments();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setBusy(false);
    }
  }

  function openPaymentModal(user, type = 'given') {
    setSelectedUser(user);
    setPaymentType(type);
    setPaymentModal(true);
  }

  function openManualEntryModal(user) {
    setSelectedUser(user);
    setManualEntryModal(true);
  }

  async function submitManualEntry(e) {
    e.preventDefault();
    if (!selectedUser || !manualEntryForm.amount) return;

    setBusy(true);
    try {
      const type = selectedUser.role === 'cardholder' ? 'cardholder_earning' : 'booker_transaction';
      
      await api.post('/ledger/manual-entry', {
        userId: selectedUser._id,
        type,
        amount: parseFloat(manualEntryForm.amount),
        description: manualEntryForm.description || 'Manual entry',
        notes: manualEntryForm.notes,
      });
      
      pushToast(`Manual entry added for ${selectedUser.name}`);
      setManualEntryModal(false);
      setManualEntryForm({ amount: '', description: '', notes: '' });
      setSelectedUser(null);
      if (tab === 'cardholder') loadCardholders();
      if (tab === 'booker') loadBookers();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to add entry');
    } finally {
      setBusy(false);
    }
  }

  function openEditLedgerEntry(entry) {
    setEditingLedgerEntry(entry);
    setLedgerEntryForm({
      amount: entry.amount || '',
      description: entry.description || '',
      notes: entry.notes || '',
    });
    setEditLedgerEntryModal(true);
  }

  async function submitEditLedgerEntry(e) {
    e.preventDefault();
    if (!editingLedgerEntry || !ledgerEntryForm.amount) return;

    setBusy(true);
    try {
      await api.put(`/ledger/ledger-entry/${editingLedgerEntry._id}`, {
        amount: parseFloat(ledgerEntryForm.amount),
        description: ledgerEntryForm.description,
        notes: ledgerEntryForm.notes,
      });
      
      pushToast('Entry updated');
      setEditLedgerEntryModal(false);
      setLedgerEntryForm({ amount: '', description: '', notes: '' });
      setEditingLedgerEntry(null);
      
      // Refresh data
      setLedgerDetailModal(false);
      setSelectedUserLedger(null);
      if (tab === 'cardholder') loadCardholders();
      if (tab === 'booker') loadBookers();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to update entry');
    } finally {
      setBusy(false);
    }
  }

  function openAdminCommissionModal(entry = null) {
    if (entry) {
      setEditingCommissionId(entry._id);
      setAdminCommissionForm({
        description: entry.description || '',
        amount: entry.amount || '',
        notes: entry.notes || '',
      });
    } else {
      setEditingCommissionId(null);
      setAdminCommissionForm({ description: '', amount: '', notes: '' });
    }
    setAdminCommissionModal(true);
  }

  async function submitAdminCommission(e) {
    e.preventDefault();
    if (!adminCommissionForm.amount || !adminCommissionForm.description) return;

    setBusy(true);
    try {
      const payload = {
        description: adminCommissionForm.description,
        amount: parseFloat(adminCommissionForm.amount),
        notes: adminCommissionForm.notes,
      };

      if (editingCommissionId) {
        await api.put(`/ledger/ledger-entry/${editingCommissionId}`, payload);
        pushToast('Commission entry updated');
      } else {
        await api.post('/ledger/admin/commission-ledger', payload);
        pushToast('Commission entry added');
      }
      
      setAdminCommissionModal(false);
      setAdminCommissionForm({ description: '', amount: '', notes: '' });
      setEditingCommissionId(null);
      loadAdminEarnings();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdminCommission(entry) {
    if (!confirm(`Delete this commission entry: "${entry.description}"?`)) return;
    
    try {
      await api.delete(`/ledger/admin/commission-ledger/${entry._id}`);
      pushToast('Commission entry deleted');
      loadAdminEarnings();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to delete');
    }
  }

  async function openLedgerDetail(user) {
    try {
      let ledgerRes, paymentsRes;
      if (user.role === 'cardholder') {
        ledgerRes = await api.get(`/ledger/cardholder/${user._id}/ledger`);
        paymentsRes = await api.get(`/ledger/payments?recipientId=${user._id}&type=cardholder_payout`);
      } else if (user.role === 'booker') {
        ledgerRes = await api.get(`/ledger/booker/${user._id}/ledger`);
        paymentsRes = await api.get(`/ledger/payments?recipientId=${user._id}&type=booker_payout`);
      }
      
      // Combine ledger and payments into single timeline
      const ledgerEntries = (ledgerRes?.data || []).map(e => ({
        ...e,
        entryType: 'order',
        date: e.createdAt,
      }));
      
      const paymentEntries = (paymentsRes?.data || []).map(p => ({
        ...p,
        entryType: 'payment',
        date: p.paidAt || p.createdAt,
      }));
      
      const combined = [...ledgerEntries, ...paymentEntries].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setSelectedUserLedger({ user, entries: combined });
      setLedgerDetailModal(true);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load ledger details');
    }
  }

  const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Ledger Management</h1>
        <p className="text-sm text-slate-500">Track earnings and payments for all users</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('cardholder')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
              tab === 'cardholder'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Card Holders
          </button>
          <button
            onClick={() => setTab('booker')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
              tab === 'booker'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Bookers
          </button>
          <button
            onClick={() => setTab('admin')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
              tab === 'admin'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Earnings
          </button>
        </div>
        <button
          onClick={() => {
            setCardholders(null);
            setBookers(null);
            setAdminEarnings(null);
            setAdminLedger(null);
            if (tab === 'cardholder') loadCardholders();
            if (tab === 'booker') loadBookers();
            if (tab === 'admin') {
              loadAdminEarnings();
              loadPayments();
            }
          }}
          className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Card Holders Tab */}
      {tab === 'cardholder' && (
        <div className="space-y-4">
          {!cardholders ? (
            <Spinner />
          ) : cardholders.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center">
              <p className="text-slate-500">No card holders found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {cardholders.map((ch) => (
                  <UserCard
                    key={ch._id}
                    user={ch}
                    type="cardholder"
                    readOnly={readOnly}
                    onViewLedger={openLedgerDetail}
                    onAddEntry={openManualEntryModal}
                    onAddPayment={openPaymentModal}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Orders</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Debit (You Owe)</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Credit (You Paid)</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Balance</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardholders.map((ch) => (
                      <tr key={ch._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{ch.name}</td>
                        <td className="px-4 py-3 text-slate-600">@{ch.username}</td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{ch.totalTransactions || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(ch.totalEarnings || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(ch.totalPaid || 0)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={ch.due < 0 ? 'text-blue-600' : 'text-rose-600'}>
                            {formatCurrency(Math.abs(ch.due || 0))}
                            {ch.due < 0 && ' (Advance)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!readOnly && (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => openLedgerDetail(ch)}
                                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                              >
                                View Ledger
                              </button>
                              <button
                                onClick={() => openManualEntryModal(ch)}
                                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                              >
                                Add Entry
                              </button>
                              <button
                                onClick={() => openPaymentModal(ch, 'given')}
                                className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
                              >
                                Add Payment
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Total Debit (You Owe Them)</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {formatCurrency(cardholders.reduce((sum, ch) => sum + (ch.totalEarnings || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Total Credit (You Paid Them)</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {formatCurrency(cardholders.reduce((sum, ch) => sum + (ch.totalPaid || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Net Balance</p>
                    <p className={`text-lg font-bold mt-1 ${
                      cardholders.reduce((sum, ch) => sum + (ch.due || 0), 0) < 0 
                        ? 'text-blue-600' 
                        : 'text-rose-600'
                    }`}>
                      {formatCurrency(Math.abs(cardholders.reduce((sum, ch) => sum + (ch.due || 0), 0)))}
                      {cardholders.reduce((sum, ch) => sum + (ch.due || 0), 0) < 0 && ' (Advance)'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bookers Tab */}
      {tab === 'booker' && (
        <div className="space-y-4">
          {!bookers ? (
            <Spinner />
          ) : bookers.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center">
              <p className="text-slate-500">No bookers found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {bookers.map((bk) => (
                  <UserCard
                    key={bk._id}
                    user={bk}
                    type="booker"
                    readOnly={readOnly}
                    onViewLedger={openLedgerDetail}
                    onAddEntry={openManualEntryModal}
                    onAddPayment={openPaymentModal}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Orders</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Debit (They Owe)</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Credit (They Paid)</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Balance</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookers.map((bk) => (
                      <tr key={bk._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{bk.name}</td>
                        <td className="px-4 py-3 text-slate-600">@{bk.username}</td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{bk.totalTransactions || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-600">
                          {formatCurrency(bk.totalEarnings || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(bk.totalPaid || 0)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={bk.due < 0 ? 'text-blue-600' : 'text-rose-600'}>
                            {formatCurrency(Math.abs(bk.due || 0))}
                            {bk.due < 0 && ' (Advance)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!readOnly && (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => openLedgerDetail(bk)}
                                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                              >
                                View Ledger
                              </button>
                              <button
                                onClick={() => openManualEntryModal(bk)}
                                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                              >
                                Add Entry
                              </button>
                              <button
                                onClick={() => openPaymentModal(bk, 'received')}
                                className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                              >
                                Add Payment
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Total Debit (They Owe You)</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {formatCurrency(bookers.reduce((sum, bk) => sum + (bk.totalEarnings || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Total Credit (They Paid You)</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {formatCurrency(bookers.reduce((sum, bk) => sum + (bk.totalPaid || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Net Balance</p>
                    <p className={`text-lg font-bold mt-1 ${
                      bookers.reduce((sum, bk) => sum + (bk.due || 0), 0) < 0 
                        ? 'text-blue-600' 
                        : 'text-rose-600'
                    }`}>
                      {formatCurrency(Math.abs(bookers.reduce((sum, bk) => sum + (bk.due || 0), 0)))}
                      {bookers.reduce((sum, bk) => sum + (bk.due || 0), 0) < 0 && ' (Advance)'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Admin Earnings Tab */}
      {tab === 'admin' && (
        <div className="space-y-4">
          {!adminEarnings ? (
            <Spinner />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-brand-50 to-brand-100 p-6">
                  <p className="text-sm font-medium text-brand-700">Total Admin Commissions</p>
                  <p className="text-3xl font-bold text-brand-900 mt-2">
                    {formatCurrency(adminEarnings.totalEarnings)}
                  </p>
                  <p className="text-xs text-brand-600 mt-1">from {adminEarnings.count || 0} orders</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
                  <p className="text-sm font-medium text-emerald-700">Paid to Cardholders</p>
                  <p className="text-3xl font-bold text-emerald-900 mt-2">
                    {formatCurrency(adminEarnings.totalCardholderPaid)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6">
                  <p className="text-sm font-medium text-purple-700">Received from Bookers</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    {formatCurrency(adminEarnings.totalBookerReceived)}
                  </p>
                </div>
              </div>

              {/* Commission Ledger */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Commission Ledger</h3>
                  {!readOnly && (
                    <button
                      onClick={() => openAdminCommissionModal()}
                      className="btn-primary btn-sm"
                    >
                      + Add Entry
                    </button>
                  )}
                </div>
                {adminLedger && adminLedger.ledgers && adminLedger.ledgers.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Deal</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                            {!readOnly && <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {adminLedger.ledgers.map((entry) => (
                            <tr key={entry._id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-600 text-xs">
                                {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-slate-900">{entry.description || 'Commission'}</p>
                                {entry.notes && <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>}
                              </td>
                              <td className="px-4 py-3">
                                {entry.deal ? (
                                  <div>
                                    <p className="text-slate-900 text-xs">{entry.deal.title}</p>
                                    <p className="text-slate-500 text-xs capitalize">{entry.deal.platform}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                {formatCurrency(entry.amount)}
                              </td>
                              {!readOnly && (
                                <td className="px-4 py-3 text-center">
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={() => openAdminCommissionModal(entry)}
                                      className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => deleteAdminCommission(entry)}
                                      className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium"
                                    >
                                      🗑️ Delete
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 p-8 text-center">
                    <p className="text-slate-500 mb-3">No commission entries yet</p>
                    {!readOnly && (
                      <button
                        onClick={() => openAdminCommissionModal()}
                        className="btn-primary btn-sm"
                      >
                        + Add First Entry
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Payment History</h3>
                {payments && payments.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Recipient</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Method</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
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
                              <span className={`text-xs font-medium px-2 py-1 rounded ${
                                p.type === 'cardholder_payout'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {p.type === 'cardholder_payout' ? 'Card Holder' : 'Booker'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(p.amount)}</td>
                            <td className="px-4 py-3 text-slate-600">{p.paymentMethod}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{p.referenceId || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                              {new Date(p.paidAt || p.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">No payments recorded yet</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <Modal
        open={paymentModal}
        onClose={() => {
          setPaymentModal(false);
          setSelectedUser(null);
          setPaymentForm({ amount: '', paymentMethod: 'bank_transfer', referenceId: '', notes: '' });
        }}
        title={`Add Payment Entry - ${selectedUser?.name}`}
      >
        <form onSubmit={submitPayment} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm font-medium text-blue-900">
              {paymentType === 'given' ? '💸 Recording money GIVEN to cardholder' : '💰 Recording money RECEIVED from booker'}
            </p>
            {selectedUser && (
              <p className="text-xs text-blue-700 mt-1">
                Current Balance: <strong className={selectedUser.due < 0 ? 'text-blue-600' : 'text-rose-600'}>
                  {formatCurrency(Math.abs(selectedUser.due || 0))} {selectedUser.due < 0 ? '(They have advance)' : '(Outstanding)'}
                </strong>
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label className="label">Payment Method</label>
            <select
              className="input"
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
            </select>
          </div>

          <div>
            <label className="label">Reference ID (optional)</label>
            <input
              type="text"
              className="input"
              value={paymentForm.referenceId}
              onChange={(e) => setPaymentForm({ ...paymentForm, referenceId: e.target.value })}
              placeholder="e.g., UTR, Transaction ID"
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows="2"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              placeholder="Any additional notes..."
            />
          </div>

          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Adding...' : 'Add Payment Entry'}
          </button>
        </form>
      </Modal>

      {/* Ledger Detail Modal */}
      <Modal
        open={ledgerDetailModal}
        onClose={() => {
          setLedgerDetailModal(false);
          setSelectedUserLedger(null);
        }}
        title={`Ledger Details - ${selectedUserLedger?.user?.name}`}
      >
        {selectedUserLedger && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Role</p>
                  <p className="font-medium text-slate-900 capitalize">{selectedUserLedger.user.role}</p>
                </div>
                <div>
                  <p className="text-slate-500">Username</p>
                  <p className="font-medium text-slate-900">@{selectedUserLedger.user.username}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Transaction History</h3>
              {selectedUserLedger.entries.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedUserLedger.entries.map((entry, idx) => {
                    const isOrder = entry.entryType === 'order';
                    const isPayment = entry.entryType === 'payment';
                    
                    return (
                      <div key={`${entry.entryType}-${entry._id}-${idx}`} className="border border-slate-200 rounded p-3 hover:bg-slate-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                isOrder ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {isOrder ? '📦 Order' : '💳 Payment'}
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
                              <p className="text-sm text-slate-700 mt-1">
                                {entry.description || entry.deal?.title || 'Order'}
                              </p>
                            )}
                            
                            {isPayment && (
                              <div className="text-sm text-slate-700 mt-1">
                                <p><strong>{entry.paymentMethod}</strong> payment</p>
                                {entry.referenceId && (
                                  <p className="text-xs text-slate-500">Ref: {entry.referenceId}</p>
                                )}
                                {entry.notes && (
                                  <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right ml-4 flex flex-col items-end gap-2">
                            {isOrder && (
                              <p className="text-base font-bold text-rose-600">
                                + {formatCurrency(entry.amount)}
                              </p>
                            )}
                            {isPayment && (
                              <p className="text-base font-bold text-emerald-600">
                                - {formatCurrency(entry.amount)}
                              </p>
                            )}
                            {!readOnly && (
                              <div className="flex gap-1">
                                {isOrder && (
                                  <button
                                    onClick={() => openEditLedgerEntry(entry)}
                                    className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  >
                                    ✏️ Edit
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!confirm('Delete this entry? This cannot be undone.')) return;
                                    try {
                                      if (isOrder) {
                                        await api.delete(`/ledger/ledger-entry/${entry._id}`);
                                      } else {
                                        await api.delete(`/ledger/payment/${entry._id}`);
                                      }
                                      pushToast('Entry deleted');
                                      // Refresh data
                                      setLedgerDetailModal(false);
                                      setSelectedUserLedger(null);
                                      if (tab === 'cardholder') loadCardholders();
                                      if (tab === 'booker') loadBookers();
                                    } catch (err) {
                                      pushToast(err.response?.data?.message || 'Failed to delete');
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        open={manualEntryModal}
        onClose={() => {
          setManualEntryModal(false);
          setSelectedUser(null);
          setManualEntryForm({ amount: '', description: '', notes: '' });
        }}
        title={`Add Manual Entry - ${selectedUser?.name}`}
      >
        <form onSubmit={submitManualEntry} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
            <p className="text-sm font-medium text-amber-900">
              📝 Adding manual ledger entry (Order/Debit)
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Use this to record manual orders or adjustments that increase their balance.
            </p>
            {selectedUser && (
              <p className="text-xs text-amber-700 mt-1">
                Current Balance: <strong className={selectedUser.due < 0 ? 'text-blue-600' : 'text-rose-600'}>
                  {formatCurrency(Math.abs(selectedUser.due || 0))} {selectedUser.due < 0 ? '(They have advance)' : '(Outstanding)'}
                </strong>
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={manualEntryForm.amount}
              onChange={(e) => setManualEntryForm({ ...manualEntryForm, amount: e.target.value })}
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label className="label">Description *</label>
            <input
              type="text"
              className="input"
              value={manualEntryForm.description}
              onChange={(e) => setManualEntryForm({ ...manualEntryForm, description: e.target.value })}
              placeholder="e.g., Manual order, Adjustment"
              required
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows="2"
              value={manualEntryForm.notes}
              onChange={(e) => setManualEntryForm({ ...manualEntryForm, notes: e.target.value })}
              placeholder="Any additional notes..."
            />
          </div>

          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Adding...' : 'Add Entry'}
          </button>
        </form>
      </Modal>

      {/* Edit Ledger Entry Modal */}
      <Modal
        open={editLedgerEntryModal}
        onClose={() => {
          setEditLedgerEntryModal(false);
          setLedgerEntryForm({ amount: '', description: '', notes: '' });
          setEditingLedgerEntry(null);
        }}
        title="Edit Ledger Entry"
      >
        <form onSubmit={submitEditLedgerEntry} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm font-medium text-blue-900">
              ✏️ Update Ledger Entry
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Modify the amount, description, or notes for this entry.
            </p>
          </div>

          <div>
            <label className="label">
              Description *
            </label>
            <input
              type="text"
              className="input"
              value={ledgerEntryForm.description}
              onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, description: e.target.value })}
              placeholder="Entry description"
              required
            />
          </div>

          <div>
            <label className="label">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={ledgerEntryForm.amount}
              onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, amount: e.target.value })}
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows="3"
              value={ledgerEntryForm.notes}
              onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, notes: e.target.value })}
              placeholder="Any additional notes..."
            />
          </div>

          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Updating...' : 'Update Entry'}
          </button>
        </form>
      </Modal>

      {/* Admin Commission Modal */}
      <Modal
        open={adminCommissionModal}
        onClose={() => {
          setAdminCommissionModal(false);
          setAdminCommissionForm({ description: '', amount: '', notes: '' });
          setEditingCommissionId(null);
        }}
        title={editingCommissionId ? 'Edit Commission Entry' : 'Add Commission Entry'}
      >
        <form onSubmit={submitAdminCommission} className="space-y-4">
          <div className="bg-brand-50 border border-brand-200 rounded p-3 mb-4">
            <p className="text-sm font-medium text-brand-900">
              💰 {editingCommissionId ? 'Update' : 'Add'} Admin Commission Entry
            </p>
            <p className="text-xs text-brand-700 mt-1">
              Use this to record manual commission adjustments or corrections.
            </p>
          </div>

          <div>
            <label className="label">
              Description *
            </label>
            <input
              type="text"
              className="input"
              value={adminCommissionForm.description}
              onChange={(e) => setAdminCommissionForm({ ...adminCommissionForm, description: e.target.value })}
              placeholder="e.g., Manual commission, Adjustment"
              required
            />
          </div>

          <div>
            <label className="label">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={adminCommissionForm.amount}
              onChange={(e) => setAdminCommissionForm({ ...adminCommissionForm, amount: e.target.value })}
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows="3"
              value={adminCommissionForm.notes}
              onChange={(e) => setAdminCommissionForm({ ...adminCommissionForm, notes: e.target.value })}
              placeholder="Any additional notes..."
            />
          </div>

          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving...' : editingCommissionId ? 'Update Entry' : 'Add Entry'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
