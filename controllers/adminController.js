const actaModel = require('../models/actaModel');
const path = require('path');
const fs = require('fs');
const pdfGenerator = require('../utils/pdfGenerator');


exports.showAdminDashboard = async (req, res) => {

    try {
        const actas = await actaModel.getActas();
        const counts = await actaModel.getEquipoCounts();
        res.render('admin/dashboard', {
            title: 'Panel de Administración',
            actas: actas,
            counts: counts
        });
    } catch (error) {
        console.error('Error al cargar el panel de administración:', error);
        res.status(500).send('Error al cargar el panel de administración.');
    }
};

exports.showCreateActaForm = async (req, res) => {
    try {
        // Asumo que tu modelo puede proporcionar estos datos
        const tiposDeEquipo = await actaModel.getTiposDeEquipo();
        const users = await actaModel.getUsers();
        const config = await actaModel.getConfig();

        res.render('admin/createActa', {
            title: 'Crear Nueva Acta de Entrega',
            tiposDeEquipo: tiposDeEquipo,
            users: users,
            responsabilidades: config.responsabilidades_usuario || 'No se han definido responsabilidades.'
        });
    } catch (error) {
        console.error('Error al mostrar el formulario de creación de acta:', error);
        res.status(500).send('Error al cargar el formulario.');
    }
};

exports.processCreateActa = async (req, res) => {
    try {
        const actaData = {
            glpi_users_id: req.body.glpi_users_id,
            entregado_por_nombre: req.body.entregado_por_nombre,
            entregado_por_cargo: req.body.entregado_por_cargo,
            entregado_por_cedula: req.body.entregado_por_cedula,
            observaciones: req.body.observaciones,
            entregado_por_firma: req.body.entregado_por_firma,
            recibido_por_firma: req.body.recibido_por_firma,
            recibido_por_cargo: req.body.recibido_por_cargo,
            recibido_por_cedula: req.body.recibido_por_cedula
        };

        // Asegurarse de que 'equipos' sea siempre un array
        let equipos = req.body.equipos || [];
        if (typeof equipos === 'string') {
            equipos = [equipos];
        }
        const equiposIds = equipos.map(e => e.split('|')[1]);

        // Crear el acta y asociar los equipos
        const newActa = await actaModel.createActa(actaData, equiposIds);

        // Generar el PDF con los datos completos
        const actaDetails = await actaModel.getActaById(newActa.id);
        const equiposDetails = await actaModel.getEquiposByActaId(newActa.id);
        const config = await actaModel.getConfig();
        await pdfGenerator.generateActaPdf(actaDetails, equiposDetails, config);

        console.log(`Acta ${newActa.codigo_acta} creada con éxito y PDF generado.`);
        // Redirigir a la página de detalles del acta recién creada
        res.redirect(`/admin/acta/${newActa.id}`);
    } catch (error) {
        console.error('Error al procesar la creación del acta:', error);
        res.status(500).send('Error al guardar el acta.');
    }
};

exports.showActaDetails = async (req, res) => {
    try {
        const acta = await actaModel.getActaById(req.params.id);
        const equipos = await actaModel.getEquiposByActaId(req.params.id);

        if (!acta) return res.status(404).send('Acta no encontrada');

        res.render('admin/actaDetails', { title: `Detalle Acta ${acta.codigo_acta}`, acta, equiposActa: equipos });
    } catch (error) {
        console.error(`Error al cargar detalles del acta ${req.params.id}:`, error);
        res.status(500).send('Error al cargar detalles del acta.');
    }
};


/**
 * API endpoint para obtener la lista de equipos según el tipo.
 * @param {string} req.params.tipo El tipo de equipo a buscar.
 */
exports.getEquiposApi = async (req, res) => {
    const tipo = req.params.tipo;
    try {
      // Implementa la lógica para obtener equipos de la base de datos
      // Reemplaza 'actaModel.getEquiposPorTipo' con tu función real.
      const equipos = await actaModel.getEquiposPorTipo(tipo);
      res.json(equipos);
    } catch (error) {
      console.error('Error al obtener equipos de la API:', error);
      res.status(500).json({ error: 'Error al obtener la lista de equipos.' });
    }
  };
  
  



exports.getEquipoApi = async (req, res) => res.json({ message: `API para equipo ${req.params.id} de tipo ${req.params.tipo} (placeholder)` });



exports.showConfigForm = async (req, res) => {
    try {
        const config = await actaModel.getConfig();
        res.render('admin/actasConfiguracion', {
            title: 'Configuración de Actas',
            config
        });
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
        res.status(500).send('Error al cargar la página de configuración.');
    }
};


exports.updateConfig = async (req, res) => {
    try {
        const { titulo_acta, responsabilidades_usuario } = req.body;

     
        await actaModel.updateConfig('titulo_acta', titulo_acta);
        await actaModel.updateConfig('responsabilidades_usuario', responsabilidades_usuario);

        
        if (req.file) {
           
            const newLogoPath = '/uploads/' + req.file.filename;
            await actaModel.updateConfig('logo_empresa', newLogoPath);
        }
       

        console.log('Configuración actualizada con éxito.');
       
        res.redirect('/admin/config');
    } catch (error) {
        console.error('Error al actualizar la configuración:', error);
        res.status(500).send('Error al guardar la configuración.');
    }
};