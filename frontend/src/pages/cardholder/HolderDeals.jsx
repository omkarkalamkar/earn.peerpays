import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Spinner, EmptyState, Modal, PlatformBadge, money } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';

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
  const [active, setActive] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/deals').then((res) => setDeals(res.data.deals));
    api.get('/cards').then((res) => setCards(res.data.cards));
  }, []);

  const eligibleCards = useMemo(
    () => (active ? cards.filter((c) => cardMatchesDeal(c, active)) : []),
    [active, cards]
  );

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

      <Modal open={!!active} onClose={() => setActive(null)} title="Submit card for this deal">
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
            {cards.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                You have no cards yet.{' '}
                <button className="underline" onClick={() => navigate('/holder/cards')}>
                  Add a card first
                </button>
                .
              </div>
            ) : eligibleCards.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                None of your cards are eligible for this deal. It needs{' '}
                <b>
                  {(active.eligibleBanks || []).join(' / ') || 'any bank'}
                  {(active.eligibleCardTypes || []).length > 0 &&
                    ` (${active.eligibleCardTypes.join(' / ')})`}
                </b>
                .{' '}
                <button className="underline" onClick={() => navigate('/holder/cards')}>
                  Add an eligible card
                </button>
                .
              </div>
            ) : (
              <div>
                <label className="label">Choose card(s) to share</label>
                <div className="space-y-2">
                  {eligibleCards.map((c) => {
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
                  })}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Only eligible cards are shown. Select as many as you want to share.
                </p>
              </div>
            )}
            <button
              className="btn-primary btn-block"
              disabled={busy || selected.length === 0 || eligibleCards.length === 0}
              onClick={submit}
            >
              {busy
                ? 'Submitting...'
                : `Share ${selected.length || ''} card${selected.length === 1 ? '' : 's'} & wait`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
