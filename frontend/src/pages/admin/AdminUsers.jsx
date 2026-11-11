import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, Modal } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const EMPTY = { name: '', username: '', password: '', phone: '', role: 'cardholder' };

export default function AdminUsers() {
  const { pushToast } = useNotifications();
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  function load() {
    api.get('/admin/users').then((res) => setUsers(res.data.users));
  }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/admin/users', form);
      setCreated({ ...form });
      pushToast(`${form.role} account created`);
      setForm(EMPTY);
      setModal(false);
      load();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to create user');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u) {
    await api.patch(`/admin/users/${u._id}/active`, { active: !u.active });
    load();
  }

  if (!users) return <Spinner />;
  const accounts = users.filter((u) => u.role !== 'admin');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Users</h1>
          <p className="text-sm text-slate-500">
            {readOnly ? 'Card holder and booker accounts (view only).' : 'Create card holder and booker accounts.'}
          </p>
        </div>
        {!readOnly && (
          <button
            className="btn-primary"
            onClick={() => {
              setForm(EMPTY);
              setModal(true);
            }}
          >
            + Create User
          </button>
        )}
      </div>

      {created && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-emerald-800">Account created - share these credentials:</p>
          <p className="mt-1 text-emerald-700">
            Username: <b>{created.username}</b> &nbsp;|&nbsp; Password: <b>{created.password}</b> &nbsp;|&nbsp;
            Role: <b>{created.role}</b>
          </p>
          <button className="mt-2 text-xs text-emerald-700 underline" onClick={() => setCreated(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-2">Name</th>
              <th className="px-5 py-2">Username</th>
              <th className="px-5 py-2">Role</th>
              <th className="px-5 py-2">Phone</th>
              <th className="px-5 py-2">Status</th>
              {!readOnly && <th className="px-5 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {accounts.map((u) => (
              <tr key={u._id} className="border-t border-slate-50">
                <td className="px-5 py-2.5 font-medium text-slate-700">{u.name}</td>
                <td className="px-5 py-2.5 text-slate-500">@{u.username}</td>
                <td className="px-5 py-2.5">
                  <span className={`chip ${u.role === 'booker' ? 'bg-purple-100 text-purple-700' : 'bg-brand-50 text-brand-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-slate-500">{u.phone || '-'}</td>
                <td className="px-5 py-2.5">
                  <span className={`chip ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {u.active ? 'active' : 'disabled'}
                  </span>
                </td>
                {!readOnly && (
                  <td className="px-5 py-2.5 text-right">
                    <button className="text-sm text-slate-500 underline hover:text-slate-700" onClick={() => toggle(u)}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="px-5 py-8 text-center text-slate-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create User">
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="cardholder">Card Holder</option>
                <option value="booker">Booker</option>
              </select>
            </div>
          </div>
          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
