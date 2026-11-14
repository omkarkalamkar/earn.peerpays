const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { login, register, me, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/login', h(login));
router.post('/register', h(register));
router.get('/me', requireAuth, h(me));
router.post('/change-password', requireAuth, h(changePassword));

module.exports = router;
