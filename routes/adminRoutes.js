//adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');


router.get('/', adminController.showAdminDashboard);


router.get('/acta/new', adminController.showCreateActaForm);
router.post('/acta/create', adminController.processCreateActa);
router.get('/admin/acta/:id', adminController.showActaDetails);

router.get('/api/equipos/:tipo', adminController.getEquiposApi);




module.exports = router;