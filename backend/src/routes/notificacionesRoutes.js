const express = require('express');
const router = express.Router();
const {
  obtenerPlantillas,
  actualizarPlantilla, // <--- Asegúrate de importarla
  enviarNotificacion,
  obtenerHistorialNotificaciones,
  obtenerUsuarios
} = require('../controllers/notificacionesController');

router.get('/plantillas', obtenerPlantillas);
router.put('/plantillas/:id', actualizarPlantilla); // <--- Añade esta línea para poder editar plantillas
router.post('/enviar', enviarNotificacion);
router.get('/historial', obtenerHistorialNotificaciones);
router.get('/usuarios', obtenerUsuarios);

module.exports = router;