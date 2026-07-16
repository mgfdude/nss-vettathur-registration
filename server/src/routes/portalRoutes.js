const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');

router.get('/status', portalController.getPortalStatus);

module.exports = router;
