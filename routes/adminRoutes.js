const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin Dashboard
router.get('/', adminController.showAdminDashboard);

// Muestra el formulario para crear una nueva acta
router.get('/acta/new', adminController.showCreateActaForm);

// Procesa la creación de una nueva acta
router.post('/acta/create', adminController.processCreateActa);

// Endpoint de API para obtener equipos por tipo (para el formulario dinámico)
router.get('/api/equipos/:tipo', adminController.getEquiposApi);

module.exports = router;