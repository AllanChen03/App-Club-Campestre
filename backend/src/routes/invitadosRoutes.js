const express = require('express');
const c = require('../controllers/invitadosController');
const { cargarSocio } = require('../controllers/utilidades');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { ROL_GENERAL, ROL_INSTALACIONES, ROL_SOCIO } = require('../utils/roles');

const router = express.Router();

const socio = [verificarToken, verificarRol(ROL_SOCIO), verificarActivo, cargarSocio];
const recepcion = [verificarToken, verificarRol(ROL_GENERAL, ROL_INSTALACIONES), verificarActivo];

// Recepción: invitados esperados en un día
router.get('/dia', recepcion, c.delDia);

// Socio: sus invitados y visitas
router.get('/', socio, c.misInvitados);
router.get('/cupo', socio, c.consultarCupo);
router.post('/visitas', socio, c.registrarVisita);
router.post('/visitas/:id/cancelar', socio, c.cancelarVisita);

module.exports = router;
