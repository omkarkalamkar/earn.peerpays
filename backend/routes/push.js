const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/pushController');

router.get('/vapid-public-key', ctrl.publicKey);
router.post('/subscribe', requireAuth, h(ctrl.subscribe));
router.post('/unsubscribe', requireAuth, h(ctrl.unsubscribe));

module.exports = router;
