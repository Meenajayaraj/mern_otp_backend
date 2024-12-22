const express = require('express');
const { signup, verifyAccount, resendOTP, login, logout, forgotPassword, resetPassword } = require('../controller/authController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const router = express.Router();

router.post("/signup", signup);
router.post("/verify", isAuthenticated, verifyAccount);
router.post("/resend-otp", isAuthenticated, resendOTP);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
module.exports = router;
