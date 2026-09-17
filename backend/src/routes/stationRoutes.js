const express = require('express');
const router = express.Router();
const { getAllStations, addStation, deleteStation } = require('../controllers/stationController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

router.get('/', getAllStations);
router.post('/', authenticate, authorizeAdmin, addStation);
router.delete('/:id', authenticate, authorizeAdmin, deleteStation);

module.exports = router;
