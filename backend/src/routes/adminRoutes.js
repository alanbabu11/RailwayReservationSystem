const express = require('express');
const router = express.Router();
const { getDashboardStats, getAllBookings, getAllUsers } = require('../controllers/adminController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

router.use(authenticate, authorizeAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/bookings', getAllBookings);
router.get('/users', getAllUsers);

module.exports = router;
