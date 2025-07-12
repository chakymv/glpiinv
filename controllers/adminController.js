// controllers/adminController.js
const actaModel = require('../models/actaModel');
const pdfGenerator = require('../utils/pdfGenerator'); // Asegúrate de que esta ruta es correcta y el archivo existe

// Lista de tipos de equipo que se mostrarán en el formulario de creación de actas.
// Se ha actualizado para incluir 'Peripheral' y 'Software' para consistencia con actaModel.js.
const tiposDeEquipo = ['Computer', 'Phone', 'NetworkEquipment', 'Monitor', 'Printer', 'Peripheral', 'Software', 'Lines'];

// ===============================================
// Funciones para Renderizar Vistas (GET Requests)
// ===============================================

/**
 * Muestra el dashboard del panel de administración con la lista de actas.
 * Ruta asociada: GET /admin/
 */
const showAdminDashboard = async (req, res) => {
    try {
        const actas = await actaModel.getActas(); // Obtiene el resumen de las actas de la base de datos
        res.render('admin/dashboard', {
            title: 'Panel de Administración',
            actas // Pasa las actas a la plantilla EJS
        });
    } catch (error) {
        console.error('Error al cargar el dashboard:', error);
        res.status(500).send('Error interno del servidor al cargar el dashboard: ' + error.message);
    }
};

/**
 * Muestra el formulario para crear una nueva acta.
 * Ruta asociada: GET /admin/acta/new
 */
const showCreateActaForm = async (req, res) => {
    try {
        // Ejecuta ambas promesas (obtener usuarios y configuración) en paralelo para mayor eficiencia
        const [users, config] = await Promise.all([
            actaModel.getGlpiUsers(),
            actaModel.getConfig()
        ]);

        // Obtiene el texto de responsabilidades de la configuración.
        // Asegúrate que la clave en tu tabla `actas_configuracion` es `responsabilidades_usuario`.
        const responsabilidadesTexto = config.responsabilidades_usuario || 'Sin responsabilidades definidas.';

        res.render('admin/createActa', {
            title: 'Crear Nueva Acta',
            users,          // Lista de usuarios GLPI para el selector
            tiposDeEquipo,  // Lista de tipos de equipo para el selector
            responsabilidades: responsabilidadesTexto // Texto de responsabilidades para el acta
        });
    } catch (error) {
        console.error('Error al cargar el formulario de creación de acta:', error);
        res.status(500).send('Error interno del servidor al cargar el formulario: ' + error.message);
    }
};

/**
 * Muestra los detalles de un acta específica por su ID.
 * Ruta asociada: GET /admin/acta/:id
 * @param {object} req - Objeto de solicitud, se espera `req.params.id` con el ID del acta.
 * @param {object} res - Objeto de respuesta.
 */
const showActaDetails = async (req, res) => {
    try {
        const actaId = parseInt(req.params.id, 10); // Convierte el ID de la URL a número entero
        if (isNaN(actaId)) {
            return res.status(400).send('ID de acta inválido.');
        }

        // Obtiene los detalles completos del acta (incluyendo equipos asociados)
        const acta = await actaModel.getActaDetails(actaId);

        if (!acta) {
            // Si el acta no se encuentra, envía un código de estado 404 (No Encontrado)
            return res.status(404).send('Acta no encontrada.');
        }

        // Renderiza la vista 'admin/actaDetails' y le pasa el objeto 'acta' completo.
        // El objeto `acta` ya contiene el array `equipos`.
        res.render('admin/actaDetails', {
            title: `Detalles Acta ${acta.codigo_acta}`,
            acta,          // Pasa el objeto acta completo
            equiposActa: acta.equipos // Pasa explícitamente los equipos para mayor claridad en la plantilla
        });
    } catch (error) {
        console.error('Error al cargar los detalles del acta:', error);
        res.status(500).send('Error interno del servidor al obtener los detalles del acta: ' + error.message);
    }
};

// ===============================================
// Funciones para Procesar Datos (POST Requests)
// ===============================================

/**
 * Procesa los datos del formulario para crear un acta, la guarda en la DB
 * y luego genera el documento PDF correspondiente.
 * Ruta asociada: POST /admin/acta/create
 * @param {object} req - Objeto de solicitud, se espera `req.body` con los datos del formulario.
 * @param {object} res - Objeto de respuesta.
 */
