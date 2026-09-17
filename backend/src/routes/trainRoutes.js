const express = require('express');
const router = express.Router();
const { searchTrains, getTrainDetails, getAllTrains, addTrain, updateTrain, deleteTrain } = require('../controllers/trainController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

router.get('/search', searchTrains);
router.get('/all', getAllTrains);
router.get('/:id', getTrainDetails);
router.post('/', authenticate, authorizeAdmin, addTrain);
router.put('/:id', authenticate, authorizeAdmin, updateTrain);
router.delete('/:id', authenticate, authorizeAdmin, deleteTrain);

module.exports = router;
