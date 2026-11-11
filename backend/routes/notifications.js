const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', h(ctrl.listMine));
router.patch('/:id/read', h(ctrl.markRead));
router.post('/read-all', h(ctrl.markAllRead));

module.exports = router;
