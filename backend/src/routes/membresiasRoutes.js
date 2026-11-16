const express = require('express');
const ctrl = require('../controllers/membresiasController');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarRol, verificarActivo } = require('../middlewares/verificarPermisos');
const { ROLES_ADMIN, ROL_GENERAL, ROL_SOCIO } = require('../utils/roles');

const router = express.Router();

function soloGeneral(req, res, next) {
    if (req.usuarioSistema.roles?.nombre !== ROL_GENERAL) {
        return res.status(403).json({
            mensaje: 'Solo el administrador general puede realizar esta acción'
        });
    }
    next();
}

// Rutas exclusivas para el Socio autenticado
router.get('/mia', verificarToken, verificarRol(ROL_SOCIO), verificarActivo, ctrl.obtenerMiMembresia);
router.post('/mia/beneficiarios', verificarToken, verificarRol(ROL_SOCIO), verificarActivo, ctrl.registrarMiBeneficiario);
router.delete('/mia/beneficiarios/:idBeneficiario', verificarToken, verificarRol(ROL_SOCIO), verificarActivo, ctrl.quitarMiBeneficiario);

// Rutas de Tipos de Membresía (Admin)
router.get('/tipos', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, ctrl.obtenerTipos);
router.post('/tipos', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.crearTipo);
router.patch('/tipos/:id', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.actualizarTipo);

// Rutas de Administración de Membresías y Beneficiarios
router.get('/', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, ctrl.obtenerSociosMembresias);
router.post('/', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.crearMembresia);
router.get('/:id', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, ctrl.obtenerMembresia);
router.patch('/:id', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.actualizarMembresia);
router.post('/:id/beneficiarios', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.registrarBeneficiarioAdmin);
router.delete('/:id/beneficiarios/:idBeneficiario', verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo, soloGeneral, ctrl.quitarBeneficiarioAdmin);

module.exports = router;