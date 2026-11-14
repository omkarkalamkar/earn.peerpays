import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Spinner, Modal } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';

export default function AdminIssues() {
  const { pushToast } = useNotifications();
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'resolved', 'dismissed'
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [detailModal, setDetailModal] = useState(false);

  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    setLoading(true);
    try {
      const res = await api.get('/ledger/reported-issues');
      setIssues(res.data);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to load issues');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  function openDetailModal(issue) {
    setSelectedIssue(issue);
    setDetailModal(true);
  }

  async function handleUpdateStatus(issueId, newStatus) {
    setBusy(true);
    try {
      await api.patch(`/ledger/issue/${issueId}/status`, {
        status: newStatus,
      });
      
      pushToast(`Issue marked as ${newStatus}`);
      setDetailModal(false);
      setSelectedIssue(null);
      loadIssues(); // Refresh list
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to update issue');
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredIssues = issues
    ? filterStatus === 'all'
      ? issues
      : issues.filter((i) => i.status === filterStatus)
    : [];

  const pendingCount = issues ? issues.filter((i) => i.status === 'pending').length : 0;
  const resolvedCount = issues ? issues.filter((i) => i.status === 'resolved').length : 0;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Reported Issues</h1>
          <p className="text-sm text-slate-500">View and manage user-reported ledger issues</p>
        </div>
        <button
          onClick={loadIssues}
          className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4">
          <p className="text-xs font-medium text-amber-700">Pending Issues</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs font-medium text-emerald-700">Resolved</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{resolvedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <p className="text-xs font-medium text-slate-700">Total Issues</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{issues?.length || 0}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
            filterStatus === 'all'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({issues?.length || 0})
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
            filterStatus === 'pending'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilterStatus('resolved')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
            filterStatus === 'resolved'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500">
            {filterStatus === 'all' ? 'No issues reported yet' : `No ${filterStatus} issues`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <div
              key={issue._id}
              className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition cursor-pointer"
              onClick={() => openDetailModal(issue)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        issue.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : issue.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {issue.status === 'pending' ? '⚠️ Pending' : issue.status === 'resolved' ? '✅ Resolved' : '🚫 Dismissed'}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {issue.entryType === 'order' ? '📦 Order Entry' : '💳 Payment Entry'}
                    </span>
                  </div>

                  <div className="mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Reported by: {issue.reportedBy?.name}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        (@{issue.reportedBy?.username} - {issue.reportedBy?.role})
                      </span>
                    </p>
                  </div>

                  <p className="text-sm text-slate-700 line-clamp-2">{issue.message}</p>

                  <p className="text-xs text-slate-500 mt-2">
                    Reported on: {formatDate(issue.createdAt)}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetailModal(issue);
                  }}
                  className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium flex-shrink-0"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={detailModal}
        onClose={() => {
          setDetailModal(false);
          setSelectedIssue(null);
        }}
        title="Issue Details"
      >
        {selectedIssue && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-medium text-slate-900 capitalize">{selectedIssue.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Entry Type</p>
                  <p className="font-medium text-slate-900 capitalize">{selectedIssue.entryType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reported By</p>
                  <p className="font-medium text-slate-900">{selectedIssue.reportedBy?.name}</p>
                  <p className="text-xs text-slate-500">
                    @{selectedIssue.reportedBy?.username} ({selectedIssue.reportedBy?.role})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reported On</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedIssue.createdAt)}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Issue Description:</p>
              <div className="bg-white border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedIssue.message}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-medium text-blue-900 mb-1">📌 Next Steps:</p>
              <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                <li>Check the ledger entry (ID: {selectedIssue.entryId})</li>
                <li>Contact the user to understand the issue</li>
                <li>Make corrections if needed using Edit Entry</li>
                <li>Mark as resolved once fixed</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  // Copy entry ID to clipboard
                  navigator.clipboard.writeText(selectedIssue.entryId);
                  pushToast('Entry ID copied to clipboard');
                }}
                className="btn-secondary text-xs"
              >
                📋 Copy Entry ID
              </button>
              {selectedIssue.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedIssue._id, 'resolved')}
                    className="flex-1 px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-xs"
                    disabled={busy}
                  >
                    {busy ? 'Updating...' : '✅ Mark as Resolved'}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedIssue._id, 'dismissed')}
                    className="flex-1 px-3 py-2 rounded bg-slate-600 text-white hover:bg-slate-700 font-medium text-xs"
                    disabled={busy}
                  >
                    {busy ? 'Updating...' : '🚫 Dismiss'}
                  </button>
                </>
              )}
              {selectedIssue.status !== 'pending' && (
                <button
                  onClick={() => {
                    setDetailModal(false);
                    setSelectedIssue(null);
                  }}
                  className="btn-primary flex-1 text-xs"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
