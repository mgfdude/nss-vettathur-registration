const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');
const { validateRegistrationInitiate, validateRegistrationVerify } = require('../middlewares/validation');
const { otpRateLimiter } = require('../middlewares/rateLimiter');

router.post('/register/initiate', otpRateLimiter, validateRegistrationInitiate, authController.registerInitiate);
router.post('/register/verify', validateRegistrationVerify, authController.registerVerify);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', authenticateToken, authController.me);
router.post('/forgot-password/initiate', otpRateLimiter, authController.forgotPasswordInitiate);
router.post('/forgot-password/reset', authController.forgotPasswordReset);
router.post('/forgot-app-id/initiate', otpRateLimiter, authController.forgotAppIdInitiate);
router.post('/forgot-app-id/verify', authController.forgotAppIdVerify);
router.post('/logout', authController.logout);

module.exports = router;
