const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/dealController');

router.use(requireAuth);

router.get('/', h(ctrl.listDeals));
router.get('/:id', h(ctrl.getDeal));
router.post('/', requireRole('admin'), h(ctrl.createDeal));
router.put('/:id', requireRole('admin'), h(ctrl.updateDeal));
router.delete('/:id', requireRole('admin'), h(ctrl.deleteDeal));

module.exports = router;
