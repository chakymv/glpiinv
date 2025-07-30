const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
        fs.mkdirSync(uploadPath, { recursive: true }); 
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.get('/', adminController.showAdminDashboard);

router.get('/acta/create', adminController.showCreateActaForm);
router.post('/acta/create', adminController.processCreateActa);
router.get('/acta/:id', adminController.showActaDetails);


router.get('/api/equipos/:tipo', adminController.getEquiposApi);
router.get('/api/equipos/:tipo/:id', adminController.getEquipoApi);


router.get('/config', adminController.showConfigForm);
router.post('/config/update', upload.single('logo_empresa'), adminController.updateConfig);

module.exports = router;
