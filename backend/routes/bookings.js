const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/bookingController');

router.use(requireAuth);

// Card holder
router.post('/', requireRole('cardholder'), h(ctrl.submit));
router.get('/mine', requireRole('cardholder'), h(ctrl.listMine));
router.post('/confirm-many', requireRole('cardholder'), h(ctrl.confirmMany));
router.post('/:id/confirm', requireRole('cardholder'), h(ctrl.confirmAccept));
router.post('/:id/approve-otp', requireRole('cardholder'), h(ctrl.approveOtp));
router.post('/:id/otp', requireRole('cardholder'), h(ctrl.submitOtp));

// Booker
router.get('/available', requireRole('booker'), h(ctrl.available));
router.get('/assigned', requireRole('booker'), h(ctrl.mineAsBooker));
router.get('/:id/card', requireRole('booker'), h(ctrl.revealCard));
router.post('/accept-many', requireRole('booker'), h(ctrl.acceptMany));
router.post('/:id/accept', requireRole('booker'), h(ctrl.accept));
router.post('/:id/reject', requireRole('booker'), h(ctrl.reject));
router.post('/:id/request-otp', requireRole('booker'), h(ctrl.requestOtp));
router.post('/:id/otp-sent', requireRole('booker'), h(ctrl.markOtpSent));
router.post('/:id/resend-otp', requireRole('booker'), h(ctrl.requestResend));
router.post('/:id/screenshot', requireRole('booker'), upload.single('screenshot'), h(ctrl.uploadScreenshot));
router.post('/:id/complete', requireRole('booker'), h(ctrl.complete));
router.post('/:id/fail', requireRole('booker'), h(ctrl.failOrder));

module.exports = router;
