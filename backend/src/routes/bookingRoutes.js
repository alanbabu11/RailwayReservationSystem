const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, getPNRStatus, cancelBooking } = require('../controllers/bookingController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/', authenticate, createBooking);
router.get('/', authenticate, getMyBookings);
router.get('/pnr/:pnr', getPNRStatus); // Public
router.post('/:id/cancel', authenticate, cancelBooking);

module.exports = router;
