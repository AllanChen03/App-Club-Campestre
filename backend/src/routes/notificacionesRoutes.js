const express = require('express');
const router = express.Router();
const {
  obtenerPlantillas,
  actualizarPlantilla,
  enviarNotificacion,
  obtenerHistorialNotificaciones,
  obtenerUsuarios
} = require('../controllers/notificacionesController');

const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { ROL_GENERAL, ROL_COBROS } = require('../utils/roles');

// Plantillas, envíos e historial: solo el administrador general (sección Notificaciones)
const general = [verificarToken, verificarRol(ROL_GENERAL), verificarActivo];
// La lista de usuarios también la usa Cobros
const generalYCobros = [verificarToken, verificarRol(ROL_GENERAL, ROL_COBROS), verificarActivo];

router.get('/plantillas', general, obtenerPlantillas);
router.put('/plantillas/:id', general, actualizarPlantilla);
router.post('/enviar', general, enviarNotificacion);
router.get('/historial', general, obtenerHistorialNotificaciones);
router.get('/usuarios', generalYCobros, obtenerUsuarios);

module.exports = router;
