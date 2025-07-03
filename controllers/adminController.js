const actaModel = require('../models/actaModel');

const tiposDeEquipo = ['Computer', 'Phone', 'NetworkEquipment'];

/**
 * Muestra el dashboard del panel de administración con la lista de actas.
 */
const showAdminDashboard = async (req, res) => {
    try {
        const actas = await actaModel.getActas();
        res.render('admin/dashboard', {
            title: 'Panel de Administración',
            actas
        });
    } catch (error) {
        res.status(500).send('Error al cargar el dashboard: ' + error.message);
    }
};

/**
 * Muestra el formulario para crear una nueva acta.
 */
const showCreateActaForm = async (req, res) => {
    try {
        const [users, config] = await Promise.all([
            actaModel.getGlpiUsers(),
            actaModel.getConfig()
        ]);

        res.render('admin/createActa', {
            title: 'Crear Nueva Acta',
            users,
            tiposDeEquipo,
            responsabilidades: config.responsabilidades_defecto || ''
        });
    } catch (error) {
        res.status(500).send('Error al cargar el formulario: ' + error.message);
    }
};

/**
 * Procesa los datos del formulario para crear un acta.
 */
const processCreateActa = async (req, res) => {
    try {
        const {
            glpi_users_id,
            observaciones,
            entregado_por_nombre,
            entregado_por_cedula,
            entregado_por_cargo,
            equipos // Esto llegará como un array de strings "itemtype|items_id"
        } = req.body;

        // Formatear los equipos para el modelo
        const equiposFormateados = (Array.isArray(equipos) ? equipos : [equipos])
            .filter(e => e) // Filtrar valores vacíos
            .map(equipoString => {
                const [itemtype, items_id] = equipoString.split('|');
                return { itemtype, items_id: parseInt(items_id, 10) };
            });

        const datosActa = {
            glpi_users_id: parseInt(glpi_users_id, 10),
            observaciones,
            entregado_por_nombre,
            entregado_por_cedula,
            entregado_por_cargo,
            entregado_por_firma: req.body.entregado_por_firma || null, // Asumiendo que la firma vendrá en base64
            equipos: equiposFormateados
        };

        await actaModel.crearActa(datosActa);
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error al crear el acta: ' + error.message);
    }
};

/**
 * Endpoint de API para obtener equipos por tipo.
 */
const getEquiposApi = async (req, res) => {
    try {
        const { tipo } = req.params;
        const equipos = await actaModel.getEquiposPorTipo(tipo);
        res.json(equipos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener equipos: ' + error.message });
    }
};

module.exports = {
    showAdminDashboard,
    showCreateActaForm,
    processCreateActa,
    getEquiposApi
};