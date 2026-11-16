const express = require('express');
const c = require('../controllers/instalacionesController');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { ROLES_ADMIN, ROL_GENERAL, ROL_INSTALACIONES, ROL_SOCIO } = require('../utils/roles');

const router = express.Router();

const autenticado = [verificarToken, verificarRol(...ROLES_ADMIN, ROL_SOCIO), verificarActivo];
const gestion = [verificarToken, verificarRol(ROL_GENERAL, ROL_INSTALACIONES), verificarActivo];

// Rutas fijas antes que las que llevan :id
router.get('/bloqueos', gestion, c.listarBloqueos);
router.post('/bloqueos', gestion, c.crearBloqueo);
router.delete('/bloqueos/:id', gestion, c.eliminarBloqueo);

router.get('/ocupacion', gestion, c.consultarOcupacion);
router.get('/reportes', gestion, c.consultarReporte);
router.get('/reportes/pdf', gestion, c.descargarReporte);

router.patch('/servicios/:id', gestion, c.actualizarServicio);

router.get('/', autenticado, c.listar);
router.post('/', gestion, c.crear);
router.patch('/:id', gestion, c.actualizar);
router.delete('/:id', gestion, c.eliminar);
router.post('/:id/servicios', gestion, c.crearServicio);
router.get('/:id/disponibilidad', autenticado, c.consultarDisponibilidad);

module.exports = router;
