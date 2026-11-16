const fs = require('fs');
const path = require('path');

// pdfkit lee sus fuentes base (Helvetica, etc.) de archivos .afm dentro de
// node_modules. Vercel solo empaqueta los archivos que el código menciona, así
// que sin esta referencia los PDF fallan en producción. Esta línea hace que la
// carpeta de datos de pdfkit se incluya en el paquete.
const DATOS_PDFKIT = path.join(__dirname, '../../node_modules/pdfkit/js/data');

function fuentesDisponibles() {
    return fs.existsSync(DATOS_PDFKIT) ? fs.readdirSync(DATOS_PDFKIT) : [];
}

module.exports = { fuentesDisponibles };
