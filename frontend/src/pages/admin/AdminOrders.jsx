import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, PlatformBadge, Modal, money } from '../../components/ui';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useAuth } from '../../context/AuthContext';

export default function AdminOrders() {
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const [orders, setOrders] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('holder'); // 'holder' | 'product'
  const [deleting, setDeleting] = useState(null);
  const [openProduct, setOpenProduct] = useState({});
  const [openHolder, setOpenHolder] = useState({});

  function load() {
    api.get('/admin/orders/confirmed').then((res) => setOrders(res.data.bookings));
  }
  useEffect(load, []);
  useSocketEvent('order:completed', load, []);
  useSocketEvent('order:deleted', load, []);

  async function deleteOrder(o) {
    const label = `${o.deal?.product || 'this order'} (${o.cardHolder?.name || ''})`;
    if (!window.confirm(`Delete ${label}? This removes it from Confirmed Orders (analytics totals are kept).`)) return;
    setDeleting(o._id);
    try {
      await api.delete(`/admin/orders/${o._id}`);
      setOrders((list) => (list ? list.filter((x) => x._id !== o._id) : list));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  // Flat grouping for the "By Card Holder" view.
  const holderGroups = useMemo(() => {
    if (!orders) return [];
    const map = new Map();
    orders.forEach((o) => {
      const key = o.cardHolder?._id || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: o.cardHolder?.name || 'Unknown',
          subtitle: `@${o.cardHolder?.username || '?'}`,
          items: [],
          total: 0,
        });
      }
      const g = map.get(key);
      g.items.push(o);
      g.total += o.deal?.price || 0;
    });
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [orders]);

  // Nested grouping for the "By Product" view: Product -> Card holder -> orders.
  const productGroups = useMemo(() => {
    if (!orders) return [];
    const map = new Map();
    orders.forEach((o) => {
      const pKey = o.deal?._id ? String(o.deal._id) : `p:${o.deal?.product || 'unknown'}`;
      if (!map.has(pKey)) {
        map.set(pKey, {
          key: pKey,
          title: o.deal?.title || o.deal?.product || 'Unknown product',
          product: o.deal?.product,
          platform: o.deal?.platform,
          price: o.deal?.price || 0,
          holders: new Map(),
          count: 0,
          total: 0,
        });
      }
      const p = map.get(pKey);
      p.count += 1;
      p.total += o.deal?.price || 0;

      const hKey = o.cardHolder?._id || 'unknown';
      if (!p.holders.has(hKey)) {
        p.holders.set(hKey, {
          key: hKey,
          name: o.cardHolder?.name || 'Unknown',
          username: o.cardHolder?.username || '?',
          items: [],
          total: 0,
        });
      }
      const h = p.holders.get(hKey);
      h.items.push(o);
      h.total += o.deal?.price || 0;
    });
    return [...map.values()]
      .map((p) => ({
        ...p,
        holders: [...p.holders.values()].sort((a, b) => b.items.length - a.items.length),
      }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  if (!orders) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Confirmed Orders</h1>
          <p className="text-sm text-slate-500">All successfully placed orders with proof.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button
            onClick={() => setMode('holder')}
            className={`rounded-md px-3 py-1.5 font-medium ${
              mode === 'holder' ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            By Card Holder
          </button>
          <button
            onClick={() => setMode('product')}
            className={`rounded-md px-3 py-1.5 font-medium ${
              mode === 'product' ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            By Product
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No confirmed orders yet" />
      ) : mode === 'holder' ? (
        <div className="space-y-4">
          {holderGroups.map((g) => (
            <div key={g.key} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
                <div>
                  <p className="font-semibold text-navy-900">{g.title}</p>
                  <p className="text-xs text-slate-400">{g.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip bg-brand-100 text-brand-700">{g.items.length} order(s)</span>
                  <span className="chip bg-emerald-100 text-emerald-700">{money(g.total)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-2">Product</th>
                      <th className="px-5 py-2">Booker</th>
                      <th className="px-5 py-2">Card</th>
                      <th className="px-5 py-2">Value</th>
                      <th className="px-5 py-2">Completed</th>
                      <th className="px-5 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((o) => (
                      <OrderRow
                        key={o._id}
                        o={o}
                        showProduct
                        readOnly={readOnly}
                        deleting={deleting}
                        onProof={setPreview}
                        onDelete={deleteOrder}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {productGroups.map((p) => {
            const pOpen = openProduct[p.key] ?? false;
            return (
              <div key={p.key} className="card overflow-hidden">
                <button
                  onClick={() => setOpenProduct((s) => ({ ...s, [p.key]: !pOpen }))}
                  className="flex w-full items-center justify-between gap-2 bg-slate-50 px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Chevron open={pOpen} />
                    {p.platform && <PlatformBadge platform={p.platform} />}
                    <div>
                      <p className="font-semibold text-navy-900">{p.title}</p>
                      <p className="text-xs text-slate-400">
                        {p.holders.length} card holder(s) · {p.product}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="chip bg-brand-100 text-brand-700">{p.count} order(s)</span>
                    <span className="chip bg-emerald-100 text-emerald-700">{money(p.total)}</span>
                  </div>
                </button>

                {pOpen && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {p.holders.map((h) => {
                      const hKey = `${p.key}::${h.key}`;
                      const hOpen = openHolder[hKey] ?? false;
                      return (
                        <div key={hKey}>
                          <button
                            onClick={() => setOpenHolder((s) => ({ ...s, [hKey]: !hOpen }))}
                            className="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <Chevron open={hOpen} small />
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{h.name}</p>
                                <p className="text-[11px] text-slate-400">@{h.username}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="chip bg-slate-100 text-slate-600">{h.items.length}</span>
                              <span className="chip bg-emerald-50 text-emerald-700">{money(h.total)}</span>
                            </div>
                          </button>

                          {hOpen && (
                            <div className="overflow-x-auto bg-slate-50/50 px-2 pb-2">
                              <table className="w-full min-w-[34rem] text-sm">
                                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                                  <tr>
                                    <th className="px-3 py-2">Booker</th>
                                    <th className="px-3 py-2">Card</th>
                                    <th className="px-3 py-2">Value</th>
                                    <th className="px-3 py-2">Completed</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {h.items.map((o) => (
                                    <OrderRow
                                      key={o._id}
                                      o={o}
                                      readOnly={readOnly}
                                      deleting={deleting}
                                      onProof={setPreview}
                                      onDelete={deleteOrder}
                                      compact
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Order screenshot">
        {preview && <img src={preview} alt="order proof" className="w-full rounded-lg" />}
      </Modal>
    </div>
  );
}

function OrderRow({ o, showProduct, readOnly, deleting, onProof, onDelete, compact }) {
  const pad = compact ? 'px-3 py-2' : 'px-5 py-2.5';
  return (
    <tr className="border-t border-slate-50">
      {showProduct && (
        <td className={pad}>
          <span className="flex items-center gap-2">
            <PlatformBadge platform={o.deal?.platform} />
            <span className="font-medium text-slate-700">{o.deal?.product}</span>
          </span>
        </td>
      )}
      <td className={`${pad} text-slate-500`}>{o.booker?.name || '-'}</td>
      <td className={`${pad} text-slate-500`}>
        {o.card?.bank} ****{o.card?.last4}
      </td>
      <td className={`${pad} font-medium text-slate-700`}>{money(o.deal?.price || 0)}</td>
      <td className={`${pad} text-slate-500`}>
        {o.completedAt ? new Date(o.completedAt).toLocaleDateString() : '-'}
      </td>
      <td className={`${pad} text-right`}>
        <div className="flex items-center justify-end gap-3">
          {o.screenshotUrl && (
            <button className="text-brand-600 underline hover:text-brand-700" onClick={() => onProof(o.screenshotUrl)}>
              Proof
            </button>
          )}
          {!readOnly && (
            <button
              className="text-rose-600 underline hover:text-rose-700 disabled:opacity-50"
              disabled={deleting === o._id}
              onClick={() => onDelete(o)}
            >
              {deleting === o._id ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function Chevron({ open, small }) {
  const size = small ? 14 : 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
