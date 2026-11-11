import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, Modal } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { BANKS } from '../../constants';

const EMPTY = {
  bank: '',
  network: 'Visa',
  type: 'credit',
  holderName: '',
  number: '',
  cvv: '',
  expiryMonth: '',
  expiryYear: '',
};

export default function HolderCards() {
  const { pushToast } = useNotifications();
  const [cards, setCards] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/cards').then((res) => setCards(res.data.cards));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    const m = Number(form.expiryMonth);
    // Accept both 2-digit (28) and 4-digit (2028) years.
    let y = Number(form.expiryYear);
    if (Number.isInteger(y) && y >= 0 && y < 100) y += 2000;
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      pushToast('Expiry month must be between 1 and 12');
      return;
    }
    const now = new Date();
    if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
      pushToast('Card has expired — expiry must be this month or later');
      return;
    }
    setBusy(true);
    try {
      await api.post('/cards', {
        ...form,
        holderName: form.bank, // Use bank name as placeholder since name not needed
        expiryMonth: m,
        expiryYear: y,
      });
      setModal(false);
      setForm(EMPTY);
      pushToast('Card added securely');
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to add card');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Remove this card?')) return;
    await api.delete(`/cards/${id}`);
    pushToast('Card removed');
    load();
  }

  if (!cards) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-navy-900 sm:text-xl">My Cards</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted card storage • Share for deals
          </p>
        </div>
        <button
          className="btn-primary whitespace-nowrap"
          onClick={() => {
            setForm(EMPTY);
            setModal(true);
          }}
        >
          + Add
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <path d="M2 10h20"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-700">No cards yet</p>
          <p className="text-sm text-slate-500 mt-1">Add your first card to start</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <div
              key={c._id}
              className="brand-gradient relative overflow-hidden rounded-xl p-4 text-white shadow-lg"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider">{c.bank}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/20">{c.type}</span>
              </div>
              
              {/* Card Number */}
              <p className="font-mono text-lg tracking-wider mb-3">{c.masked}</p>
              
              {/* Card Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[9px] uppercase text-white/60 mb-0.5">Expires</p>
                  <p className="font-medium font-mono">
                    {String(c.expiryMonth).padStart(2, '0')}/{String(c.expiryYear).slice(-2)}
                  </p>
                </div>
                {c.cvv && (
                  <div>
                    <p className="text-[9px] uppercase text-white/60 mb-0.5">CVV</p>
                    <p className="font-mono font-medium">{c.cvv}</p>
                  </div>
                )}
              </div>
              
              {/* Card Footer */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-white/70">{c.network}</span>
                <button 
                  className="text-[10px] font-medium text-rose-200 hover:text-white transition-colors active:scale-95"
                  onClick={() => remove(c._id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add New Card">
        <form onSubmit={add} className="space-y-4">
          {/* Security Note */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex gap-2">
              <span className="text-blue-600 flex-shrink-0">🔒</span>
              <p className="text-xs text-blue-800 leading-relaxed">
                Card details are encrypted end-to-end. Your security is our priority.
              </p>
            </div>
          </div>

          {/* Bank & Network */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Bank *</label>
              <select
                className="input"
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                required
              >
                <option value="" disabled>Select bank</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Network *</label>
              <select 
                className="input" 
                value={form.network} 
                onChange={(e) => setForm({ ...form, network: e.target.value })}
              >
                {['Visa', 'Mastercard', 'RuPay', 'Amex', 'Other'].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Card Number */}
          <div>
            <label className="label">Card Number *</label>
            <input
              className="input font-mono"
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              value={form.number}
              onChange={(e) => {
                // Auto-format with spaces
                const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                setForm({ ...form, number: formatted });
              }}
              maxLength={19}
              required
            />
          </div>

          {/* Type, Expiry, CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Card Type *</label>
              <select 
                className="input" 
                value={form.type} 
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="credit">Credit Card</option>
                <option value="debit">Debit Card</option>
              </select>
            </div>
            <div>
              <label className="label">CVV (Optional)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className="input font-mono text-center"
                placeholder="123"
                value={form.cvv}
                onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="label">Expiry Date *</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="1"
                max="12"
                inputMode="numeric"
                placeholder="MM (01-12)"
                className="input text-center"
                value={form.expiryMonth}
                onChange={(e) => setForm({ ...form, expiryMonth: e.target.value })}
                required
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className="input text-center"
                placeholder="YYYY (2028)"
                value={form.expiryYear}
                onChange={(e) => setForm({ ...form, expiryYear: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding Card...
              </span>
            ) : (
              '✓ Add Card Securely'
            )}
          </button>
        </form>
      </Modal>
    </div>
  );
}
