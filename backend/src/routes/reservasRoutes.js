const express = require('express');
const c = require('../controllers/reservasController');
const { cargarSocio } = require('../controllers/utilidades');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { ROL_GENERAL, ROL_INSTALACIONES, ROL_SOCIO } = require('../utils/roles');

const router = express.Router();

const socio = [verificarToken, verificarRol(ROL_SOCIO), verificarActivo, cargarSocio];
const gestion = [verificarToken, verificarRol(ROL_GENERAL, ROL_INSTALACIONES), verificarActivo];

// Socio: sus propias reservas
router.get('/mias', socio, c.misReservas);
router.post('/mias', socio, c.crear);
router.get('/mias/:id', socio, c.miReserva);
router.patch('/mias/:id', socio, c.modificarMia);
router.post('/mias/:id/cancelar', socio, c.cancelarMia);

// Administración: todas las reservas
router.get('/', gestion, c.listar);
router.get('/:id', gestion, c.detalle);
router.patch('/:id', gestion, c.modificar);
router.post('/:id/confirmar', gestion, c.confirmar);
router.post('/:id/cancelar', gestion, c.cancelar);

module.exports = router;
