import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, money } from '../../components/ui';

export default function AdminOverview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/deals'),
      api.get('/admin/users'),
      api.get('/admin/orders/confirmed'),
      api.get('/admin/cardholders/with-orders'),
    ]).then(([deals, users, orders, holders]) => {
      setData({
        deals: deals.data.deals,
        users: users.data.users,
        orders: orders.data.bookings,
        holders: holders.data.cardHolders,
      });
    });
  }, []);

  if (!data) return <Spinner />;

  const cardholders = data.users.filter((u) => u.role === 'cardholder').length;
  const bookers = data.users.filter((u) => u.role === 'booker').length;
  const revenue = data.orders.reduce((s, o) => s + (o.deal?.price || 0), 0);

  const stats = [
    { label: 'Open Deals', value: data.deals.filter((d) => d.status === 'open').length },
    { label: 'Card Holders', value: cardholders },
    { label: 'Bookers', value: bookers },
    { label: 'Confirmed Orders', value: data.orders.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Overview</h1>
        <p className="text-sm text-slate-500">A snapshot of your platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[13px] text-slate-500">{s.label}</p>
            <p className="mt-0.5 text-2xl font-extrabold text-navy-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <p className="text-[13px] text-slate-500">Total order value (confirmed)</p>
        <p className="mt-0.5 text-xl font-bold text-emerald-600">{money(revenue)}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Card holders with confirmed orders</h2>
        </div>
        {data.holders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No confirmed orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2">Card Holder</th>
                <th className="px-5 py-2">Username</th>
                <th className="px-5 py-2">Orders</th>
                <th className="px-5 py-2">Last order</th>
              </tr>
            </thead>
            <tbody>
              {data.holders.map((h) => (
                <tr key={h._id} className="border-t border-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{h.user.name}</td>
                  <td className="px-5 py-2.5 text-slate-500">@{h.user.username}</td>
                  <td className="px-5 py-2.5">
                    <span className="chip bg-emerald-100 text-emerald-700">{h.orderCount}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {h.lastOrderAt ? new Date(h.lastOrderAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
