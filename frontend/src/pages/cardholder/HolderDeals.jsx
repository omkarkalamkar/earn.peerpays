import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Spinner, EmptyState, Modal, PlatformBadge, money } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { BANKS } from '../../constants';

/** A card is eligible for a deal when it matches the deal's bank(s) and card type(s). */
function cardMatchesDeal(card, deal) {
  if (!deal) return true;
  const banks = deal.eligibleBanks || [];
  const types = deal.eligibleCardTypes || [];
  const bankOk =
    banks.length === 0 ||
    banks.some((b) => {
      const a = String(b).toLowerCase().trim();
      const c = String(card.bank).toLowerCase().trim();
      return a === c || c.includes(a) || a.includes(c);
    });
  const typeOk = types.length === 0 || types.includes(card.type);
  return bankOk && typeOk;
}

export default function HolderDeals() {
  const { pushToast } = useNotifications();
  const navigate = useNavigate();
  const [deals, setDeals] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [active, setActive] = useState(null);
  const [selected, setSelected] = useState([]);
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCards, setNewCards] = useState([{
    cardName: '',
    bank: '',
    network: 'Visa',
    type: 'credit',
    number: '',
    cvv: '',
    expiryMonth: '',
    expiryYear: '',
    saveThisCard: false,
  }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/deals').then((res) => setDeals(res.data.deals));
    api.get('/cards').then((res) => setCards(res.data.cards));
  }, []);

  const eligibleCards = useMemo(
    () => (active ? cards.filter((c) => cardMatchesDeal(c, active)) : []),
    [active, cards]
  );

  // Filter cards based on search query
  const filteredEligibleCards = useMemo(() => {
    if (!cardSearchQuery.trim()) return eligibleCards;
    
    const query = cardSearchQuery.toLowerCase();
    return eligibleCards.filter((c) => {
      // Build searchable text from all card properties
      const parts = [
        c.cardName || '',
        c.bank || '',
        c.type || '',
        c.masked || '',
        c.last4 || '',
        c.network || '',
      ];
      const searchText = parts.join(' ').toLowerCase();
      return searchText.includes(query);
    });
  }, [eligibleCards, cardSearchQuery]);

  function openSubmit(deal) {
    setActive(deal);
    // Pre-select all eligible cards by default (holder can deselect any).
    setSelected(cards.filter((c) => cardMatchesDeal(c, deal)).map((c) => c._id));
  }

  function toggleCard(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post('/bookings', { dealId: active._id, cardIds: selected });
      const n = res.data.bookings?.length || 0;
      const rej = res.data.rejected || 0;
      pushToast(
        `${n} card(s) submitted! Waiting for a booker to accept.` +
          (rej > 0 ? ` ${rej} card(s) were skipped (already rejected for this deal).` : '')
      );
      setActive(null);
      navigate('/holder/bookings');
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to submit');
    } finally {
      setBusy(false);
    }
  }

  async function submitWithNewCard() {
    setBusy(true);
    try {
      const bookingResults = [];
      
      for (const cardForm of newCards) {
        // Validate each card
        const m = Number(cardForm.expiryMonth);
        let y = Number(cardForm.expiryYear);
        if (Number.isInteger(y) && y >= 0 && y < 100) y += 2000;
        
        if (!cardForm.bank || !cardForm.number) {
          pushToast('Please fill all card details');
          setBusy(false);
          return;
        }
        
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          pushToast('Expiry month must be between 1 and 12');
          setBusy(false);
          return;
        }
        
        const now = new Date();
        if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
          pushToast('Card has expired — expiry must be this month or later');
          setBusy(false);
          return;
        }

        let cardId;
        
        // If save checkbox is checked for this card, save it first
        if (cardForm.saveThisCard) {
          const savedCard = await api.post('/cards', {
            ...cardForm,
            holderName: cardForm.bank,
            expiryMonth: m,
            expiryYear: y,
          });
          cardId = savedCard.data.card._id;
        }

        // Submit booking
        const payload = cardForm.saveThisCard
          ? { dealId: active._id, cardIds: [cardId] }
          : {
              dealId: active._id,
              cardData: {
                ...cardForm,
                holderName: cardForm.bank,
                expiryMonth: m,
                expiryYear: y,
              },
            };

        const res = await api.post('/bookings', payload);
        bookingResults.push(res.data);
      }
      
      const totalSaved = newCards.filter(c => c.saveThisCard).length;
      pushToast(
        `${newCards.length} card(s) submitted! ${totalSaved > 0 ? `${totalSaved} saved to your account.` : ''} Waiting for a booker to accept.`
      );
      
      setActive(null);
      setShowNewCardForm(false);
      setNewCards([{
        cardName: '',
        bank: '',
        network: 'Visa',
        type: 'credit',
        number: '',
        cvv: '',
        expiryMonth: '',
        expiryYear: '',
        saveThisCard: false,
      }]);
      navigate('/holder/bookings');
      
      // Reload cards if we saved any
      if (totalSaved > 0) {
        api.get('/cards').then((res) => setCards(res.data.cards));
      }
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to submit');
    } finally {
      setBusy(false);
    }
  }

  function addAnotherCard() {
    setNewCards([
      ...newCards,
      {
        cardName: '',
        bank: '',
        network: 'Visa',
        type: 'credit',
        number: '',
        cvv: '',
        expiryMonth: '',
        expiryYear: '',
        saveThisCard: false,
      },
    ]);
  }

  function removeCard(index) {
    if (newCards.length === 1) {
      pushToast('Need at least one card');
      return;
    }
    setNewCards(newCards.filter((_, i) => i !== index));
  }

  function updateCard(index, field, value) {
    const updated = [...newCards];
    updated[index] = { ...updated[index], [field]: value };
    setNewCards(updated);
  }

  if (!deals) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Available Deals</h1>
        <p className="text-sm text-slate-500">Pick a deal and submit an eligible card to book it.</p>
      </div>

      {deals.length === 0 ? (
        <EmptyState title="No open deals right now" subtitle="Check back soon." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <div key={d._id} className="card flex flex-col p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <PlatformBadge platform={d.platform} />
              </div>
              <h3 className="text-[15px] font-semibold leading-snug text-navy-900">{d.title}</h3>
              <p className="text-[13px] text-slate-500">{d.product}</p>
              <p className="mt-1.5 text-lg font-bold text-navy-900">{money(d.price)}</p>
              {d.profit > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5">
                  <span className="text-xs font-medium text-emerald-700">You earn</span>
                  <span className="text-base font-extrabold text-emerald-700">{money(d.profit)}</span>
                </div>
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
              <button className="btn-primary mt-3 w-full" onClick={() => openSubmit(d)}>
                Submit a card
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!active} onClose={() => {
        setActive(null);
        setCardSearchQuery('');
        setShowNewCardForm(false);
        setSaveCard(false);
      }} title="Submit card for this deal">
        {active && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-700">{active.title}</p>
              <p className="text-slate-500">
                {active.product} - {money(active.price)}
              </p>
              {active.profit > 0 && (
                <p className="mt-1 font-semibold text-emerald-700">You earn {money(active.profit)}</p>
              )}
            </div>

            {!showNewCardForm ? (
              <>
                {cards.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                    You have no saved cards yet.
                  </div>
                ) : eligibleCards.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                    None of your saved cards are eligible for this deal. It needs{' '}
                    <b>
                      {(active.eligibleBanks || []).join(' / ') || 'any bank'}
                      {(active.eligibleCardTypes || []).length > 0 &&
                        ` (${active.eligibleCardTypes.join(' / ')})`}
                    </b>
                    .
                  </div>
                ) : (
                  <div>
                    <label className="label">Choose from saved cards</label>
                    
                    {/* Search Box */}
                    {eligibleCards.length > 5 && (
                      <div className="mb-3">
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder="🔍 Search cards by name, bank, type..."
                          value={cardSearchQuery}
                          onChange={(e) => setCardSearchQuery(e.target.value)}
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {filteredEligibleCards.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                          {cardSearchQuery ? 'No cards match your search' : 'No eligible cards'}
                        </p>
                      ) : (
                        filteredEligibleCards.map((c) => {
                          const on = selected.includes(c._id);
                          return (
                            <button
                              type="button"
                              key={c._id}
                              onClick={() => toggleCard(c._id)}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                                on
                                  ? 'border-brand-500 bg-brand-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <span>
                                {c.cardName && (
                                  <span className="font-semibold text-brand-600 block text-xs">{c.cardName}</span>
                                )}
                                <span className="font-medium text-slate-700">
                                  {c.bank} {c.type}
                                </span>
                                <span className="ml-2 font-mono text-slate-400">{c.masked}</span>
                              </span>
                              <span
                                className={`grid h-5 w-5 place-items-center rounded border ${
                                  on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'
                                }`}
                              >
                                {on && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    {selected.length > 0 && (
                      <button
                        className="btn-primary btn-block mt-3"
                        disabled={busy}
                        onClick={submit}
                      >
                        {busy
                          ? 'Submitting...'
                          : `Share ${selected.length} card${selected.length === 1 ? '' : 's'} & wait`}
                      </button>
                    )}
                  </div>
                )}
                
                <div className="border-t border-slate-200 pt-3">
                  <button
                    className="btn-primary btn-block flex items-center justify-center gap-2"
                    onClick={() => setShowNewCardForm(true)}
                  >
                    <span className="text-lg">💳</span>
                    <span>Use a New Card (Don't need to save)</span>
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    Share directly without saving to your account
                  </p>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitWithNewCard(); }} className="space-y-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    🔒 Card details are encrypted. Share multiple cards at once!
                  </p>
                </div>

                {newCards.map((cardForm, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-3 relative">
                    {newCards.length > 1 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700">Card {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeCard(index)}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label text-xs">Bank *</label>
                        <select
                          className="input text-sm"
                          value={cardForm.bank}
                          onChange={(e) => updateCard(index, 'bank', e.target.value)}
                          required
                        >
                          <option value="" disabled>Select</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Type *</label>
                        <select 
                          className="input text-sm" 
                          value={cardForm.type} 
                          onChange={(e) => updateCard(index, 'type', e.target.value)}
                        >
                          <option value="credit">Credit</option>
                          <option value="debit">Debit</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label text-xs">Card Nickname (Optional)</label>
                      <input
                        className="input text-sm"
                        placeholder="e.g., My SBI Card"
                        value={cardForm.cardName}
                        onChange={(e) => updateCard(index, 'cardName', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="label text-xs">Card Number *</label>
                      <input
                        className="input font-mono text-sm"
                        inputMode="numeric"
                        placeholder="1234 5678 9012 3456"
                        value={cardForm.number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                          const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                          updateCard(index, 'number', formatted);
                        }}
                        maxLength={19}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">MM *</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          inputMode="numeric"
                          placeholder="01-12"
                          className="input text-center text-sm"
                          value={cardForm.expiryMonth}
                          onChange={(e) => updateCard(index, 'expiryMonth', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label text-xs">YYYY *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          className="input text-center text-sm"
                          placeholder="2028"
                          value={cardForm.expiryYear}
                          onChange={(e) => updateCard(index, 'expiryYear', e.target.value.replace(/\D/g, ''))}
                          required
                        />
                      </div>
                      <div>
                        <label className="label text-xs">CVV (Optional)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          className="input font-mono text-center text-sm"
                          placeholder="123"
                          value={cardForm.cvv}
                          onChange={(e) => updateCard(index, 'cvv', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                      <input
                        type="checkbox"
                        id={`saveCard-${index}`}
                        checked={cardForm.saveThisCard}
                        onChange={(e) => updateCard(index, 'saveThisCard', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      <label htmlFor={`saveCard-${index}`} className="text-sm text-slate-700 cursor-pointer">
                        💾 Save this card for future use
                      </label>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addAnotherCard}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:border-brand-500 hover:text-brand-600 transition"
                >
                  + Add Another Card
                </button>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={() => {
                      setShowNewCardForm(false);
                      setNewCards([{
                        bank: '',
                        network: 'Visa',
                        type: 'credit',
                        number: '',
                        cvv: '',
                        expiryMonth: '',
                        expiryYear: '',
                        saveThisCard: false,
                      }]);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={busy}
                  >
                    {busy ? 'Submitting...' : `✓ Share ${newCards.length} Card${newCards.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
