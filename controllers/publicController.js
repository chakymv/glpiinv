const actaModel = require('../models/actaModel');

const tiposDeEquipo = ['Computer', 'Phone', 'NetworkEquipment', 'Monitor', 'Printer', 'Lines', ];


const showInventory = async (req, res) => {
    try {

        const counts = await actaModel.getEquipoCounts();


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
    showInventory,
};