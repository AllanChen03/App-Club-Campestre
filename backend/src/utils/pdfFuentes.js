// pdfkit carga sus fuentes base con imports internos ('#standard-fonts/...')
// que el empaquetador de Vercel no detecta, y sin ellas los PDF fallan en
// producción con "Cannot find module .../standard-fonts/Helvetica.cjs".
// Pedirlas aquí de forma explícita hace que se incluyan en el paquete.
// Los PDF del sistema usan Helvetica y Helvetica-Bold.
require('pdfkit/standard-fonts/Helvetica');
require('pdfkit/standard-fonts/HelveticaBold');
require('pdfkit/standard-fonts/HelveticaOblique');
require('pdfkit/standard-fonts/HelveticaBoldOblique');

module.exports = {};
