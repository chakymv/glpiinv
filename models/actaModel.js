const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '10.170.20.142',
    user: 'root',
    password: 'Dh4rm4**.2030',
    database: 'glpi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    jsonStrings: true
});

const ITEM_CONFIG = {
    'Computer': { tabla: 'glpi_computers', modelo: 'glpi_computermodels', join: 'computermodels_id' },
    'Phone': { tabla: 'glpi_phones', modelo: 'glpi_phonemodels', join: 'phonemodels_id' },
    'NetworkEquipment': { tabla: 'glpi_networkequipments', modelo: 'glpi_networkequipmentmodels', join: 'networkequipmentmodels_id' },
    'Monitor': { tabla: 'glpi_monitors', modelo: 'glpi_monitormodels', join: 'monitormodels_id' },
    'Printer': { tabla: 'glpi_printers', modelo: 'glpi_printermodels', join: 'printermodels_id' },
    'Peripheral': { tabla: 'glpi_peripherals', modelo: 'glpi_peripheralmodels', join: 'peripheralmodels_id' },
    'Software': { tabla: 'glpi_softwares', modelo: null, join: null, customQuery: true },
    'Lines': { tabla: 'glpi_lines', modelo: null, join: null, customQuery: true }
};

async function getEquiposPorTipo(tipoDeEquipo) {
    let connection;
    try {
        connection = await pool.getConnection();
        if (!ITEM_CONFIG[tipoDeEquipo]) {
            throw new Error(`Tipo de equipo no soportado: ${tipoDeEquipo}`);
        }

        const config = ITEM_CONFIG[tipoDeEquipo];
        let sqlQuery;

        if (config.customQuery) {
            if (tipoDeEquipo === 'Lines') {
                sqlQuery = `
                    SELECT
                        l.id,
                        l.caller_name AS numero_inventario,
                        l.caller_num AS serial,
                        g.name AS fabricante,
                        'Línea Telefónica' AS modelo,
                        'Activo' AS estado,
                        NULL AS usuario_asignado,
                        loc.completename AS ubicacion,
                        NULL AS tecnico_a_cargo,
                        JSON_OBJECT(
                            'Tipo', 'Línea Telefónica',
                            'Número', l.caller_num,
                            'Nombre de la Línea', l.caller_name,
                            'Grupo', g.name,
                            'Ubicación', loc.completename
                        ) AS especificaciones
                    FROM glpi_lines AS l
                    INNER JOIN glpi_groups AS g ON l.groups_id = g.id
                    LEFT JOIN glpi_locations AS loc ON l.locations_id = loc.id
                    WHERE l.is_deleted = 0 AND l.locations_id IS NOT NULL;
                `;
            } else if (tipoDeEquipo === 'Software') {
                sqlQuery = `
                    SELECT
                        s.id,
                        s.name AS numero_inventario,
                        NULL AS serial,
                        NULL AS fabricante,
                        NULL AS modelo,
                        NULL AS estado,
                        NULL AS usuario_asignado,
                        NULL AS ubicacion,
                        NULL AS tecnico_a_cargo,
                        JSON_OBJECT(
                            'Nombre', s.name,
                            'Versión', IFNULL(s.version, 'N/A'),
                            'Editor', IFNULL(edi.name, 'N/A'),
                            'Licencias', (SELECT COUNT(*) FROM glpi_softwarelicenses WHERE softwares_id = s.id AND is_deleted = 0)
                        ) AS especificaciones
                    FROM glpi_softwares AS s
                    LEFT JOIN glpi_softwarepublishers AS edi ON s.softwarepublishers_id = edi.id
                    WHERE s.is_deleted = 0;
                `;
            }
        } else {
            const { tabla, modelo, join } = config;
            sqlQuery = `
                SELECT
                    equipo.id,
                    equipo.otherserial AS numero_inventario,
                    equipo.serial,
                    fab.name AS fabricante,
                    ${modelo ? `modelo.name AS modelo,` : `NULL AS modelo,`}
                    st.name AS estado,
                    CONCAT(u.realname, ', ', u.firstname) AS usuario_asignado,
                    l.completename as ubicacion,
                    CONCAT(tech.realname, ', ', tech.firstname) AS tecnico_a_cargo,
                    JSON_OBJECT(
                        'Número de Inventario', equipo.otherserial,
                        'Serial', equipo.serial,
                        'Fabricante', fab.name,
                        ${modelo ? `'Modelo', modelo.name,` : ''}
                        'Estado', st.name,
                        'Ubicación', l.completename,
                        'Usuario Asignado', CONCAT(u.realname, ', ', u.firstname),
                        'Técnico a Cargo', CONCAT(tech.realname, ', ', tech.firstname)
                        
                        -- ${tabla === 'glpi_monitors' ? `, 'Resolución', equipo.TU_COLUMNA_RESOLUCION, 'Tamaño', equipo.TU_COLUMNA_TAMANO` : ''}
                    ) AS especificaciones
                FROM ${tabla} AS equipo
                LEFT JOIN glpi_manufacturers AS fab ON equipo.manufacturers_id = fab.id
                ${modelo ? `LEFT JOIN ${modelo} AS modelo ON equipo.${join} = modelo.id` : ''}
                LEFT JOIN glpi_states AS st ON equipo.states_id = st.id
                LEFT JOIN glpi_users AS u ON equipo.users_id = u.id
                LEFT JOIN glpi_locations AS l ON equipo.locations_id = l.id
                LEFT JOIN glpi_users AS tech ON equipo.users_id_tech = tech.id
                WHERE equipo.is_deleted = 0 AND equipo.states_id NOT IN (5, 6);
            `;
        }

        const [rows] = await connection.execute(sqlQuery);
        return rows;

    } catch (error) {
        console.error(`Error al obtener equipos de tipo ${tipoDeEquipo}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function getEquiposDisponiblesPorTipo(tipoDeEquipo) {
    let connection;
    try {
        connection = await pool.getConnection();
        
        const itemConfig = {
            'Computer': { tabla: 'glpi_computers', modelo: 'glpi_computermodels', join: 'computermodels_id' },
            'Phone': { tabla: 'glpi_phones', modelo: 'glpi_phonemodels', join: 'phonemodels_id' },
            'Monitor': { tabla: 'glpi_monitors', modelo: 'glpi_monitormodels', join: 'monitormodels_id' },
            'Printer': { tabla: 'glpi_printers', modelo: 'glpi_printermodels', join: 'printermodels_id' },
            'Peripheral': { tabla: 'glpi_peripherals', modelo: 'glpi_peripheralmodels', join: 'peripheralmodels_id' },
            'Software': { tabla: 'glpi_softwares', modelo: null, join: null, customQuery: true },
            'Lines': { tabla: 'glpi_lines', modelo: null, join: null, customQuery: true }
        };

        if (!itemConfig[tipoDeEquipo]) {
            throw new Error(`Tipo de equipo no soportado: ${tipoDeEquipo}`);
        }

        const config = itemConfig[tipoDeEquipo];
        let sqlQuery;

        if (config.customQuery) {
            if (tipoDeEquipo === 'Lines') {
                sqlQuery = `
                    SELECT
                        l.id,
                        l.caller_name AS numero_inventario,
                        l.caller_num AS serial,
                        g.name AS fabricante,
                        'Línea Telefónica' AS modelo,
                        'Activo' AS estado,
                        NULL AS usuario_asignado,
                        loc.completename AS ubicacion,
                        NULL AS tecnico_a_cargo
                    FROM glpi_lines AS l
                    LEFT JOIN actas_equipos AS ae ON ae.items_id = l.id AND ae.itemtype = 'Lines'
                    INNER JOIN glpi_groups AS g ON l.groups_id = g.id
                    LEFT JOIN glpi_locations AS loc ON l.locations_id = loc.id
                    WHERE l.is_deleted = 0 AND l.locations_id IS NOT NULL AND ae.actas_id IS NULL;
                `;
            } else if (tipoDeEquipo === 'Software') {
                sqlQuery = `
                    SELECT
                        s.id,
                        s.name AS numero_inventario,
                        NULL AS serial,
                        NULL AS fabricante,
                        NULL AS modelo,
                        NULL AS estado,
                        NULL AS usuario_asignado,
                        NULL AS ubicacion,
                        NULL AS tecnico_a_cargo
                    FROM glpi_softwares AS s
                    LEFT JOIN actas_equipos AS ae ON ae.items_id = s.id AND ae.itemtype = 'Software'
                    LEFT JOIN glpi_softwarepublishers AS edi ON s.softwarepublishers_id = edi.id
                    WHERE s.is_deleted = 0 AND ae.actas_id IS NULL;
                `;
            }
        } else {
            const { tabla, modelo, join } = config;
            sqlQuery = `
                SELECT
                    equipo.id,
                    equipo.otherserial AS numero_inventario,
                    equipo.serial,
                    fab.name AS fabricante,
                    ${modelo ? `modelo.name AS modelo,` : `NULL AS modelo,`}
                    st.name AS estado,
                    CONCAT(u.realname, ', ', u.firstname) AS usuario_asignado,
                    l.completename as ubicacion,
                    CONCAT(tech.realname, ', ', tech.firstname) AS tecnico_a_cargo
                FROM ${tabla} AS equipo
                LEFT JOIN actas_equipos AS ae ON ae.items_id = equipo.id AND ae.itemtype = '${tipoDeEquipo}'
                LEFT JOIN glpi_manufacturers AS fab ON equipo.manufacturers_id = fab.id
                ${modelo ? `LEFT JOIN ${modelo} AS modelo ON equipo.${join} = modelo.id` : ''}
                LEFT JOIN glpi_states AS st ON equipo.states_id = st.id
                LEFT JOIN glpi_users AS u ON equipo.users_id = u.id
                LEFT JOIN glpi_locations AS l ON equipo.locations_id = l.id
                LEFT JOIN glpi_users AS tech ON equipo.users_id_tech = tech.id
                WHERE equipo.is_deleted = 0 AND equipo.states_id NOT IN (5, 6) AND ae.actas_id IS NULL;
            `;
        }

        const [rows] = await connection.execute(sqlQuery);
        return rows;

    } catch (error) {
        console.error(`Error al obtener equipos disponibles de tipo ${tipoDeEquipo}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();

    }
}

async function getEquipoCounts() {
    let connection;
    try {
        connection = await pool.getConnection();
        const sqlQuery = `
            SELECT 'Computer' as tipo, COUNT(*) as count FROM glpi_computers WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'Monitor' as tipo, COUNT(*) as count FROM glpi_monitors WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'Printer' as tipo, COUNT(*) as count FROM glpi_printers WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'Phone' as tipo, COUNT(*) as count FROM glpi_phones WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'NetworkEquipment' as tipo, COUNT(*) as count FROM glpi_networkequipments WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'Peripheral' as tipo, COUNT(*) as count FROM glpi_peripherals WHERE is_deleted = 0 AND states_id NOT IN (5, 6)
            UNION ALL
            SELECT 'Software' as tipo, COUNT(*) as count FROM glpi_softwares WHERE is_deleted = 0
            UNION ALL
            SELECT 'Lines' as tipo, COUNT(*) as count FROM glpi_lines WHERE is_deleted = 0;
        `;
        const [rows] = await connection.execute(sqlQuery);
        return rows.reduce((acc, row) => {
            acc[row.tipo] = row.count;
            return acc;
        }, {});
    } catch (error) {
        console.error('Error al obtener conteo de equipos:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

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

async function getUserPicture(userId) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT picture FROM glpi_users WHERE id = ? AND is_active = 1
        `, [userId]);

        if (rows.length > 0) {
            return rows[0].picture;
        }
        return null;
    } catch (error) {
        console.error('Error al obtener la imagen del usuario:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function getConfig() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT clave, valor FROM actas_configuracion');
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

async function crearActa(datosActa) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const sqlActa = `
            INSERT INTO actas (glpi_users_id, observaciones, entregado_por_nombre, entregado_por_cedula, entregado_por_cargo, entregado_por_firma, recibido_por_firma, recibido_por_cedula, recibido_por_cargo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [resultActa] = await connection.execute(sqlActa, [
            datosActa.glpi_users_id,
            datosActa.observaciones,
            datosActa.entregado_por_nombre,
            datosActa.entregado_por_cedula,
            datosActa.entregado_por_cargo,
            datosActa.entregado_por_firma,
            datosActa.recibido_por_firma,
            datosActa.recibido_por_cedula,
            datosActa.recibido_por_cargo
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
            LIMIT 100;
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

async function getActaDetails(actaId) {
    let connection;
    try {
        connection = await pool.getConnection();

        const sqlActa = `
            SELECT
                a.*,
                CONCAT(u.realname, ' ', u.firstname) as usuario_recibe_nombre,
                u.phone as usuario_recibe_telefono,
                u.mobile as usuario_recibe_celular,
                loc.completename as usuario_recibe_ubicacion
            FROM actas AS a
            LEFT JOIN glpi_users AS u ON a.glpi_users_id = u.id
            LEFT JOIN glpi_locations AS loc ON u.locations_id = loc.id
            WHERE a.id = ?;
        `;
        const [actaRows] = await connection.execute(sqlActa, [actaId]);
        if (actaRows.length === 0) {
            return null;
        }
        const acta = actaRows[0];

     
        const queries = [];
        for (const tipo in ITEM_CONFIG) {
            const config = ITEM_CONFIG[tipo];
            if (config.customQuery) continue;
            queries.push(`
                (SELECT
                    '${tipo}' as itemtype,
                    equipo.id,
                    equipo.otherserial AS numero_inventario,
                    equipo.serial,
                    fab.name AS fabricante,
                    ${config.modelo ? `modelo.name AS modelo,` : `NULL AS modelo,`}
                    st.name AS estado,
                    CONCAT(u.realname, ', ', u.firstname) AS usuario_asignado,
                    l.completename as ubicacion,
                    CONCAT(tech.realname, ', ', tech.firstname) AS tecnico_a_cargo
                FROM ${config.tabla} AS equipo
                JOIN actas_equipos AS ae ON ae.items_id = equipo.id AND ae.itemtype = '${tipo}'
                LEFT JOIN glpi_manufacturers AS fab ON equipo.manufacturers_id = fab.id
                ${config.modelo ? `LEFT JOIN ${config.modelo} AS modelo ON equipo.${config.join} = modelo.id` : ''}
                LEFT JOIN glpi_states AS st ON equipo.states_id = st.id
                LEFT JOIN glpi_users AS u ON equipo.users_id = u.id
                LEFT JOIN glpi_locations AS l ON equipo.locations_id = l.id
                LEFT JOIN glpi_users AS tech ON equipo.users_id_tech = tech.id
                WHERE ae.actas_id = ? AND equipo.is_deleted = 0)
            `);
        }

        
        queries.push(`
            (SELECT 'Lines' as itemtype, l.id, l.caller_name AS numero_inventario, l.caller_num AS serial, g.name AS fabricante, 'Línea Telefónica' AS modelo, 'Activo' AS estado, NULL, loc.completename, NULL
            FROM glpi_lines AS l
            JOIN actas_equipos AS ae ON ae.items_id = l.id AND ae.itemtype = 'Lines'
            INNER JOIN glpi_groups AS g ON l.groups_id = g.id
            LEFT JOIN glpi_locations AS loc ON l.locations_id = loc.id
            WHERE ae.actas_id = ? AND l.is_deleted = 0)
        `);

        queries.push(`
            (SELECT 
    'Software' as itemtype,
    s.id,
    s.name AS numero_inventario,
    v.name AS serial,
    NULL AS fabricante,
    NULL AS modelo,
    NULL AS estado,
    NULL AS usuario_asignado,
    NULL AS ubicacion,
    NULL AS tecnico_a_cargo
FROM glpi_softwares AS s
JOIN actas_equipos AS ae ON ae.items_id = s.id AND ae.itemtype = 'Software'
LEFT JOIN glpi_items_softwareversions AS isv ON isv.items_id = s.id AND isv.itemtype = 'Software'
LEFT JOIN glpi_softwareversions AS v ON isv.softwareversions_id = v.id
WHERE ae.actas_id = ? AND s.is_deleted = 0)

        `);

        const fullQuery = queries.join(' UNION ALL ');
        const params = Array(queries.length).fill(actaId);

        const [equipos] = await connection.execute(fullQuery, params);


        for (const equipo of equipos) {
            const equipoCompleto = await getEquipoPorTipoYId(equipo.itemtype, equipo.id);
            if (equipoCompleto) {
                equipo.especificaciones = equipoCompleto.especificaciones;
            }
        }

        acta.equipos = equipos;

        return acta;

    } catch (error) {
        console.error(`Error al obtener detalles del acta ${actaId}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function getEquipoPorTipoYId(tipoDeEquipo, equipoId) {
    let connection;
    try {
        connection = await pool.getConnection();

        const itemConfig = {
            'Computer': { tabla: 'glpi_computers', modelo: 'glpi_computermodels', join: 'computermodels_id' },
            'Monitor': { tabla: 'glpi_monitors', modelo: 'glpi_monitormodels', join: 'monitormodels_id' },
            'Printer': { tabla: 'glpi_printers', modelo: 'glpi_printermodels', join: 'printermodels_id' },
            'Peripheral': { tabla: 'glpi_peripherals', modelo: 'glpi_peripheralmodels', join: 'peripheralmodels_id' },
            'Software': { tabla: 'glpi_softwares', modelo: null, join: null, customQuery: true },
            'Lines': { tabla: 'glpi_lines', modelo: null, join: null, customQuery: true }
        };

        if (!itemConfig[tipoDeEquipo]) {
            throw new Error(`Tipo de equipo no soportado: ${tipoDeEquipo}`);
        }

        const config = itemConfig[tipoDeEquipo];
        let sqlQuery;
        const params = [equipoId];

        if (config.customQuery) {
            if (tipoDeEquipo === 'Lines') {
                sqlQuery = `
                    SELECT
                        l.id,
                        l.caller_name AS numero_inventario,
                        l.caller_num AS serial,
                        g.name AS fabricante,
                        'Línea Telefónica' AS modelo,
                        'Activo' AS estado,
                        NULL AS usuario_asignado,
                        loc.completename AS ubicacion,
                        NULL AS tecnico_a_cargo,
                        JSON_OBJECT(
                            'Tipo', '
Línea Telefónica',
                            'Número', l.caller_num,
                            'Nombre de la Línea', l.caller_name,
                            'Grupo', g.name,
                            'Ubicación', loc.completename
                        ) AS especificaciones
                    FROM glpi_lines AS l
                    INNER JOIN glpi_groups AS g ON l.groups_id = g.id
                    LEFT JOIN glpi_locations AS loc ON l.locations_id = loc.id
                    WHERE l.is_deleted = 0 AND l.id = ?;
                `;
            } else if (tipoDeEquipo === 'Software') {
                sqlQuery = `
                    SELECT
                        s.id,
                        s.name AS numero_inventario,
                        s.version AS serial,
                        NULL AS fabricante,
                        NULL AS modelo,
                        NULL AS estado,
                        NULL AS usuario_asignado,
                        NULL AS ubicacion,
                        NULL AS tecnico_a_cargo,
                        JSON_OBJECT(
                            'Nombre', s.name,
                            'Versión', IFNULL(s.version, 'N/A'),
                            'Editor', IFNULL(edi.name, 'N/A'),
                            'Licencias', (SELECT COUNT(*) FROM glpi_softwarelicenses WHERE softwares_id = s.id AND is_deleted = 0)
                        ) AS especificaciones
                    FROM glpi_softwares AS s
                    LEFT JOIN glpi_softwarepublishers AS edi ON s.softwarepublishers_id = edi.id
                    WHERE s.is_deleted = 0 AND s.id = ?;
                `;
            }
        } else {
            const { tabla, modelo, join } = config;
            sqlQuery = `
                SELECT
                    equipo.id,
                    equipo.otherserial AS numero_inventario,
                    equipo.serial,
                    fab.name AS fabricante,
                    ${modelo ? `modelo.name AS modelo,` : `NULL AS modelo,`}
                    st.name AS estado,
                    CONCAT(u.realname, ', ', u.firstname) AS usuario_asignado,
                    l.completename as ubicacion,
                    CONCAT(tech.realname, ', ', tech.firstname) AS tecnico_a_cargo,
                    JSON_OBJECT(
                        'Número de Inventario', equipo.otherserial,
                        'Serial', equipo.serial,
                        'Fabricante', fab.name,
                        ${modelo ? `'Modelo', modelo.name,` : ''}
                        'Estado', st.name,
                        'Ubicación', l.completename,
                        'Usuario Asignado', CONCAT(u.realname, ', ', u.firstname),
                        'Técnico a Cargo', CONCAT(tech.realname, ', ', tech.firstname)
                    ) AS especificaciones
                FROM ${tabla} AS equipo
                LEFT JOIN glpi_manufacturers AS fab ON equipo.manufacturers_id = fab.id
                ${modelo ? `LEFT JOIN ${modelo} AS modelo ON equipo.${join} = modelo.id` : ''}
                LEFT JOIN glpi_states AS st ON equipo.states_id = st.id
                LEFT JOIN glpi_users AS u ON equipo.users_id = u.id
                LEFT JOIN glpi_locations AS l ON equipo.locations_id = l.id
                LEFT JOIN glpi_users AS tech ON equipo.users_id_tech = tech.id
                WHERE equipo.is_deleted = 0 AND equipo.id = ?;
            `;
        }

        const [rows] = await connection.execute(sqlQuery, params);
        return rows.length > 0 ? rows[0] : null;

   } catch (error) {
        console.error(`Error al obtener el equipo ${tipoDeEquipo} con ID ${equipoId}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();
    }


}




async function updateConfig(clave, valor) {
    let connection;
    try {
        connection = await pool.getConnection();
       
        const sql = 'INSERT INTO actas_configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?';
        await connection.execute(sql, [clave, valor, valor]);
        return true;
    } catch (error) {
        console.error(`Error al actualizar la configuración para la clave ${clave}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getEquiposPorTipo,
    getEquipoCounts,
    getGlpiUsers,
    getUserPicture,
    crearActa,
    getConfig,
    getActas,
    getActaDetails,
    getEquipoPorTipoYId,
    getActaById: getActaDetails,
    getEquiposDisponiblesPorTipo,
    updateConfig
}