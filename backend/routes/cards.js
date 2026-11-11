const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/cardController');

router.use(requireAuth, requireRole('cardholder'));

router.get('/', h(ctrl.listMyCards));
router.post('/', h(ctrl.createCard));
router.delete('/:id', h(ctrl.deleteCard));

module.exports = router;
