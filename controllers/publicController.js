const actaModel = require('../models/actaModel');

const tiposDeEquipo = ['Computer', 'Phone', 'NetworkEquipment'];

/**
 * Muestra la página principal del inventario.
 */
const showInventory = async (req, res) => {
    try {
        // Obtener los conteos para las cards
        const counts = await actaModel.getEquipoCounts();

        // Obtener los detalles de cada tipo de equipo para las tablas
        const inventario = {};
        for (const tipo of tiposDeEquipo) {
            inventario[tipo] = await actaModel.getEquiposPorTipo(tipo);
        }

        res.render('index', {
            title: 'Inventario General de Equipos',
            counts,
            inventario,
            tipos: tiposDeEquipo
        });
    } catch (error) {
        res.status(500).send('Error al cargar el inventario: ' + error.message);
    }
};

module.exports = {
    showInventory
};