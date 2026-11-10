const express = require('express');
const controller = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.post('/register', registerLimiter, controller.register);
router.post('/login', loginLimiter, controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);

module.exports = router;
