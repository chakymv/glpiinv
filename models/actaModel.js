const mysql = require('mysql2/promise');

// Configuración del pool de conexiones a tu base de datos GLPI
const pool = mysql.createPool({
  host: '10.170.20.142',
  user: 'root',
  password: 'Dh4rm4**.2030',
  database: 'glpi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

/**
 * Obtiene la lista de equipos disponibles de un tipo específico desde GLPI.
 * @param {string} tipoDeEquipo - El tipo de equipo (ej: 'Computer', 'Phone', 'NetworkEquipment').
 * @returns {Promise<Array>} - Una lista de equipos con sus detalles.
 */
async function getEquiposPorTipo(tipoDeEquipo) {
  let connection;
  try {
    connection = await pool.getConnection();

    const itemConfig = {
      'Computer': { tabla: 'glpi_computers', modelo: 'glpi_computermodels', join: 'computermodels_id' },
      'Phone': { tabla: 'glpi_phones', modelo: 'glpi_phonemodels', join: 'phonemodels_id' },
      'NetworkEquipment': { tabla: 'glpi_networkequipments', modelo: 'glpi_networkequipmentmodels', join: 'networkequipmentmodels_id' },
    };

    if (!itemConfig[tipoDeEquipo]) {
      throw new Error(`Tipo de equipo no soportado: ${tipoDeEquipo}`);
    }

    const { tabla, modelo, join } = itemConfig[tipoDeEquipo];

    const sqlQuery = `
      SELECT 
        equipo.id,
        equipo.otherserial AS numero_inventario,
        equipo.serial,
        fab.name AS fabricante,
        modelo.name AS modelo
      FROM ${tabla} AS equipo
      LEFT JOIN glpi_manufacturers AS fab ON equipo.manufacturers_id = fab.id
      LEFT JOIN ${modelo} AS modelo ON equipo.${join} = modelo.id
      WHERE equipo.is_deleted = 0 AND equipo.states_id NOT IN (5, 6); -- Excluir equipos en desecho o archivados
    `;

    const [rows] = await connection.execute(sqlQuery);
    return rows;

  } catch (error) {
    console.error(`Error al obtener equipos de tipo ${tipoDeEquipo}:`, error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Obtiene el conteo total de equipos por tipo.
 * @returns {Promise<Object>} - Un objeto con los conteos. ej: { Computer: 10, Phone: 5 }
 */
async function getEquipoCounts() {
    let connection;
    try {
        connection = await pool.getConnection();
        const counts = {};

        const queries = {
            Computer: 'SELECT COUNT(*) as count FROM glpi_computers WHERE is_deleted = 0 AND states_id NOT IN (5, 6)',
            Phone: 'SELECT COUNT(*) as count FROM glpi_phones WHERE is_deleted = 0 AND states_id NOT IN (5, 6)',
            NetworkEquipment: 'SELECT COUNT(*) as count FROM glpi_networkequipments WHERE is_deleted = 0 AND states_id NOT IN (5, 6)',
        };

        for (const tipo in queries) {
            const [rows] = await connection.execute(queries[tipo]);
            counts[tipo] = rows[0].count;
        }

        return counts;
    } catch (error) {
        console.error('Error al obtener conteo de equipos:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}


/**
 * Obtiene todos los usuarios activos de GLPI.
 * @returns {Promise<Array>} - Lista de usuarios con id, nombre y apellido.
 */
async function getGlpiUsers() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT id, CONCAT(realname, ', ', firstname) as fullname FROM glpi_users WHERE is_active = 1 ORDER BY realname, firstname
        `);
        return rows;
    } catch (error) {
        console.error('Error al obtener usuarios de GLPI:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Crea una nueva acta de entrega en la base de datos.
 * @param {object} datosActa - Objeto con los datos del acta.
 * @returns {Promise<object>} - El acta creada con su ID y código.
 */
async function crearActa(datosActa) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const sqlActa = `
      INSERT INTO actas (glpi_users_id, observaciones, entregado_por_nombre, entregado_por_cedula, entregado_por_cargo, entregado_por_firma)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [resultActa] = await connection.execute(sqlActa, [
      datosActa.glpi_users_id,
      datosActa.observaciones,
      datosActa.entregado_por_nombre,
      datosActa.entregado_por_cedula,
      datosActa.entregado_por_cargo,
      datosActa.entregado_por_firma
    ]);

    const nuevaActaId = resultActa.insertId;
    const codigoActa = `ACE-${nuevaActaId}`;
    await connection.execute('UPDATE actas SET codigo_acta = ? WHERE id = ?', [codigoActa, nuevaActaId]);

    if (datosActa.equipos && datosActa.equipos.length > 0) {
      const sqlEquipos = 'INSERT INTO actas_equipos (actas_id, items_id, itemtype) VALUES ?';
      const valoresEquipos = datosActa.equipos.map(equipo => [nuevaActaId, equipo.items_id, equipo.itemtype]);
      await connection.query(sqlEquipos, [valoresEquipos]);
    }

    await connection.commit();
    console.log(`Acta ${codigoActa} creada exitosamente.`);
    
    return { id: nuevaActaId, codigo_acta: codigoActa };

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al crear el acta:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Obtiene la configuración general de la aplicación.
 * @returns {Promise<Object>} - Un objeto con la configuración.
 */
async function getConfig() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT clave, valor FROM actas_configuracion');
        // Convertir el array de {clave, valor} a un objeto {clave: valor}
        const config = rows.reduce((acc, row) => {
            acc[row.clave] = row.valor;
            return acc;
        }, {});
        return config;
    } catch (error) {
        console.error('Error al obtener la configuración:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Obtiene una lista de todas las actas creadas.
 * @returns {Promise<Array>} - Un array con todas las actas.
 */
async function getActas() {
    let connection;
    try {
        connection = await pool.getConnection();
        const sqlQuery = `
            SELECT 
                a.id, 
                a.codigo_acta, 
                a.fecha_elaboracion,
                CONCAT(u.realname, ', ', u.firstname) as usuario_recibe,
                a.entregado_por_nombre
            FROM actas AS a
            JOIN glpi_users AS u ON a.glpi_users_id = u.id
            ORDER BY a.fecha_elaboracion DESC
            LIMIT 100; -- Limitar para no sobrecargar
        `;
        const [rows] = await connection.execute(sqlQuery);
        return rows;
    } catch (error) {
        console.error('Error al obtener las actas:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getEquiposPorTipo,
    getEquipoCounts,
    getGlpiUsers,
    crearActa,
    getConfig,
    getActas
};