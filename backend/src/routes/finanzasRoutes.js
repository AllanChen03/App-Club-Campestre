const express = require('express');
const router = express.Router();
const {
  generarCargo,
  consultarEstadoCuenta,
  registrarPagoManual,
  obtenerMorosos,
  generarPdfEstadoCuenta,
  obtenerResumenFinanciero
} = require('../controllers/finanzasController');

router.post('/cargos', generarCargo);
router.get('/estado-cuenta/:id_socio', consultarEstadoCuenta);
router.post('/pagos', registrarPagoManual);
router.get('/morosos', obtenerMorosos);
router.get('/estado-cuenta/:id_socio/pdf', generarPdfEstadoCuenta);
router.get('/resumen', obtenerResumenFinanciero);

module.exports = router;
