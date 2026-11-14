import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, Modal, PlatformBadge, money } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { BANKS } from '../../constants';

const EMPTY = {
  title: '',
  platform: 'Amazon',
  product: '',
  price: '',
  profit: '',
  offerDetails: '',
  eligibleBanks: [],
  eligibleCardTypes: [],
  imageUrl: '',
  status: 'open',
  assignedBooker: '',
  quantity: -1,
  commission: {
    bookerTotal: '',
    adminShare: '',
    cardholderShare: '',
  },
};

export default function AdminDeals() {
  const { pushToast } = useNotifications();
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const [deals, setDeals] = useState(null);
  const [bookers, setBookers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/deals').then((res) => setDeals(res.data.deals));
  }
  
  function loadBookers() {
    api.get('/admin/users').then((res) => {
      const bookerList = res.data.users.filter(u => u.role === 'booker' && u.active);
      setBookers(bookerList);
    }).catch((err) => {
      console.error('Failed to load bookers:', err);
      setBookers([]);
    });
  }
  
  useEffect(() => {
    load();
    loadBookers();
  }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditId(null);
    setModal(true);
  }

  function openEdit(d) {
    setForm({
      ...d,
      eligibleBanks: d.eligibleBanks || [],
      eligibleCardTypes: d.eligibleCardTypes || [],
      assignedBooker: d.assignedBooker?._id || d.assignedBooker || '',
      quantity: d.quantity != null ? d.quantity : -1,
      commission: d.commission || {
        bookerTotal: '',
        adminShare: '',
        cardholderShare: '',
      },
    });
    setEditId(d._id);
    setModal(true);
  }

  function toggleType(t) {
    setForm((f) => ({
      ...f,
      eligibleCardTypes: f.eligibleCardTypes.includes(t)
        ? f.eligibleCardTypes.filter((x) => x !== t)
        : [...f.eligibleCardTypes, t],
    }));
  }

  function toggleBank(b) {
    setForm((f) => ({
      ...f,
      eligibleBanks: f.eligibleBanks.includes(b)
        ? f.eligibleBanks.filter((x) => x !== b)
        : [...f.eligibleBanks, b],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    
    // Validate commission
    const bookerTotal = Number(form.commission?.bookerTotal || 0);
    const adminShare = Number(form.commission?.adminShare || 0);
    const cardholderShare = Number(form.commission?.cardholderShare || 0);
    
    if (adminShare + cardholderShare > bookerTotal) {
      pushToast('Admin share + cardholder share cannot exceed booker total commission');
      setBusy(false);
      return;
    }
    
    const payload = {
      ...form,
      price: Number(form.price),
      profit: Number(form.profit) || 0,
      eligibleBanks: form.eligibleBanks,
      assignedBooker: form.assignedBooker || null,
      quantity: Number(form.quantity),
      commission: {
        bookerTotal,
        adminShare,
        cardholderShare,
      },
    };
    try {
      if (editId) await api.put(`/deals/${editId}`, payload);
      else await api.post('/deals', payload);
      setModal(false);
      pushToast(editId ? 'Deal updated' : 'Deal posted');
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to save deal');
    } finally {
      setBusy(false);
    }
  }

  async function expire(d) {
    if (!confirm(`Expire "${d.title}"? It will stop showing to card holders and bookers, but stays here as expired.`)) return;
    try {
      await api.put(`/deals/${d._id}`, { status: 'expired' });
      pushToast('Deal moved to expired');
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to expire deal');
    }
  }

  async function remove(d) {
    if (!confirm(`Permanently delete "${d.title}"? This cannot be undone. (Completed orders & analytics are kept.)`)) return;
    try {
      await api.delete(`/deals/${d._id}`);
      pushToast('Deal deleted');
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to delete deal');
    }
  }

  if (!deals) return <Spinner />;

  // Show live/paused deals first, expired ones at the bottom.
  const sortedDeals = [...deals].sort((a, b) => {
    const rank = (s) => (s === 'expired' ? 1 : 0);
    return rank(a.status) - rank(b.status);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Deals</h1>
          <p className="text-sm text-slate-500">Post and manage deals from various platforms.</p>
        </div>
        {!readOnly && (
          <button className="btn-primary" onClick={openCreate}>
            + Post Deal
          </button>
        )}
      </div>

      {deals.length === 0 ? (
        <EmptyState title="No deals yet" subtitle="Post your first deal to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedDeals.map((d) => (
            <div key={d._id} className={`card p-3.5 ${d.status === 'expired' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <PlatformBadge platform={d.platform} />
                    <span
                      className={`chip ${
                        d.status === 'open'
                          ? 'bg-emerald-100 text-emerald-700'
                          : d.status === 'expired'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold leading-snug text-navy-900">{d.title}</h3>
                  <p className="text-[13px] text-slate-500">{d.product}</p>
                </div>
                <p className="whitespace-nowrap text-base font-bold text-navy-900">{money(d.price)}</p>
              </div>
              {d.profit > 0 && (
                <p className="mt-2 inline-flex chip bg-emerald-100 text-emerald-700">
                  Profit: {money(d.profit)}
                </p>
              )}
              
              {/* Quantity Progress */}
              {d.quantity > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {d.completedCount || 0}/{d.quantity} completed
                    </span>
                    <span className={`font-semibold ${d.completedCount >= d.quantity ? 'text-red-600' : 'text-brand-600'}`}>
                      {d.completedCount >= d.quantity ? '✓ Full' : `${d.quantity - (d.completedCount || 0)} left`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${d.completedCount >= d.quantity ? 'bg-red-500' : 'bg-brand-500'}`}
                      style={{ width: `${Math.min(100, ((d.completedCount || 0) / d.quantity) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Assigned Booker */}
              {d.assignedBooker && (
                <p className="mt-2 text-xs text-slate-500">
                  📌 Assigned to: {d.assignedBooker.name || d.assignedBooker.username}
                </p>
              )}
              
              {d.offerDetails && <p className="mt-1.5 line-clamp-2 text-[13px] text-slate-500">{d.offerDetails}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(d.eligibleBanks || []).map((b) => (
                  <span key={b} className="chip bg-slate-100 text-slate-600">
                    {b}
                  </span>
                ))}
                {(d.eligibleCardTypes || []).map((t) => (
                  <span key={t} className="chip bg-brand-50 text-brand-700">
                    {t}
                  </span>
                ))}
              </div>
              {!readOnly && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary btn-xs" onClick={() => openEdit(d)}>
                    Edit
                  </button>
                  {d.status === 'expired' ? (
                    <button className="btn-danger btn-xs" onClick={() => remove(d)}>
                      Delete
                    </button>
                  ) : (
                    <button className="btn-warning btn-xs" onClick={() => expire(d)}>
                      Expire
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Deal' : 'Post Deal'}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Platform</label>
              <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option>Amazon</option>
                <option>Flipkart</option>
                <option>Croma</option>
                <option>Reliance Digital</option>
                <option>Swiggy</option>
                <option>Zepto</option>
                <option>Blinkit</option>
                <option>BigBasket</option>
                <option>Others</option>
              </select>
            </div>
            <div>
              <label className="label">Price (INR)</label>
              <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="label">Profit (INR)</label>
              <input type="number" className="input" placeholder="Card holder earns" value={form.profit} onChange={(e) => setForm({ ...form, profit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Product</label>
            <input className="input" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} required />
          </div>
          <div>
            <label className="label">Offer details</label>
            <textarea className="input" rows={2} value={form.offerDetails} onChange={(e) => setForm({ ...form, offerDetails: e.target.value })} />
          </div>

          {/* Deal Assignment & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assign to Booker</label>
              <select 
                className="input" 
                value={form.assignedBooker || ''} 
                onChange={(e) => setForm({ ...form, assignedBooker: e.target.value })}
              >
                <option value="">All Bookers (visible to everyone)</option>
                {bookers.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} (@{b.username})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">Leave blank to show deal to all bookers</p>
            </div>
            <div>
              <label className="label">Quantity Limit</label>
              <input 
                type="number" 
                className="input" 
                placeholder="-1 = unlimited"
                value={form.quantity} 
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} 
              />
              <p className="mt-1 text-xs text-slate-400">-1 = unlimited, {'>'}0 = max completed orders</p>
            </div>
          </div>

          {/* Commission Section */}
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
            <h3 className="font-semibold text-brand-900">Commission Structure</h3>
            <p className="text-xs text-brand-700">Enter any 2 values, the 3rd will auto-calculate</p>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">Your Share (₹)</label>
                <input 
                  type="number" 
                  className="input text-sm"
                  placeholder="e.g., 250"
                  value={form.commission?.adminShare || ''} 
                  onChange={(e) => {
                    const adminShare = Number(e.target.value) || 0;
                    const cardholderShare = Number(form.commission?.cardholderShare) || 0;
                    setForm({ 
                      ...form, 
                      commission: { 
                        adminShare: e.target.value,
                        cardholderShare: form.commission?.cardholderShare || '',
                        bookerTotal: adminShare + cardholderShare,
                      }
                    });
                  }} 
                />
              </div>
              <div>
                <label className="label text-xs">Holder's Share (₹)</label>
                <input 
                  type="number" 
                  className="input text-sm"
                  placeholder="e.g., 250"
                  value={form.commission?.cardholderShare || ''} 
                  onChange={(e) => {
                    const cardholderShare = Number(e.target.value) || 0;
                    const adminShare = Number(form.commission?.adminShare) || 0;
                    setForm({ 
                      ...form, 
                      commission: { 
                        adminShare: form.commission?.adminShare || '',
                        cardholderShare: e.target.value,
                        bookerTotal: adminShare + cardholderShare,
                      }
                    });
                  }} 
                />
              </div>
              <div>
                <label className="label text-xs">Total from Booker (₹)</label>
                <input 
                  type="number" 
                  className="input text-sm bg-slate-100"
                  placeholder="Auto-calculated"
                  value={form.commission?.bookerTotal || ''} 
                  readOnly
                  title="Auto-calculated: Your Share + Holder's Share"
                />
              </div>
            </div>
            
            {form.commission?.bookerTotal > 0 && (
              <div className="text-xs text-brand-700 bg-white p-2 rounded border border-brand-100">
                <p><strong>Total:</strong> ₹{form.commission?.bookerTotal || 0} = ₹{form.commission?.adminShare || 0} (you) + ₹{form.commission?.cardholderShare || 0} (holder)</p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Eligible banks</label>
            <div className="flex flex-wrap gap-1.5">
              {BANKS.map((b) => {
                const on = form.eligibleBanks.includes(b);
                return (
                  <button
                    type="button"
                    key={b}
                    onClick={() => toggleBank(b)}
                    className={`chip border transition ${
                      on
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-400">Leave all unselected to allow any bank.</p>
          </div>
          <div>
            <label className="label">Eligible card types</label>
            <div className="flex gap-4">
              {['credit', 'debit'].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.eligibleCardTypes.includes(t)} onChange={() => toggleType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          {editId && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="expired">expired</option>
              </select>
            </div>
          )}
          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving...' : editId ? 'Update Deal' : 'Post Deal'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
