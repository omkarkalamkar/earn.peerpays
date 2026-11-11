import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, PlatformBadge, money } from '../../components/ui';
import { useSocketEvent } from '../../hooks/useSocketEvent';

const PIPELINE_LABELS = {
  SUBMITTED: 'Waiting for booker',
  ACCEPTED: 'Accepted',
  CONFIRMED: 'Confirmed',
  OTP_REQUESTED: 'Placing order',
  OTP_APPROVED: 'Awaiting OTP',
  OTP_SUBMITTED: 'OTP entered',
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);

  function load() {
    api.get('/admin/analytics').then((res) => setData(res.data));
  }
  useEffect(load, []);
  useSocketEvent('order:completed', load, []);
  useSocketEvent('order:deleted', load, []);

  if (!data) return <Spinner />;

  const stats = [
    { label: 'Total orders (all time)', value: data.totals.orders, tone: 'text-navy-900' },
    { label: 'Total order value', value: money(data.totals.value), tone: 'text-navy-900' },
    { label: 'Total profit paid', value: money(data.totals.profit), tone: 'text-emerald-600' },
    { label: 'Active in pipeline', value: data.pipeline.total, tone: 'text-amber-600' },
  ];

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.orders));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Analytics</h1>
        <p className="text-sm text-slate-500">
          All-time totals — preserved even after orders or deals are deleted.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[13px] text-slate-500">{s.label}</p>
            <p className={`mt-0.5 text-2xl font-extrabold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Today / This month */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[13px] font-semibold text-slate-500">Today</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-2xl font-extrabold text-navy-900">{data.today.orders}</p>
              <p className="text-xs text-slate-400">orders</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">{money(data.today.value)}</p>
              <p className="text-xs text-emerald-600">+{money(data.today.profit)} profit</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[13px] font-semibold text-slate-500">This month</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-2xl font-extrabold text-navy-900">{data.month.orders}</p>
              <p className="text-xs text-slate-400">orders</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">{money(data.month.value)}</p>
              <p className="text-xs text-emerald-600">+{money(data.month.profit)} profit</p>
            </div>
          </div>
        </div>
      </div>

      {/* By platform */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Orders by platform</h2>
        {data.byPlatform.length === 0 ? (
          <p className="text-sm text-slate-400">No completed orders yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.byPlatform.map((p) => (
              <div key={p.platform} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={p.platform} />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{p.orders} order(s)</p>
                    <p className="text-xs text-emerald-600">+{money(p.profit)} profit</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-navy-900">{money(p.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily trend (last 30 days) */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Daily orders (last 30 days)</h2>
        {data.daily.length === 0 ? (
          <p className="text-sm text-slate-400">No data yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-1 overflow-x-auto">
            {data.daily.map((d) => (
              <div key={d.date} className="flex min-w-[10px] flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.orders} order(s), ${money(d.value)}`}>
                <div
                  className="w-full rounded-t bg-brand-400"
                  style={{ height: `${Math.round((d.orders / maxDaily) * 100)}%`, minHeight: d.orders ? 4 : 0 }}
                />
                <span className="mt-1 hidden text-[9px] text-slate-400 sm:block">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live pipeline */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Active pipeline</h2>
        {data.pipeline.total === 0 ? (
          <p className="text-sm text-slate-400">Nothing in progress right now.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.pipeline.byStatus).map(([status, count]) => (
              <span key={status} className="chip bg-slate-100 text-slate-600">
                {PIPELINE_LABELS[status] || status}: <b className="ml-1 text-slate-800">{count}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Top card holders</h2>
          </div>
          {data.topHolders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2">Card holder</th>
                  <th className="px-5 py-2">Orders</th>
                  <th className="px-5 py-2">Earned</th>
                </tr>
              </thead>
              <tbody>
                {data.topHolders.map((h) => (
                  <tr key={h.id} className="border-t border-slate-50">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-slate-700">{h.name}</span>
                      <span className="text-slate-400"> @{h.username}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="chip bg-brand-100 text-brand-700">{h.orders}</span>
                    </td>
                    <td className="px-5 py-2.5 font-medium text-emerald-600">{money(h.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Top bookers</h2>
          </div>
          {data.topBookers.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2">Booker</th>
                  <th className="px-5 py-2">Orders</th>
                  <th className="px-5 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.topBookers.map((b) => (
                  <tr key={b.id} className="border-t border-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-700">{b.name || '-'}</td>
                    <td className="px-5 py-2.5">
                      <span className="chip bg-purple-100 text-purple-700">{b.orders}</span>
                    </td>
                    <td className="px-5 py-2.5 font-medium text-slate-700">{money(b.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
