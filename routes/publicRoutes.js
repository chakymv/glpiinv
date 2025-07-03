const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Ruta para la página principal pública
router.get('/', publicController.showInventory);

module.exports = router;