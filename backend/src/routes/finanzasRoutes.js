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

const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ROL_GENERAL, ROL_COBROS, ROL_SOCIO } = require('../utils/roles');

// Gestión de cobros: administrador general y encargado de cobros (sección Cobros)
const cobros = [verificarToken, verificarRol(ROL_GENERAL, ROL_COBROS), verificarActivo];
// Estado de cuenta: también el socio, pero solo el suyo
const estadoCuenta = [verificarToken, verificarRol(ROL_GENERAL, ROL_COBROS, ROL_SOCIO), verificarActivo, soloPropio];

// Un socio solo puede consultar su propio estado de cuenta:
// se ignora el id que venga en la ruta y se usa el del socio con sesión.
async function soloPropio(req, res, next) {
  if (req.usuarioSistema.roles?.nombre !== ROL_SOCIO) return next();

  const { data, error } = await supabaseAdmin
    .from('socios')
    .select('id_socio')
    .eq('id_usuario', req.usuarioAuth.id)
    .maybeSingle();

  if (error) return res.status(500).json({ mensaje: 'No se pudo verificar el socio' });
  if (!data) return res.status(403).json({ mensaje: 'Su cuenta no está registrada como socio' });

  req.params.id_socio = String(data.id_socio);
  next();
}

// El pago queda a nombre del administrador con sesión, no del que diga el formulario
function administradorDeSesion(req, res, next) {
  req.body = { ...(req.body ?? {}), id_administrador: req.usuarioAuth.id };
  next();
}

router.post('/cargos', cobros, generarCargo);
router.post('/pagos', cobros, administradorDeSesion, registrarPagoManual);
router.get('/morosos', cobros, obtenerMorosos);
router.get('/resumen', cobros, obtenerResumenFinanciero);
router.get('/estado-cuenta/:id_socio', estadoCuenta, consultarEstadoCuenta);
router.get('/estado-cuenta/:id_socio/pdf', estadoCuenta, generarPdfEstadoCuenta);

module.exports = router;
