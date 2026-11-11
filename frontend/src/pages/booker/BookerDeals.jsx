import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Spinner, EmptyState, PlatformBadge, Modal, money } from '../../components/ui';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useNotifications } from '../../context/NotificationContext';

function ts(x) {
  return x?.createdAt ? new Date(x.createdAt).getTime() : 0;
}

/**
 * Group submissions by card holder (holderRef), keeping a holder's cards together and
 * ordering holders first-come-first-serve (whoever shared earliest appears first).
 */
function groupByHolder(items) {
  const map = new Map();
  (items || []).forEach((s) => {
    const key = s.holderRef || s._id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  const entries = [...map.entries()];
  entries.forEach(([, arr]) => arr.sort((a, b) => ts(a) - ts(b)));
  entries.sort((a, b) => ts(a[1][0]) - ts(b[1][0]));
  return entries;
}

export default function BookerDeals() {
  const { pushToast } = useNotifications();
  const navigate = useNavigate();
  const [subs, setSubs] = useState(null);
  const [openDeal, setOpenDeal] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.get('/bookings/available').then((res) => setSubs(res.data.bookings));
  }
  useEffect(load, []);

  useSocketEvent('booking:new', load, []);
  useSocketEvent('booking:taken', load, []);
  useSocketEvent('deal:new', load, []);

  const groups = useMemo(() => {
    const map = new Map();
    (subs || []).forEach((s) => {
      const id = s.deal?._id;
      if (!map.has(id)) map.set(id, { deal: s.deal, items: [] });
      map.get(id).items.push(s);
    });
    const arr = [...map.values()];
    // First-come-first-serve: order cards and deals by earliest submission time.
    arr.forEach((g) => g.items.sort((a, b) => ts(a) - ts(b)));
    arr.sort((a, b) => ts(a.items[0]) - ts(b.items[0]));
    return arr;
  }, [subs]);

  async function reveal(booking) {
    try {
      const res = await api.get(`/bookings/${booking._id}/card`);
      setRevealed({ booking, card: res.data.card });
    } catch (err) {
      pushToast(err.response?.data?.message || 'Cannot view card');
    }
  }

  async function acceptAll(items) {
    const bookingIds = items.map((s) => s._id);
    setBusyId(items[0]?._id);
    try {
      await api.post('/bookings/accept-many', { bookingIds });
      pushToast(`Accepted ${bookingIds.length} card(s). Open My Orders to send the OTP.`);
      setRevealed(null);
      setOpenDeal(null);
      navigate('/booker/orders');
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to accept');
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectAll(items) {
    setBusyId(items[0]?._id);
    try {
      const ids = new Set(items.map((s) => s._id));
      for (const s of items) {
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/bookings/${s._id}/reject`).catch(() => {});
      }
      pushToast(`Rejected ${items.length} card(s).`);
      setRevealed(null);
      pruneOpenDeal(ids);
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  }

  function pruneOpenDeal(idSet) {
    setOpenDeal((d) => {
      if (!d) return d;
      const items = d.items.filter((x) => !idSet.has(x._id));
      return items.length ? { ...d, items } : null;
    });
  }

  async function rejectOne(s) {
    setBusyId(s._id);
    try {
      await api.post(`/bookings/${s._id}/reject`);
      pushToast('Card rejected. It cannot be re-submitted to this deal.');
      setRevealed(null);
      pruneOpenDeal(new Set([s._id]));
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  }

  if (!subs) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Available Deals</h1>
        <p className="text-sm text-slate-500">
          Deals with card holders waiting. Open one to view submissions and shared cards.
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No submissions waiting" subtitle="New card submissions will appear here in real time." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.deal?._id} className="card flex flex-col p-3.5">
              <div className="mb-1.5">
                <PlatformBadge platform={g.deal?.platform} />
              </div>
              <h3 className="text-[15px] font-semibold leading-snug text-navy-900">{g.deal?.title}</h3>
              <p className="text-[13px] text-slate-500">{g.deal?.product}</p>
              <p className="mt-1.5 text-lg font-bold text-navy-900">{money(g.deal?.price || 0)}</p>
              {g.deal?.offerDetails && <p className="mt-1.5 line-clamp-2 text-[13px] text-slate-500">{g.deal.offerDetails}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="chip bg-amber-100 text-amber-700">{g.items.length} waiting</span>
                <button className="btn-primary" onClick={() => setOpenDeal(g)}>
                  View users
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submissions for a deal, grouped per card holder */}
      <Modal open={!!openDeal} onClose={() => setOpenDeal(null)} title={openDeal?.deal?.title || 'Submissions'}>
        {openDeal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Finish one card holder at a time — review their cards, then accept or reject them together.
            </p>
            {groupByHolder(openDeal.items).map(([ref, items], idx) => (
              <div key={ref} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="chip bg-brand-100 text-brand-700">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {items[0]?.holderUsername || ref}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Shared {items[0]?.createdAt ? new Date(items[0].createdAt).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                  <span className="chip bg-amber-100 text-amber-700">{items.length} card(s)</span>
                </div>
                <div className="space-y-2">
                  {items.map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                    >
                      <p className="text-xs text-slate-500">
                        #{s.ref} · {s.card?.bank} {s.card?.type} ****{s.card?.last4}
                      </p>
                      <div className="flex gap-1">
                        <button className="btn-secondary btn-xs" onClick={() => reveal(s)}>
                          View
                        </button>
                        <button
                          className="btn-danger btn-xs"
                          disabled={!!busyId}
                          onClick={() => rejectOne(s)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-success flex-1"
                    disabled={!!busyId}
                    onClick={() => acceptAll(items)}
                  >
                    Accept all {items.length} card(s)
                  </button>
                  <button className="btn-danger" disabled={!!busyId} onClick={() => rejectAll(items)}>
                    Reject all
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Revealed full card + offer check */}
      <Modal open={!!revealed} onClose={() => setRevealed(null)} title="Shared card details">
        {revealed && (
          <div className="space-y-4">
            <div className="brand-gradient rounded-xl p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase">{revealed.card.bank}</span>
                <span className="chip bg-white/20 text-white">{revealed.card.type}</span>
              </div>
              <p className="mt-5 select-all font-mono text-lg tracking-widest">{revealed.card.number}</p>
              <div className="mt-4 flex justify-between text-sm">
                <div>
                  <p className="text-[10px] uppercase text-slate-300">Holder</p>
                  <p>{revealed.card.holderName}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-300">Expires</p>
                  <p>
                    {String(revealed.card.expiryMonth).padStart(2, '0')}/{String(revealed.card.expiryYear).slice(-2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-300">CVV</p>
                  <p className="select-all font-mono">{revealed.card.cvv || '—'}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Verify the offer applies to this card. If it doesn’t, reject it here — the card holder
              won’t be able to re-submit this card to this deal.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setRevealed(null)}>
                Close
              </button>
              <button
                className="btn-danger"
                disabled={!!busyId}
                onClick={() => rejectOne(revealed.booking)}
              >
                Reject card
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
