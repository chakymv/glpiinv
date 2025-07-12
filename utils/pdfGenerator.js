// utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Asegúrate de tener pdfkit instalado: npm install pdfkit

/**
 * Genera un PDF de un acta de entrega.
 * @param {Object} acta - Objeto con los datos del acta (ej. codigo_acta, usuario_recibe_nombre, etc.).
 * @param {Array} equipos - Array de objetos de equipos asociados al acta.
 * @param {string} responsabilidadesTexto - Texto de las responsabilidades del usuario.
 * @returns {Promise<string>} - La ruta completa del archivo PDF generado.
 */
async function generateActaPdf(acta, equipos, responsabilidadesTexto) {
    return new Promise((resolve, reject) => {
        // Define la carpeta donde se guardarán los PDFs.
        // Asegúrate de que esta carpeta exista o créala programáticamente.
        const pdfsDir = path.join(__dirname, '..', 'public', 'pdfs');
        if (!fs.existsSync(pdfsDir)) {
            fs.mkdirSync(pdfsDir, { recursive: true });
        }

        const fileName = `Acta_Entrega_${acta.codigo_acta}.pdf`;
        const filePath = path.join(pdfsDir, fileName);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Pipe the PDF to a file
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // --- Contenido del PDF ---

        // Configuración de fuentes y tamaño
        doc.font('Helvetica-Bold').fontSize(16).text('ACTA DE ENTREGA DE EQUIPOS', { align: 'center' });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(12).text(`Código de Acta: ${acta.codigo_acta}`, { align: 'center' });
        doc.moveDown(1);

        // Información de la empresa (puedes cargar esto desde tu configuración o DB)
        doc.fontSize(10)
           .text('EMPRESA: IVANAGRO S.A.', { align: 'left' })
           .text('NIT: 900.589.605-7', { align: 'left' })
           .text('DIRECCIÓN: Carrera 50FF # 8 Sur 130, Of. 805, Medellín', { align: 'left' })
           .text('TELÉFONO: (604) 444 04 22', { align: 'left' });
        doc.moveDown(1);

        doc.font('Helvetica-Bold').fontSize(12).text('DATOS DEL USUARIO QUE RECIBE:', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10)
           .text(`Nombre: ${acta.usuario_recibe_nombre || 'N/A'}`)
           .text(`Cédula: ${acta.usuario_recibe_cedula || 'N/A'}`) // Asumiendo que tienes este campo en acta.
           .text(`Cargo: ${acta.usuario_recibe_cargo || 'N/A'}`)   // Asumiendo que tienes este campo en acta.
           .text(`Ubicación: ${acta.usuario_recibe_ubicacion || 'N/A'}`)
           .text(`Teléfono: ${acta.usuario_recibe_telefono || 'N/A'}`)
           .text(`Celular: ${acta.usuario_recibe_celular || 'N/A'}`);
        doc.moveDown(1);

        doc.font('Helvetica-Bold').fontSize(12).text('LISTA DE EQUIPOS ENTREGADOS:', { underline: true });
        doc.moveDown(0.5);

        // Tabla de equipos
        const tableTop = doc.y;
        const itemX = 50;
        const tipoX = 100;
        const inventarioX = 200;
        const serialX = 300;
        const modeloX = 400;

        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Tipo', tipoX, tableTop);
        doc.text('N° Inventario', inventarioX, tableTop);
        doc.text('Serial', serialX, tableTop);
        doc.text('Modelo', modeloX, tableTop);
        doc.moveDown();

        let currentY = doc.y;
        doc.font('Helvetica').fontSize(9);

        equipos.forEach((equipo, index) => {
            currentY += 15; // Espacio entre filas
            doc.text(equipo.itemtype || 'N/A', tipoX, currentY);
            doc.text(equipo.numero_inventario || 'N/A', inventarioX, currentY);
            doc.text(equipo.serial || 'N/A', serialX, currentY);
            doc.text(equipo.modelo || 'N/A', modeloX, currentY);

            // Añadir una nueva página si no hay suficiente espacio para la próxima fila
            if (currentY + 30 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                doc.font('Helvetica-Bold').fontSize(9);
                doc.text('Tipo', tipoX, doc.page.margins.top);
                doc.text('N° Inventario', inventarioX, doc.page.margins.top);
                doc.text('Serial', serialX, doc.page.margins.top);
                doc.text('Modelo', modeloX, doc.page.margins.top);
                doc.font('Helvetica').fontSize(9);
                currentY = doc.page.margins.top + 15;
            }
        });
        doc.moveDown(2);

        // Observaciones
        doc.font('Helvetica-Bold').fontSize(12).text('OBSERVACIONES:', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).text(acta.observaciones || 'Ninguna.', {
            align: 'justify'
        });
        doc.moveDown(1);

        // Texto de responsabilidades
        doc.font('Helvetica-Bold').fontSize(12).text('RESPONSABILIDADES DEL USUARIO:', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).text(responsabilidadesTexto, {
            align: 'justify'
        });
        doc.moveDown(2);


        // Secciones de firma
        const signatureY = doc.y;
        const centerX = doc.page.width / 2;

        // Entregado por
        doc.font('Helvetica-Bold').fontSize(10).text('ENTREGADO POR:', 100, signatureY);
        doc.font('Helvetica').fontSize(10).text(`Nombre: ${acta.entregado_por_nombre || 'N/A'}`, 100, signatureY + 15);
        doc.text(`Cédula: ${acta.entregado_por_cedula || 'N/A'}`, 100, signatureY + 30);
        doc.text(`Cargo: ${acta.entregado_por_cargo || 'N/A'}`, 100, signatureY + 45);

        // Firma del que entrega (si hay)
        if (acta.entregado_por_firma) {
            try {
                // Decodificar Base64 y añadir imagen (ajusta X, Y y dimensiones según necesidad)
                const imgBuffer = Buffer.from(acta.entregado_por_firma.split(',')[1], 'base64');
                doc.image(imgBuffer, 100, signatureY + 60, { width: 100, height: 50 });
            } catch (e) {
                console.error("Error al añadir firma del que entrega:", e);
                doc.text('Firma (problema de imagen)', 100, signatureY + 60);
            }
        } else {
            doc.text('________________________________', 100, signatureY + 60);
            doc.text('Firma', 100, signatureY + 75);
        }

        // Recibido por
        doc.font('Helvetica-Bold').fontSize(10).text('RECIBIDO POR:', centerX + 50, signatureY);
        doc.font('Helvetica').fontSize(10).text(`Nombre: ${acta.usuario_recibe_nombre || 'N/A'}`, centerX + 50, signatureY + 15);
        doc.text(`Cédula: ${acta.usuario_recibe_cedula || 'N/A'}`, centerX + 50, signatureY + 30); // Usar la cédula del usuario GLPI
        doc.text(`Cargo: ${acta.usuario_recibe_cargo || 'N/A'}`, centerX + 50, signatureY + 45); // Usar el cargo del usuario GLPI

        // Firma del que recibe (si hay)
        if (acta.recibido_por_firma) {
            try {
                const imgBuffer = Buffer.from(acta.recibido_por_firma.split(',')[1], 'base64');
                doc.image(imgBuffer, centerX + 50, signatureY + 60, { width: 100, height: 50 });
            } catch (e) {
                console.error("Error al añadir firma del que recibe:", e);
                doc.text('Firma (problema de imagen)', centerX + 50, signatureY + 60);
            }
        } else {
            doc.text('________________________________', centerX + 50, signatureY + 60);
            doc.text('Firma', centerX + 50, signatureY + 75);
        }

        doc.moveDown(3);
        doc.font('Helvetica').fontSize(8).text(`Fecha de Elaboración: ${new Date(acta.fecha_elaboracion).toLocaleDateString('es-CO')}`, { align: 'right' });


        // Finaliza el documento PDF
        doc.end();

        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

module.exports = {
    generateActaPdf
};