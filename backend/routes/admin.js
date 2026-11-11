const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

// Admins and read-only viewers may reach these routes; writes are gated to 'admin' below.
router.use(requireAuth, requireRole('admin', 'viewer'));

// Read-only (admin + viewer)
router.get('/users', h(ctrl.listUsers));
router.get('/orders/confirmed', h(ctrl.confirmedOrders));
router.get('/cardholders/with-orders', h(ctrl.cardHoldersWithOrders));
router.get('/analytics', h(ctrl.analytics));

// Mutations (admin only)
router.post('/users', requireRole('admin'), h(ctrl.createUser));
router.patch('/users/:id/active', requireRole('admin'), h(ctrl.setUserActive));
router.delete('/orders/:id', requireRole('admin'), h(ctrl.deleteOrder));

module.exports = router;
