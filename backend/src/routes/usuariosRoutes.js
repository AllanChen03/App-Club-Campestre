const express = require('express');

const {
    obtenerUsuarios,
    obtenerUsuario,
    actualizarUsuario,
    suspenderCuenta,
    activarCuenta,
    desactivarCuenta,
    registrarAdministrador,
    restablecerContrasenaSocio,
    rolesAdministrativos
} = require('../controllers/usuariosController');

const { verificarToken } =
    require('../middlewares/verificarToken');

const { verificarRol, verificarActivo } =
    require('../middlewares/verificarPermisos');

const { ROLES_ADMIN, ROL_GENERAL } = require('../utils/roles');

const router = express.Router();

router.use(verificarToken, verificarRol(...ROLES_ADMIN), verificarActivo);

function soloGeneral(req, res, next) {
    if (req.usuarioSistema.roles?.nombre !== ROL_GENERAL) {
        return res.status(403).json({
            mensaje: 'Solo el administrador general puede realizar esta acción'
        });
    }
    next();
}

router.get('/', obtenerUsuarios);
router.get('/roles', soloGeneral, rolesAdministrativos);
router.get('/:id', obtenerUsuario);

router.post('/administradores', soloGeneral, registrarAdministrador);

router.patch('/:id', soloGeneral, actualizarUsuario);

router.patch('/:id/suspender', soloGeneral, suspenderCuenta);
router.patch('/:id/activar', soloGeneral, activarCuenta);
router.patch('/:id/desactivar', soloGeneral, desactivarCuenta);

router.post('/:id/restablecer-contrasena', soloGeneral, restablecerContrasenaSocio);

module.exports = router;