const processCreateActa = async (req, res) => {
    try {
        const {
            glpi_users_id,
            observaciones,
            entregado_por_nombre,
            entregado_por_cedula,
            entregado_por_cargo,
            entregado_por_firma, // Dato Base64 de la firma del que entrega
            recibido_por_firma,  // Dato Base64 de la firma del que recibe
            equipos              // Array de strings "itemtype|items_id" del formulario
        } = req.body;

        // Formatea los equipos para ser insertados en la tabla `actas_equipos`.
        // Convierte el valor `equipos` (que podría ser un string, array o undefined) a un array de objetos.
        const equiposParaDB = equipos ? (Array.isArray(equipos) ? equipos : [equipos])
            .filter(e => e) // Filtra cualquier elemento nulo o vacío
            .map(equipoString => {
                const [itemtype, items_id] = equipoString.split('|'); // Divide el string para obtener tipo y ID
                return { itemtype, items_id: parseInt(items_id, 10) }; // Convierte items_id a entero
            }) : []; // Si no hay equipos seleccionados, inicializa como un array vacío

        const datosActaParaDB = {
            glpi_users_id: parseInt(glpi_users_id, 10), // Asegura que el ID de usuario es un entero
            observaciones,
            entregado_por_nombre,
            entregado_por_cedula,
            entregado_por_cargo,
            entregado_por_firma: entregado_por_firma || null, // Almacena el Base64 de la firma o null si no se proporciona
            recibido_por_firma: recibido_por_firma || null,   // Almacena el Base64 de la firma o null
            equipos: equiposParaDB // El array de equipos formateados
        };

        // 1. Crear el acta en la base de datos (se genera el `codigo_acta` y se asocian los equipos)
        const nuevaActa = await actaModel.crearActa(datosActaParaDB);

        // 2. Obtener los detalles completos del acta (incluyendo los detalles de los equipos ya asociados)
        // Esto es necesario porque `crearActa` solo devuelve el ID y el código, no todos los detalles para el PDF.
        const actaCompleta = await actaModel.getActaDetails(nuevaActa.id);

        if (!actaCompleta) {
            console.warn(`Acta ${nuevaActa.id} creada, pero no se pudieron obtener los detalles completos para generar el PDF.`);
            return res.status(500).send('Acta creada, pero hubo un error al obtener detalles para PDF. Revise los logs del servidor.');
        }

        // 3. Obtener el texto de las responsabilidades del usuario desde la configuración global
        const config = await actaModel.getConfig();
        const responsabilidadesTexto = config.responsabilidades_usuario || 'Sin responsabilidades definidas en la configuración del sistema.';

        // 4. Generar el documento PDF del acta.
        // La función `generateActaPdf` se encarga de guardar el archivo en la ruta especificada.
        const pdfPath = await pdfGenerator.generateActaPdf(
            actaCompleta,          // Pasa el objeto acta completo (incluye todos los campos y el array de `equipos`)
            actaCompleta.equipos,  // Pasa explícitamente los equipos asociados al acta
            responsabilidadesTexto // Pasa el texto de responsabilidades para incluirlo en el PDF
        );

        console.log(`PDF del acta ${actaCompleta.codigo_acta} generado en: ${pdfPath}`);

        // 5. Redirige al usuario a la página de detalles del acta recién creada para confirmación
        res.redirect(`/admin/acta/${nuevaActa.id}`);

    } catch (error) {
        console.error('Error al procesar la creación del acta o generar el PDF:', error);
        res.status(500).send('Error al crear el acta: ' + error.message);
    }
};

// ===============================================
// Funciones de API (Respuestas JSON)
// ===============================================

/**
 * Endpoint de API para obtener equipos por tipo.
 * Usado por solicitudes AJAX desde el frontend (ej. cuando se selecciona un tipo de equipo en el formulario).
 * Ruta asociada: GET /api/equipos/:tipo
 * @param {object} req - Objeto de solicitud, se espera `req.params.tipo` con el tipo de equipo.
 * @param {object} res - Objeto de respuesta.
 */
const getEquiposApi = async (req, res) => {
    try {
        const { tipo } = req.params; // Obtiene el tipo de equipo del parámetro de la URL
        console.log(`API request for equipment of type: ${tipo}`); // Log para depuración
        const equipos = await actaModel.getEquiposPorTipo(tipo); // Llama a la función del modelo para obtener los equipos
        res.json(equipos); // Devuelve la lista de equipos como respuesta JSON
    } catch (error) {
        console.error(`Error en el controlador al obtener equipos de tipo ${tipo}:`, error);
        res.status(500).json({ message: 'Error interno del servidor al cargar equipos.', error: error.message });
    }
};


// ===============================================
// Exportación de Funciones del Controlador
// ===============================================
// Exporta todas las funciones para que puedan ser utilizadas por el archivo de rutas (`adminRoutes.js`).
module.exports = {
    showAdminDashboard,
    showCreateActaForm,
    processCreateActa,
    getEquiposApi,
    showActaDetails
};