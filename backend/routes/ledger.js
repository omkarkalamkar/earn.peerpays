const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/ledgerController');

// All authenticated users can view their own ledger
router.get('/my-ledger', requireAuth, h(ctrl.getMyLedger));
router.get('/my-due', requireAuth, h(ctrl.getMyDue));
router.get('/my-stats', requireAuth, h(ctrl.getMyStats));
router.get('/my-payments', requireAuth, h(ctrl.getMyPayments));

// Issue reporting - any authenticated user can report
router.post('/report-issue', requireAuth, h(ctrl.reportIssue));

// Admin endpoints - view all ledgers and manage payments
router.use(requireAuth, requireRole('admin', 'viewer'));

// Read-only (admin + viewer)
router.get('/cardholder/:id/ledger', h(ctrl.getCardholderLedger));
router.get('/cardholder/:id/due', h(ctrl.getCardholderDue));
router.get('/cardholder/:id/stats', h(ctrl.getCardholderStats));

router.get('/booker/:id/ledger', h(ctrl.getBookerLedger));
router.get('/booker/:id/due', h(ctrl.getBookerDue));
router.get('/booker/:id/stats', h(ctrl.getBookerStats));

router.get('/admin/all-ledgers', h(ctrl.getAllLedgers));
router.get('/admin/earnings', h(ctrl.getAdminEarnings));
router.get('/admin/commission-ledger', requireRole('admin'), h(ctrl.getAdminCommissionLedger));
router.post('/admin/commission-ledger', requireRole('admin'), h(ctrl.createAdminCommissionEntry));
router.delete('/admin/commission-ledger/:id', requireRole('admin'), h(ctrl.deleteAdminCommissionEntry));

// Mutations (admin only)
router.post('/payment/cardholder', requireRole('admin'), h(ctrl.recordCardholderPayment));
router.post('/payment/booker', requireRole('admin'), h(ctrl.recordBookerPayment));
router.post('/manual-entry', requireRole('admin'), h(ctrl.addManualLedgerEntry));
router.get('/payments', requireRole('admin'), h(ctrl.listPayments));
router.patch('/payment/:id/status', requireRole('admin'), h(ctrl.updatePaymentStatus));
router.put('/ledger-entry/:id', requireRole('admin'), h(ctrl.updateLedgerEntry));
router.delete('/ledger-entry/:id', requireRole('admin'), h(ctrl.deleteLedgerEntry));
router.delete('/payment/:id', requireRole('admin'), h(ctrl.deletePayment));

// Admin: View all reported issues
router.get('/reported-issues', requireRole('admin'), h(ctrl.getReportedIssues));
router.patch('/issue/:id/status', requireRole('admin'), h(ctrl.updateIssueStatus));

module.exports = router;
